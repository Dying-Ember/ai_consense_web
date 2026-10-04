<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { api, draftingApi, ApiError } from '@/api'
import type { DraftDocument, DraftProgress, DraftVariable, EvidenceItem, ExtractTrace, TemplateItem } from '@/api/types'
import { useAppStore } from '@/stores/app'
import { useLocalized } from '@/composables/useLocalized'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'

const { t } = useI18n()
const store = useAppStore()
const { pick, currentKey } = useLocalized()

type Step = 'inputs' | 'base' | 'files'

const step = ref<Step>('inputs')
const templates = ref<TemplateItem[]>([])
const inputs = ref<EvidenceItem[]>([])
const variables = ref<DraftVariable[]>([])
const progress = ref<DraftProgress | null>(null)
const documents = ref<DraftDocument[]>([])
const trace = ref<ExtractTrace | null>(null)
const traceOpen = ref(false)

const loading = ref(false)
const extracting = ref(false)
const generating = ref(false)
const confirmingFile = ref(false)
const activeFile = ref('NTT')
const focusMode = ref(false)
const reviewPaneOpen = ref(false)
const selectedDocVarKey = ref<string | null>(null)
/** 第 3 步右栏预览模式：review = 审阅（token 徽标/颜色） / final = 最终稿（只显示替换后文本，隐藏未命中 token） */
const previewMode = ref<'review' | 'final'>('review')
const templateInput = ref<HTMLInputElement | null>(null)
const evidenceInput = ref<HTMLInputElement | null>(null)

const projectId = computed(() => store.activeProjectId)

const baseVariables = computed(() => variables.value.filter((item) => item.scope === 'BASE'))
const fileVariables = computed(() =>
  variables.value.filter((item) => item.scope === 'FILE' && (!item.fileKey || item.fileKey === activeFile.value))
)
const draftFileKeys = ['NTT', 'SCT', 'SCC']
const activeDocument = computed(() => documents.value.find((doc) => doc.fileKey === activeFile.value) ?? null)

const canLeaveInputs = computed(
  () => templates.value.some((item) => item.tag === 'ok') || inputs.value.some((item) => item.status === 'PARSED')
)

const steps = computed(() => [
  { key: 'inputs', title: t('drafting.wizard.inputs.title'), desc: t('drafting.wizard.inputs.desc'), done: canLeaveInputs.value },
  { key: 'base', title: t('drafting.wizard.base.title'), desc: t('drafting.wizard.base.desc'), done: !!progress.value?.baseReady },
  { key: 'files', title: t('drafting.wizard.files.title'), desc: t('drafting.wizard.files.desc'), done: !!progress.value?.allReady }
])

async function reload() {
  if (!projectId.value) return
  loading.value = true
  try {
    const [templateList, inputList, variableList, progressData, documentList] = await Promise.all([
      draftingApi.templates(projectId.value),
      draftingApi.inputs(projectId.value),
      draftingApi.variables(projectId.value),
      draftingApi.progress(projectId.value),
      draftingApi.documents(projectId.value)
    ])
    templates.value = templateList
    inputs.value = inputList
    variables.value = variableList
    progress.value = progressData
    documents.value = documentList
    // 识别过程留痕（后端内存态，从未识别过或接口异常时静默置空）
    trace.value = await draftingApi.extractTrace(projectId.value).catch(() => null)
  } finally {
    loading.value = false
  }
}

onMounted(reload)
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
watch(projectId, () => {
  step.value = 'inputs'
  reload()
})

function gotoStep(next: Step) {
  if (next === 'base' && !canLeaveInputs.value) {
    store.notify(t('drafting.gates.needInputs'))
    return
  }
  if (next === 'files' && !progress.value?.baseReady) {
    store.notify(t('drafting.gates.needBase'))
    return
  }
  step.value = next
}

async function uploadTemplates(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length) return
  await runTask(t('common.loading'), async () => {
    const result = await draftingApi.uploadTemplates(projectId.value, files)
    store.notify(result.messages.join('\n') || t('common.done'), 5000)
    await reload()
  })
  if (templateInput.value) templateInput.value.value = ''
}

async function uploadInputs(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length) return
  await runTask(t('common.loading'), async () => {
    const result = await draftingApi.uploadInputs(projectId.value, files)
    store.notify(result.messages.join('\n') || t('common.done'), 5000)
    await reload()
  })
  if (evidenceInput.value) evidenceInput.value.value = ''
}

// ------------------------------------------------------------ 删除沟通证据
const deleteEvidenceOpen = ref(false)
const deleteEvidenceTarget = ref<EvidenceItem | null>(null)

function askDeleteInput(item: EvidenceItem) {
  deleteEvidenceTarget.value = item
  deleteEvidenceOpen.value = true
}

async function confirmDeleteInput() {
  const target = deleteEvidenceTarget.value
  if (!target?.id) return
  await runTask(t('common.loading'), async () => {
    await draftingApi.deleteInput(projectId.value, target.id!)
    store.notify(t('common.deleted'), 3000)
    await reload()
  })
  deleteEvidenceOpen.value = false
  deleteEvidenceTarget.value = null
}

// ------------------------------------------------------------ 第 1 步：替换标准模板（原型「替换 NTT / SCT / SCC」）
const templateReplaceInput = ref<HTMLInputElement | null>(null)
const pendingReplaceKey = ref('')

function startReplaceTemplate(key: string) {
  pendingReplaceKey.value = key
  if (templateReplaceInput.value) {
    templateReplaceInput.value.value = ''
    templateReplaceInput.value.click()
  }
}

async function replaceTemplate(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  const key = pendingReplaceKey.value
  if (!file || !key) return
  await runTask(t('common.loading'), async () => {
    const result = await draftingApi.replaceTemplate(projectId.value, key, file)
    // 单文件替换 → 只清该文件的 OCR 缓存
    clearOcrCache(key)
    store.notify(result.messages.join('\n') || t('common.done'), 5000)
    await reload()
  })
  if (templateReplaceInput.value) templateReplaceInput.value.value = ''
  pendingReplaceKey.value = ''
}

/** 生成"带 {{key}} 占位符的空白模板草稿"，方便用户改写原 PDF/Word 后重新上传 */
function downloadBlankTemplate() {
  const lines: string[] = []
  lines.push('# 空白 NTT 模板占位符清单（草稿）')
  lines.push('')
  lines.push('本文件由 ConSense 自动生成，按下方 key 名把 NTT 合同范本中需要填空的位置')
  lines.push('改成对应的 `{{key}}` 标记，然后导出 PDF / DOCX 再上传到第 1 步。')
  lines.push('')
  lines.push('> 提示：')
  lines.push('> 1. 在原 PDF 中填加占位符可以用 Adobe Acrobat、福昕、PDFescape 等 PDF 编辑器；')
  lines.push('> 2. 也可以复制原 NTT 文本到 Word，加上占位符后另存为 PDF；')
  lines.push('> 3. 第 3 步会自动 OCR 找到这些占位符并联动。')
  lines.push('')
  lines.push('## 全局变量（影响 NTT / SCT / SCC 三份文件）')
  lines.push('')
  for (const v of variables.value.filter(v => v.scope === 'BASE')) {
    const label = pick(v.label) || v.key
    const sample = (v.result || v.value || v.choice || '').toString().trim()
    lines.push(`- **${label}**  {{${v.key}}}`)
    if (sample) lines.push(`  - 示例值：${sample.length > 60 ? sample.slice(0, 60) + '…' : sample}`)
    lines.push(`  - action=${v.action}`)
  }
  lines.push('')
  lines.push('## NTT 专属变量（影响 NTT）')
  lines.push('')
  for (const v of variables.value.filter(v => v.scope === 'FILE' && v.fileKey === 'NTT')) {
    const label = pick(v.label) || v.key
    const sample = (v.result || v.value || v.choice || '').toString().trim()
    lines.push(`- **${label}**  {{${v.key}}}`)
    if (sample) lines.push(`  - 示例值：${sample.length > 60 ? sample.slice(0, 60) + '…' : sample}`)
    lines.push(`  - action=${v.action}`)
  }
  lines.push('')
  lines.push('## 占位符使用示例')
  lines.push('')
  lines.push('原文（香港房委会 Notes to Tenderers 摘录）：')
  lines.push('```')
  lines.push('This standard documentation is for lump sum building contracts with firm')
  lines.push('bills of quantities. This standard documentation is to be used in')
  lines.push('conjunction with: (a) Hong Kong Housing Authority General Conditions of Contract')
  lines.push('for Building Works 2013 Edition (version 1.1); ...')
  lines.push('```')
  lines.push('')
  lines.push('改成带占位符的空白模板（在 NTT 顶端加"项目信息"一节）：')
  lines.push('```')
  const ct = variables.value.find(v => v.key === 'contractTitle')
  if (ct) lines.push(`Project Title: {{contractTitle}}`)
  const wt = variables.value.find(v => v.key === 'worksType')
  if (wt) lines.push(`Type of Works: {{worksType}}`)
  lines.push('')
  lines.push('This standard documentation is for lump sum building contracts with firm')
  lines.push('bills of quantities, in respect of the Works as defined in the Conditions of')
  lines.push('Contract. Tendering system for this Contract: {{electronicTendering}}.')
  const fi = variables.value.find(v => v.key === 'foundationIncluded')
  if (fi) lines.push(`Foundation works included: {{foundationIncluded}}.`)
  lines.push('```')
  lines.push('')
  lines.push('—— END ——')

  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `blank-template-NTT-${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
  store.notify(t('drafting.templates.blankDownloaded'), 4000)
}

async function extract() {
  extracting.value = true
  store.setBusy(t('drafting.variables.extracting'))
  try {
    variables.value = await draftingApi.extract(projectId.value)
    progress.value = await draftingApi.progress(projectId.value)
    trace.value = await draftingApi.extractTrace(projectId.value).catch(() => null)
    store.notify(t('common.done'))
  } finally {
    extracting.value = false
    store.clearBusy()
  }
}

function formatTraceTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

async function saveVariable(
  variable: DraftVariable,
  patch: { value?: string; choice?: string; confirmed?: boolean; note?: string; result?: string }
) {
  let updated: DraftVariable
  try {
    updated = await draftingApi.updateVariable(projectId.value, variable.key, patch)
  } catch (err: any) {
    // 后端没有该变量（变量列表过期，或 PDF token 引用了未抽取的 key）→ 自动补建 FILE 变量后重试
    if (err instanceof ApiError && err.code === 4006) {
      await draftingApi.createVariable(projectId.value, {
        key: variable.key,
        fileKey: variable.fileKey || activeFile.value,
        labelZhHans: pick(variable.label) || variable.key,
        labelEn: variable.label?.en || variable.key,
        action: variable.action || 'fill',
        options: (variable.options ?? []).map((o) => pick(o)).filter(Boolean),
        value: variable.value,
        reason: 'PDF token 引用但后端变量缺失，自动补建'
      })
      updated = await draftingApi.updateVariable(projectId.value, variable.key, patch)
    } else {
      throw err
    }
  }
  const index = variables.value.findIndex((item) => item.key === updated.key)
  if (index >= 0) variables.value.splice(index, 1, updated)
  else variables.value.push(updated)
  progress.value = await draftingApi.progress(projectId.value)
  // 保存成功后：watch(variables) → regenerateHtml() 自动重新生成所有 token 的当前取值显示
  // + 滚动到该变量在 PDF 中的影响点
  void locateTokenInEditor(updated.key)
}

// ------------------------------------------------------------ 第 3 步：文档渲染（PDF.js 文本层 → HTML 流式布局）
interface PdfPageInfo {
  pageNum: number
  width: number
  height: number
  imgUrl: string                 // PDF.js canvas 渲染出的整页图片（真实 PDF 外观）
  html: string                  // 变量 overlay HTML，只含 token <span class="hit" data-hit-var="KEY">，不含正文
  ocrStatus: 'pending' | 'done' | 'error' | null
}
const pdfBlobUrl = ref('')
const pdfLoading = ref(false)
const pdfError = ref('')
const pdfPages = ref<PdfPageInfo[]>([])
const pdfScrollContainer = ref<HTMLElement | null>(null)
let pdfObjectUrl = ''
let pdfDoc: any = null
let pdfRenderSeq = 0
let pdfjsLib: any = null
const PDF_SCALE = 1.35

async function ensurePdfJs() {
  if (pdfjsLib) return pdfjsLib
  const mod: any = await import('pdfjs-dist')
  pdfjsLib = mod.default ?? mod
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const worker: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default ?? worker
  }
  return pdfjsLib
}

function releasePdf() {
  if (pdfObjectUrl) {
    URL.revokeObjectURL(pdfObjectUrl)
    pdfObjectUrl = ''
  }
  // 释放每页 canvas 图片的 object URL
  for (const r of pageRaws.value) {
    if (r.imgUrl) URL.revokeObjectURL(r.imgUrl)
  }
  pdfBlobUrl.value = ''
  pdfError.value = ''
  pdfPages.value = []
  pageRaws.value = []
  ocrProgress.value = { current: 0, total: 0, status: '' }
  if (pdfDoc) {
    try { pdfDoc.destroy() } catch { /* noop */ }
    pdfDoc = null
  }
  void releaseTessWorker()
}

async function loadPdf() {
  const requestKey = activeFile.value
  const seq = ++pdfRenderSeq
  releasePdf()
  if (!projectId.value || !draftFileKeys.includes(requestKey)) return
  pdfLoading.value = true
  try {
    const blob = await api.blob(`/drafting/${projectId.value}/templates/${requestKey}/preview.pdf`)
    if (seq !== pdfRenderSeq || activeFile.value !== requestKey) return
    pdfObjectUrl = URL.createObjectURL(blob)
    pdfBlobUrl.value = pdfObjectUrl
    await renderPdfPages(seq)
  } catch (err: any) {
    if (seq === pdfRenderSeq) {
      const biz = err?.response?.data?.message as string | undefined
      pdfError.value = biz || t('drafting.files.previewFailed')
    }
  } finally {
    if (seq === pdfRenderSeq) pdfLoading.value = false
  }
}

async function renderPdfPages(seq: number) {
  const lib = await ensurePdfJs()
  const task = lib.getDocument(pdfBlobUrl.value)
  pdfDoc = await task.promise
  if (seq !== pdfRenderSeq) return
  const total = pdfDoc.numPages

  const raws: PageRaw[] = []
  for (let i = 1; i <= total; i++) {
    const page = await pdfDoc.getPage(i)
    if (seq !== pdfRenderSeq) return
    const viewport = page.getViewport({ scale: PDF_SCALE })

    // 1) 真实 PDF 页 → canvas → 图片（扫描件 / 文字层通用的唯一渲染方式，所见即所得）
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    if (seq !== pdfRenderSeq) return
    const imgUrl = await new Promise<string>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : ''), 'image/png')
    })

    // 2) 取文字层（有则用于变量 overlay 精确定位；无则该页只有 canvas 图）
    const text = await page.getTextContent()
    if (seq !== pdfRenderSeq) {
      if (imgUrl) URL.revokeObjectURL(imgUrl)
      return
    }
    const items = text.items as any[]

    raws.push({ pageNum: i, source: 'pdf', items, viewport, ocrStatus: null, imgUrl })
    // 渐进式上屏：每渲染完一页立即可见
    pageRaws.value = [...raws]
    regenerateHtml()
  }

  console.log(`[PDF] canvas 渲染完成 ${raws.length} 页（不使用 OCR）`)
}

// ------------------------------------------------------------ OCR（对没文字层的扫描页做 tesseract.js OCR）
let tessWorker: any = null
let tessLoading: Promise<any> | null = null
const ocrEnabled = ref(true)         // 是否启用 OCR（开关，留给用户控制）
const ocrProgress = ref({ current: 0, total: 0, status: '' as '' | 'idle' | 'loading' | 'running' | 'done' | 'error' | '' })

async function ensureTessWorker() {
  if (tessWorker) return tessWorker
  if (tessLoading) return tessLoading
  ocrProgress.value = { current: 0, total: 0, status: 'loading' }
  console.log('[OCR] initializing tesseract worker...')
  tessLoading = (async () => {
    try {
      const mod: any = await import('tesseract.js')
      console.log('[OCR] tesseract.js module loaded', mod)
      const Tess = mod.default ?? mod
      // eng 模型支持简体/繁体/英文混合扫描件。模型从 CDN 首次下载 ~10MB
      const w = await Tess.createWorker('eng')
      tessWorker = w
      ocrProgress.value.status = ''
      console.log('[OCR] tesseract worker ready')
      return w
    } catch (err) {
      console.warn('[OCR] tesseract worker init failed:', err)
      ocrProgress.value = { current: 0, total: 0, status: 'error' }
      return null
    } finally {
      tessLoading = null
    }
  })()
  return tessLoading
}

/* ----------------------- OCR 结果缓存（sessionStorage）-----------------------
 * 同一文件第二次进入时直接复用上次结果，避免反复扫描。文件版本号变化（替换模板后）
 * 用 fileKey + 上传时间作为缓存键的一部分隔离。手动调用 clearOcrCache() 可重跑。 */
const OCR_CACHE_PREFIX = 'consense-ocr'
function ocrCacheKey(fileKey: string, pageNum: number): string {
  return `${OCR_CACHE_PREFIX}:${fileKey}:${pageNum}`
}
function getCachedOcr(fileKey: string, pageNum: number): any[] | null {
  try {
    const raw = sessionStorage.getItem(ocrCacheKey(fileKey, pageNum))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function setCachedOcr(fileKey: string, pageNum: number, words: any[]): void {
  try { sessionStorage.setItem(ocrCacheKey(fileKey, pageNum), JSON.stringify(words)) }
  catch { /* 容量溢出时静默丢弃，下次会重跑 */ }
}
function clearOcrCache(fileKey?: string): void {
  try {
    if (fileKey) {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i)
        if (k && k.startsWith(`${OCR_CACHE_PREFIX}:${fileKey}:`)) sessionStorage.removeItem(k)
      }
    } else {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i)
        if (k && k.startsWith(`${OCR_CACHE_PREFIX}:`)) sessionStorage.removeItem(k)
      }
    }
  } catch { /* noop */ }
}

async function ocrAllPages() {
  if (!ocrEnabled.value) { console.log('[OCR] disabled'); return }
  const targets = pageRaws.value.filter(p => p.ocrStatus === 'pending')
  console.log('[OCR] ocrAllPages targets=', targets.length)
  if (!targets.length) return
  const worker = await ensureTessWorker()
  if (!worker) { console.warn('[OCR] no worker'); return }
  const fileKey = activeFile.value
  ocrProgress.value = { current: 0, total: targets.length, status: 'running' }
  for (const p of targets) {
    if (p.ocrStatus !== 'pending') continue
    console.log('[OCR] page', p.pageNum, 'start')
    try {
      const pageProxy = await pdfDoc.getPage(p.pageNum)
      const vp = pageProxy.getViewport({ scale: PDF_SCALE })
      const tmpCanvas = document.createElement('canvas')
      tmpCanvas.width = Math.floor(vp.width)
      tmpCanvas.height = Math.floor(vp.height)
      const ctx = tmpCanvas.getContext('2d')!
      await pageProxy.render({ canvasContext: ctx, viewport: vp }).promise
      const ret = await worker.recognize(tmpCanvas)
      const words: any[] = ret?.data?.words ?? []
      console.log('[OCR] page', p.pageNum, 'words=', words.length)
      // 更新 raw：source 改为 'ocr'，写回 words
      const idx = pageRaws.value.findIndex(r => r.pageNum === p.pageNum)
      if (idx >= 0) {
        pageRaws.value[idx] = { ...p, source: 'ocr', items: words, ocrStatus: 'done' }
      }
      if (fileKey && words.length) setCachedOcr(fileKey, p.pageNum, words)
    } catch (err) {
      console.warn(`[OCR] page ${p.pageNum} failed:`, err)
      const idx = pageRaws.value.findIndex(r => r.pageNum === p.pageNum)
      if (idx >= 0) pageRaws.value[idx] = { ...p, ocrStatus: 'error' }
    }
    ocrProgress.value.current++
    regenerateHtml()
  }
  ocrProgress.value.status = 'done'
  console.log('[OCR] all done')
}

/** key 规范化：去标点 + 小写 —— 用于 OCR 容错匹配（如 contractTitle vs contract_title ） */
function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '')
}
function buildVarLookup() {
  const byKey = new Map<string, DraftVariable>()
  const byNorm = new Map<string, DraftVariable>()
  for (const v of fileVariables.value) {
    byKey.set(v.key, v)
    byNorm.set(normKey(v.key), v)
  }
  return { byKey, byNorm }
}

async function releaseTessWorker() {
  if (tessWorker) {
    try { await tessWorker.terminate() } catch { /* noop */ }
    tessWorker = null
  }
}

/* ------------------------------------------------------------ HTML 渲染管线
 * pdfPages 是 ref<PdfPageInfo[]>，但内部 html 字段需要根据
 *   - 原始 PDF textItems / OCR words
 *   - 变量列表（保存/确认后变化）
 *   - previewMode（review / final）
 * 实时生成。pageRaws 存原始数据，regenerateHtml() 在变量/mode 变化时重算 html。 */
interface PageRaw {
  pageNum: number
  source: 'pdf' | 'ocr'
  items: any[]                  // PDF: textContent.items；OCR: tesseract words
  viewport: { width: number; height: number }
  ocrStatus: 'pending' | 'done' | 'error' | null
  imgUrl?: string                // canvas 渲染的整页图片 object URL
}
const pageRaws = ref<PageRaw[]>([])

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** 单个 token 在不同 mode 下的显示文本 */
function tokenDisplayHtml(v: DraftVariable | null, key: string, previewMode: 'review' | 'final'): string {
  if (!v) return previewMode === 'final' ? '' : `{{${key}}}`
  if (v.action === 'delete' || v.action === 'notused') return previewMode === 'final' ? '' : '×'
  const r = (v.result || v.choice || v.value || '').trim()
  if (r && (previewMode === 'final' || v.confirmed)) return escapeHtml(r)
  return `{{${key}}}`
}

function tokenCssClass(v: DraftVariable | null): string {
  if (!v) return 'tok-unknown'
  if (v.action === 'delete' || v.action === 'notused') return 'tok-deleted'
  if (v.confirmed && (v.result || v.value || v.choice)) return 'tok-ok'
  if (v.confirmed) return 'tok-ok-empty'
  return 'tok-warn'
}

/** PDF.js text items → 变量 overlay HTML。
 *  正文已由 canvas 图片呈现；这里只找 {{KEY}} token，按 PDF 坐标生成绝对定位的 .hit 徽标。
 *  同一行内按 reading order 拼接，并记录每个 item 在拼接串中的偏移，用于反查 token 的 x/宽度。 */
function textItemsToHtml(
  items: any[],
  viewport: { width: number; height: number },
  byKey: Map<string, DraftVariable>,
  byNorm: Map<string, DraftVariable>,
  previewMode: 'review' | 'final'
): { html: string; hasTokens: boolean } {
  type Cell = { str: string; x: number; y: number; w: number; h: number }
  const cells: Cell[] = []
  for (const it of items) {
    if (!it.str) continue
    const t = it.transform
    cells.push({
      str: it.str,
      x: t[4] * PDF_SCALE,
      y: viewport.height - t[5] * PDF_SCALE,   // baseline 的 CSS y
      w: (it.width ?? 0) * PDF_SCALE,
      h: (it.height ?? 0) * PDF_SCALE,
    })
  }

  // 按 y 分行（容差 4px）
  const tolY = 4
  const lines: Cell[][] = []
  for (const c of cells) {
    const last = lines[lines.length - 1]
    if (last && Math.abs((last[0].y + last[0].h / 2) - (c.y + c.h / 2)) < tolY) {
      last.push(c)
    } else {
      lines.push([c])
    }
  }
  lines.sort((a, b) => a[0].y - b[0].y)

  let html = ''
  let hasTokens = false
  for (const line of lines) {
    const baseline = line[0].y
    const maxH = Math.max(...line.map((c) => c.h)) || 10
    const fontSize = maxH * 0.85

    // 拼接行文本，同时记录每个 cell 的 [start, end) 偏移
    let joined = ''
    const spans: { start: number; end: number; cell: Cell }[] = []
    for (const c of line) {
      if (joined && !joined.endsWith(' ') && !c.str.startsWith(' ')) {
        joined += ' '
      }
      const start = joined.length
      joined += c.str
      spans.push({ start, end: joined.length, cell: c })
    }

    // 偏移 → x 坐标（cell 内按字符数等比插值）
    const charX = (offset: number): number => {
      for (const s of spans) {
        if (offset < s.end || (offset === s.end && s === spans[spans.length - 1])) {
          const rel = Math.max(0, Math.min(offset - s.start, s.cell.str.length))
          const ratio = s.cell.str.length ? rel / s.cell.str.length : 0
          return s.cell.x + s.cell.w * ratio
        }
      }
      return spans.length ? spans[spans.length - 1].cell.x + spans[spans.length - 1].cell.w : 0
    }

    // 只输出 {{KEY}} token span，普通文字不渲染到 overlay（正文已由 canvas 图片显示）
    const tokenRe = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g
    let m: RegExpExecArray | null
    while ((m = tokenRe.exec(joined)) !== null) {
      const key = m[1]
      const off = m.index
      const v = byKey.get(key) ?? byNorm.get(normKey(key)) ?? null
      hasTokens = true
      const text = tokenDisplayHtml(v, key, previewMode)
      const cls = tokenCssClass(v)
      const left = charX(off)
      const right = charX(off + m[0].length)
      const width = Math.max(right - left, fontSize * 0.8)
      const top = Math.max(0, baseline - maxH * 1.05)
      // 空文本（删除类变量在 final 模式）→ 用 &nbsp; 撑起白底遮盖原文
      const inner = text || '&nbsp;'
      html += `<span class="hit ${cls}" data-hit-var="${escapeHtml(key)}" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;min-width:${width.toFixed(1)}px;font-size:${fontSize.toFixed(1)}px;">${inner}</span>`
    }
  }

  return { html, hasTokens }
}

/** OCR words → HTML 行（与 textItemsToHtml 类似） */
function ocrWordsToHtml(
  words: any[],
  byKey: Map<string, DraftVariable>,
  byNorm: Map<string, DraftVariable>,
  previewMode: 'review' | 'final',
  viewport: { width: number; height: number }
): { html: string; height: number } {
  const tolY = 8
  const lines: any[][] = []
  for (const w of words) {
    if (!w.text || !w.bbox) continue
    const wcy = (w.bbox.y0 + w.bbox.y1) / 2
    const last = lines[lines.length - 1]
    if (last) {
      const lastCy = (last[0].bbox.y0 + last[0].bbox.y1) / 2
      if (Math.abs(lastCy - wcy) < tolY) {
        last.push(w)
        continue
      }
    }
    lines.push([w])
  }
  lines.forEach((line) => line.sort((a, b) => a.bbox.x0 - b.bbox.x0))
  lines.sort((a, b) => a[0].bbox.y0 - b[0].bbox.y0)

  let html = ''
  let pageMaxBottom = 0
  for (const line of lines) {
    const top = Math.min(...line.map((w) => w.bbox.y0))
    const bottom = Math.max(...line.map((w) => w.bbox.y1))
    const maxH = bottom - top
    const fontSize = maxH * 0.85
    const lineHeight = maxH * 1.3

    let joined = ''
    let prevEnd: number | null = null
    for (const w of line) {
      if (prevEnd !== null) {
        const gap = w.bbox.x0 - prevEnd
        if (gap > 4) joined += ' '
      }
      joined += w.text
      prevEnd = w.bbox.x1
    }

    const lineHtml = joined.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => {
      const v = byKey.get(key) ?? byNorm.get(normKey(key)) ?? null
      const text = tokenDisplayHtml(v, key, previewMode)
      if (!text) return ''
      const cls = tokenCssClass(v)
      return `<span class="hit ${cls}" data-hit-var="${escapeHtml(key)}">${text}</span>`
    })

    // 绝对定位：OCR bbox 顶（视觉顶部）
    html += `<div class="doc-line" style="top:${top.toFixed(1)}px;font-size:${fontSize.toFixed(1)}px;line-height:${lineHeight.toFixed(1)}px;">${lineHtml}</div>`
    pageMaxBottom = Math.max(pageMaxBottom, bottom)
  }

  return { html, height: Math.max(pageMaxBottom + 20, viewport.height) }
}

/** 根据 pageRaws + 变量 + previewMode 重算所有页的 overlay html（正文始终是 canvas 图片） */
function regenerateHtml() {
  if (!pageRaws.value.length) {
    pdfPages.value = []
    return
  }
  const varsByKey = buildVarLookup()
  pdfPages.value = pageRaws.value
    .slice()
    .sort((a, b) => a.pageNum - b.pageNum)
    .map((raw) => {
      let html = ''
      let hasTokens = false
      if (raw.source === 'pdf') {
        const r = textItemsToHtml(
          raw.items, raw.viewport, varsByKey.byKey, varsByKey.byNorm, previewMode.value)
        html = r.html
        hasTokens = r.hasTokens
      } else {
        const r = ocrWordsToHtml(
          raw.items, varsByKey.byKey, varsByKey.byNorm, previewMode.value, raw.viewport)
        html = r.html
      }
      return {
        pageNum: raw.pageNum,
        width: raw.viewport.width,
        height: raw.viewport.height,
        imgUrl: raw.imgUrl ?? '',
        html,
        ocrStatus: hasTokens ? null : raw.ocrStatus,
      }
    })
}

/** 监听变量和 previewMode 变化 → 重新生成 html（响应式） */
watch([variables, previewMode], () => regenerateHtml(), { deep: true })

watch(
  [activeFile, projectId],
  () => {
    loadPdf()
  },
  { immediate: true }
)
// 变量列表 / previewMode 变化已在 regenerateHtml() 的 watch 里统一处理

onBeforeUnmount(releasePdf)

/** 审阅调整点：默认列出当前文件未确认的变量；全部确认后回退为列表，便于回归检查 */
const reviewableVars = computed(() => {
  const all = fileVariables.value
  const pending = all.filter((v) => !v.confirmed)
  return pending.length ? pending : all
})

/** 当前临时高亮的变量（点击变量行 / 审阅点定位时设置，1.4s 后自动清掉） */
const flashTokenKey = ref<string | null>(null)
let flashTimer: number | null = null
/** 循环定位计数器：同一 key 再次点 → 跳到下一个匹配 */
let lastLocateKey = ''
let lastLocateIdx = -1

/**
 * 定位到 PDF 中变量的影响点（DOM-native 版）：
 *  - 用 querySelectorAll 拿所有 [data-hit-var="KEY"] 节点
 *  - 多次出现时同 key 二次点击循环到下一处（opts.cycle）
 *  - 原生 scrollIntoView({block:'center'}) 自动算坐标
 *  - 直接 DOM 操作类名（绕开 vue 响应式开销）
 *  - 左栏变量卡 scrollIntoView（如果不在视野内）
 */
async function locateTokenInEditor(variableKey: string, opts?: { cycle?: boolean }) {
  console.log('[locate] start key=', variableKey, 'opts=', opts)
  selectedDocVarKey.value = variableKey
  // 左栏变量卡闪烁（响应式，vue 自己处理）
  if (flashTimer) clearTimeout(flashTimer)
  flashTokenKey.value = variableKey
  flashTimer = window.setTimeout(() => {
    flashTokenKey.value = null
    flashTimer = null
  }, 1400)

  await nextTick()
  const container = pdfScrollContainer.value
  if (!container) {
    console.warn('[locate] pdfScrollContainer 为空，PDF 还没渲染?')
    return
  }

  // 联动左栏：把对应变量卡滚到视野内
  const card = document.querySelector<HTMLElement>(`.doc-var-card[data-key="${cssEscapeIdent(variableKey)}"]`)
  card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })

  // 等 DOM 就绪（OCR 进行中的页面 token 还没渲染）
  const sel = `.hit[data-hit-var="${cssEscapeIdent(variableKey)}"]`
  const MAX_MS = 30000, POLL_MS = 400
  let waitedMs = 0
  let els: HTMLElement[] = []
  while (waitedMs <= MAX_MS) {
    els = Array.from(container.querySelectorAll<HTMLElement>(sel))
    if (els.length) break
    const stillRunning = pdfPages.value.some((p) => p.ocrStatus === 'pending') ||
      ocrProgress.value.status === 'running' || ocrProgress.value.status === 'loading'
    if (!stillRunning && waitedMs > 1500) break
    await new Promise((r) => setTimeout(r, POLL_MS))
    waitedMs += POLL_MS
    await nextTick()
  }
  if (!els.length) {
    console.warn(`[locate] key=${variableKey} 等了 ${waitedMs}ms 仍未在 PDF 中找到节点。` +
      `pdfPages=${pdfPages.value.length} 页，pending=${pdfPages.value.filter(p => p.ocrStatus === 'pending').length} 页，ocrStatus=${ocrProgress.value.status}`)
    return
  }

  // 计算循环 idx
  let idx = 0
  if (opts?.cycle && lastLocateKey === variableKey && els.length > 1) {
    idx = (lastLocateIdx + 1) % els.length
  }
  lastLocateKey = variableKey
  lastLocateIdx = idx

  // DOM 直接加类：所有匹配 hit-all，当前 hit-current + flash
  els.forEach((el, k) => {
    el.classList.add('hit-all')
    el.classList.toggle('hit-current', k === idx)
    if (k === idx) {
      el.classList.add('flash')
      window.setTimeout(() => el.classList.remove('flash'), 1400)
    }
  })
  console.log(`[locate] key=${variableKey} 等了 ${waitedMs}ms，共 ${els.length} 处，定位 #${idx + 1}`)

  // 原生滚动：浏览器自动算坐标
  els[idx].scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** PDF 容器反向联动：点 overlay token → 联动左栏 */
function onPdfOverlayClick(e: MouseEvent) {
  const hit = (e.target as HTMLElement | null)?.closest('[data-hit-var]')
  if (!hit) return
  const key = hit.getAttribute('data-hit-var')
  if (key) void locateTokenInEditor(key, { cycle: true })
}

/** CSS.escape polyfill（保证变量 key 中的特殊字符在 querySelector 中安全） */
function cssEscapeIdent(s: string): string {
  if (typeof (window as any).CSS?.escape === 'function') return (window as any).CSS.escape(s)
  return s.replace(/([^\w-])/g, '\\$1')
}

// ESC 退出专注模式
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (matrixFullscreen.value) matrixFullscreen.value = false
    else if (focusMode.value) focusMode.value = false
  }
}

async function confirmAll(scope: 'BASE' | 'FILE') {
  const fileKey = scope === 'FILE' ? activeFile.value : undefined
  confirmingFile.value = true
  try {
    variables.value = await draftingApi.confirmAll(projectId.value, scope, fileKey)
    progress.value = await draftingApi.progress(projectId.value)
    store.notify(
      scope === 'FILE'
        ? t('drafting.files.confirmFileDone').replace('@FILE@', fileKey ?? '')
        : t('common.confirmAll')
    )
  } finally {
    confirmingFile.value = false
  }
}

async function generate() {
  if (!progress.value?.allReady) {
    store.notify(t('drafting.gates.needAll'))
    return
  }
  generating.value = true
  store.setBusy(t('drafting.files.generating'))
  try {
    documents.value = await draftingApi.generate(projectId.value, store.locale)
    progress.value = await draftingApi.progress(projectId.value)
    store.notify(t('common.done'))
  } finally {
    generating.value = false
    store.clearBusy()
  }
}

async function download(fileKey: string) {
  await draftingApi.download(projectId.value, fileKey, `ConSense_${fileKey}.md`)
}

/** 下载生成稿 PDF（后端 preview.pdf；未生成时回退标准模板 PDF） */
async function downloadPdf(fileKey: string) {
  const doc = documents.value.find((d) => d.fileKey === fileKey && d.generated)
  const url = doc
    ? `/drafting/${projectId.value}/documents/${fileKey}/preview.pdf`
    : `/drafting/${projectId.value}/templates/${fileKey}/preview.pdf`
  if (!doc) store.notify(t('drafting.files.downloadTemplateHint'))
  await api.download(url, `ConSense_${fileKey}.pdf`)
}

async function runTask(busyMessage: string, task: () => Promise<void>) {
  store.setBusy(busyMessage)
  try {
    await task()
  } finally {
    store.clearBusy()
  }
}

/* ---------------- 变量渲染辅助 ---------------- */

function listRows(variable: DraftVariable): string[][] {
  try {
    const parsed = JSON.parse(variable.value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((row) => (Array.isArray(row) ? row.map(String) : [String(row)]))
  } catch {
    return []
  }
}

function updateListRow(variable: DraftVariable, rowIndex: number, colIndex: number, value: string) {
  const rows = listRows(variable)
  if (!rows[rowIndex]) return
  rows[rowIndex][colIndex] = value
  variable.value = JSON.stringify(rows)
}

function listValues(variable: DraftVariable): string[] {
  try {
    const parsed = JSON.parse(variable.value || '[]')
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : []
  } catch {
    return []
  }
}

function updateListValue(variable: DraftVariable, index: number, value: string) {
  const values = listValues(variable)
  values[index] = value
  variable.value = JSON.stringify(values)
}

function removeListValue(variable: DraftVariable, index: number) {
  const values = listValues(variable)
  values.splice(index, 1)
  variable.value = JSON.stringify(values)
}

function addListValue(variable: DraftVariable) {
  const values = listValues(variable)
  values.push('')
  variable.value = JSON.stringify(values)
}

function actionTag(action: string | null) {
  switch (action) {
    case 'delete':
      return { label: t('drafting.actions.delete'), cls: 'act-del' }
    case 'notused':
      return { label: t('drafting.actions.notused'), cls: 'act-nu' }
    case 'choice':
      return { label: t('drafting.actions.choice'), cls: 'act-ch' }
    case 'rewrite':
      return { label: t('drafting.actions.rewrite'), cls: 'act-rw' }
    default:
      return { label: t('drafting.actions.fill'), cls: 'act-fl' }
  }
}

// ------------------------------------------------------------ 第 3 步：分文件确认与预览
function fileVarsOf(key: string) {
  return variables.value.filter((item) => item.scope === 'FILE' && item.fileKey === key)
}
function fileDoneOf(key: string) {
  return fileVarsOf(key).filter((item) => item.confirmed).length
}

/** 变量影响关系矩阵：行 = 变量，列 = NTT / SCT / SCC */
const matrixRows = computed(() => {
  const rows: { key: string; label: string; scope: string; action: string; value: string; cells: Record<string, boolean> }[] = []
  for (const v of variables.value) {
    const cells: Record<string, boolean> = {}
    if (v.scope === 'BASE') {
      const affects = v.affects.length ? v.affects : ['NTT', 'SCT', 'SCC']
      for (const f of affects) cells[f] = true
    } else if (v.fileKey) {
      cells[v.fileKey] = true
    }
    if (!Object.keys(cells).length) continue
    rows.push({
      key: v.key,
      label: pick(v.label),
      scope: v.scope,
      action: v.action,
      value: v.value,
      cells
    })
  }
  return rows
})

/* ------------------------------------------------------------ 变量影响关系 · 桑基图（FR-D-32） */
const sankeySearch = ref('')
const sankeyFileFilter = ref<string | null>(null)   // null = 全部落点
const sankeySelected = ref<string | null>(null)      // 选中的变量 key
const matrixFullscreen = ref(false)
const matrixView = ref<'graph' | 'table'>('graph')

const SANKEY_ACTION_ORDER = ['delete', 'notused', 'choice', 'rewrite', 'fill']
const SANKEY_FILES = ['NTT', 'SCT', 'SCC']

const sankeyVariables = computed(() => {
  const query = sankeySearch.value.trim().toLowerCase()
  return matrixRows.value.filter((row) => {
    if (sankeyFileFilter.value && !row.cells[sankeyFileFilter.value]) return false
    if (query && !(row.label.toLowerCase().includes(query) || row.key.toLowerCase().includes(query))) return false
    return true
  })
})

interface SankeyNode {
  id: string
  kind: 'var' | 'action' | 'file'
  label: string
  sub?: string
  x: number
  y: number
  w: number
  h: number
  confirmed?: boolean
  varKey?: string
  fileKey?: string
}
interface SankeyLink {
  id: string
  varKey: string
  fileKey: string
  action: string
  d: string
}

/** 三列桑基布局：变量 → 改写动作（聚合）→ 文件落点。链路为三次贝塞尔曲线。 */
const sankeyGeom = computed(() => {
  const vars = sankeyVariables.value
  const VAR_H = 24
  const VAR_GAP = 6
  const NODE_GAP = 16
  const PAD = 14
  const xVar = 12, wVar = 190
  const xAct = 400, wAct = 128
  const xFile = 736, wFile = 120

  const nodes: SankeyNode[] = []
  const varLinks: SankeyLink[] = []
  const fileLinks: SankeyLink[] = []

  if (!vars.length) {
    return { nodes, varLinks, fileLinks, width: xFile + wFile + 12, height: 90 }
  }

  // 1) 变量列
  const varY = new Map<string, number>()
  vars.forEach((row, i) => {
    const y = PAD + i * (VAR_H + VAR_GAP)
    varY.set(row.key, y)
    nodes.push({
      id: `var:${row.key}`,
      kind: 'var',
      label: row.label,
      sub: row.key,
      x: xVar, y, w: wVar, h: VAR_H,
      confirmed: variables.value.find((v) => v.key === row.key)?.confirmed,
      varKey: row.key
    })
  })
  const contentH = vars.length * (VAR_H + VAR_GAP) - VAR_GAP + PAD * 2

  // 2) 动作列（按动作聚合，高度与变量数成正比）
  const byAction = new Map<string, typeof vars>()
  for (const row of vars) {
    const action = SANKEY_ACTION_ORDER.includes(row.action) ? row.action : 'fill'
    if (!byAction.has(action)) byAction.set(action, [])
    byAction.get(action)!.push(row)
  }
  const actionOrder = SANKEY_ACTION_ORDER.filter((a) => byAction.has(a))
  const actionY = new Map<string, number>()
  const actionH = new Map<string, number>()
  let cursor = PAD
  for (const action of actionOrder) {
    const group = byAction.get(action)!
    const h = Math.max(VAR_H, group.length * VAR_H)
    actionY.set(action, cursor)
    actionH.set(action, h)
    nodes.push({
      id: `act:${action}`,
      kind: 'action',
      label: actionTag(action).label,
      sub: String(group.length),
      x: xAct, y: cursor, w: wAct, h
    })
    cursor += h + NODE_GAP
  }
  const height = Math.max(contentH, cursor - NODE_GAP + PAD)

  // 3) 变量 → 动作链路（动作节点内按变量顺序占槽）
  for (const row of vars) {
    const action = SANKEY_ACTION_ORDER.includes(row.action) ? row.action : 'fill'
    const group = byAction.get(action)!
    const slot = group.indexOf(row)
    const y0 = varY.get(row.key)! + VAR_H / 2
    const slotH = actionH.get(action)! / group.length
    const y1 = actionY.get(action)! + (slot + 0.5) * slotH
    const dx = (xAct - (xVar + wVar)) / 2
    varLinks.push({
      id: `vl:${row.key}:${action}`,
      varKey: row.key,
      fileKey: '',
      action,
      d: `M ${xVar + wVar} ${y0} C ${xVar + wVar + dx} ${y0}, ${xAct - dx} ${y1}, ${xAct} ${y1}`
    })
  }

  // 4) 文件列 + 动作 → 文件链路
  const fileCount = new Map<string, number>()
  for (const row of vars) {
    for (const f of SANKEY_FILES) if (row.cells[f]) fileCount.set(f, (fileCount.get(f) ?? 0) + 1)
  }
  const presentFiles = SANKEY_FILES.filter((f) => fileCount.has(f))
  const fileY = new Map<string, number>()
  const fileH = new Map<string, number>()
  cursor = PAD
  for (const f of presentFiles) {
    const h = Math.max(VAR_H, (fileCount.get(f) ?? 0) * VAR_H)
    fileY.set(f, cursor)
    fileH.set(f, h)
    nodes.push({
      id: `file:${f}`,
      kind: 'file',
      label: f,
      sub: `×${fileCount.get(f)}`,
      x: xFile, y: cursor, w: wFile, h,
      fileKey: f
    })
    cursor += h + NODE_GAP * 2
  }

  // 动作 → 文件链路：源槽按动作节点内的变量槽位，目标槽按变量顺序在文件节点内累加
  const fileSlot = new Map<string, number>()            // file → 已占槽计数
  for (const row of vars) {
    const action = SANKEY_ACTION_ORDER.includes(row.action) ? row.action : 'fill'
    const group = byAction.get(action)!
    const slot = group.indexOf(row)
    const slotH = actionH.get(action)! / group.length
    const y0 = actionY.get(action)! + (slot + 0.5) * slotH
    for (const f of presentFiles) {
      if (!row.cells[f]) continue
      const used = fileSlot.get(f) ?? 0
      fileSlot.set(f, used + 1)
      const fh = fileH.get(f)! / (fileCount.get(f) ?? 1)
      const y1 = fileY.get(f)! + (used + 0.5) * fh
      const dx = (xFile - (xAct + wAct)) / 2
      fileLinks.push({
        id: `fl:${row.key}:${f}`,
        varKey: row.key,
        fileKey: f,
        action,
        d: `M ${xAct + wAct} ${y0} C ${xAct + wAct + dx} ${y0}, ${xFile - dx} ${y1}, ${xFile} ${y1}`
      })
    }
  }

  return { nodes, varLinks, fileLinks, width: xFile + wFile + 12, height: Math.max(height, cursor - NODE_GAP * 2 + PAD) }
})

const sankeySelectedVar = computed(() => {
  const key = sankeySelected.value
  if (!key) return null
  return variables.value.find((v) => v.key === key) ?? null
})

function sankeyLinkClass(link: SankeyLink): string {
  if (!sankeySelected.value) return ''
  return link.varKey === sankeySelected.value ? 'on' : 'dim'
}

function sankeyNodeClass(node: SankeyNode): string[] {
  const cls: string[] = []
  if (node.kind === 'var') {
    if (node.confirmed) cls.push('confirmed')
    if (sankeySelected.value) cls.push(node.id === `var:${sankeySelected.value}` ? 'on' : 'dim')
  } else if (node.kind === 'file') {
    if (sankeyFileFilter.value === node.fileKey) cls.push('on')
    if (sankeySelected.value) cls.push('dim')
  } else if (sankeySelected.value) {
    const selVar = sankeySelectedVar.value
    const selAction = selVar ? (SANKEY_ACTION_ORDER.includes(selVar.action) ? selVar.action : 'fill') : ''
    cls.push(node.id === `act:${selAction}` ? 'on' : 'dim')
  }
  return cls
}

function onSankeyVar(key: string) {
  sankeySelected.value = sankeySelected.value === key ? null : key
}

function onSankeyFile(fileKey: string) {
  sankeyFileFilter.value = sankeyFileFilter.value === fileKey ? null : fileKey
}

function clearSankey() {
  sankeySelected.value = null
  sankeySearch.value = ''
  sankeyFileFilter.value = null
}

/** 从关系图跳到对应文件的变量卡（并联动 PDF 定位） */
function gotoVarFile() {
  const v = sankeySelectedVar.value
  if (!v) return
  const target = v.scope === 'FILE' && v.fileKey ? v.fileKey : (v.affects[0] ?? 'NTT')
  if (draftFileKeys.includes(target)) {
    sankeySelected.value = null
    matrixFullscreen.value = false
    activeFile.value = target
    selectedDocVarKey.value = v.key
    void locateTokenInEditor(v.key)
  }
}

function truncateSvg(text: string, max = 22): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

/** PDF 中识别出的 {{KEY}} 数量 / 命中变量数 / 当前文件变量数（用于头部诊断条） */
const pdfTokenCount = computed(() => {
  let n = 0
  for (const p of pdfPages.value) {
    // 用正则统计 .hit[data-hit-var] 节点
    const matches = p.html.match(/data-hit-var="[^"]+"/g)
    n += matches ? matches.length : 0
  }
  return n
})
const pdfMatchedCount = computed(() => {
  const keys = new Set(variables.value.map((v) => v.key))
  let n = 0
  for (const p of pdfPages.value) {
    const matches = p.html.match(/data-hit-var="([^"]+)"/g) ?? []
    for (const m of matches) {
      const k = m.match(/data-hit-var="([^"]+)"/)![1]
      if (keys.has(k)) n++
    }
  }
  return n
})
const pdfDiagText = computed(() =>
  t('drafting.files.pdfDiag')
    .replace('@TOKENS@', String(pdfTokenCount.value))
    .replace('@MATCHED@', String(pdfMatchedCount.value))
    .replace('@VARS@', String(fileVariables.value.length))
)

function selectDocVar(key: string) {
  if (selectedDocVarKey.value === key) {
    selectedDocVarKey.value = null
    return
  }
  selectedDocVarKey.value = key
  // 点击左栏变量卡 → 同步触发 PDF 滚动 + overlay 闪烁
  void locateTokenInEditor(key)
}

async function saveVarConfirm(variable: DraftVariable) {
  await saveVariable(variable, { confirmed: !variable.confirmed })
}

</script>

<template>
  <section class="screen">
    <div class="screen-head">
      <div>
        <span class="eyebrow">{{ t('screen.drafting') }}</span>
        <h3>{{ t('drafting.title') }}</h3>
        <p>{{ t('drafting.subtitle') }}</p>
      </div>
      <div class="row">
        <span v-if="store.activeProject" class="pill mono">{{ store.activeProject.contractNo }}</span>
        <button class="btn" type="button" :disabled="loading" @click="reload">
          <AppIcon name="refresh" :size="15" />{{ t('common.refresh') }}
        </button>
      </div>
    </div>

    <div class="surface">
      <!-- 向导步骤 -->
      <div class="wizard-steps">
        <button
          v-for="(item, index) in steps"
          :key="item.key"
          type="button"
          class="wizard-step"
          :class="{ active: step === item.key, done: item.done }"
          @click="gotoStep(item.key as Step)"
        >
          <span class="step-index">
            <AppIcon v-if="item.done" name="check" :size="13" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span class="step-copy">
            <strong>{{ item.title }}</strong>
            <span>{{ item.desc }}</span>
          </span>
        </button>
      </div>

      <div class="surface-body">
        <!-- ---------------------------------------- 第 1 步 -->
        <div v-if="step === 'inputs'" class="wizard-panel">
          <div class="source-library">
            <div class="library-block">
              <div class="library-head">
                <div>
                  <strong>{{ t('drafting.templates.title') }}</strong>
                  <p>{{ t('drafting.templates.desc') }}</p>
                </div>
                <div class="row">
                  <input
                    ref="templateInput"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.md"
                    class="hidden"
                    @change="uploadTemplates"
                  />
                  <input
                    ref="templateReplaceInput"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md"
                    class="hidden"
                    @change="replaceTemplate"
                  />
                  <button class="btn" type="button" @click="templateInput?.click()">
                    <AppIcon name="upload" :size="15" />{{ t('drafting.templates.upload') }}
                  </button>
                  <button
                    v-if="variables.length"
                    class="btn"
                    type="button"
                    :title="t('drafting.templates.blankHint')"
                    @click="downloadBlankTemplate()"
                  >
                    <AppIcon name="download" :size="14" />{{ t('drafting.templates.blank') }}
                  </button>
                </div>
              </div>
              <div class="template-feed">
                <div v-for="item in templates" :key="item.key" class="template-item">
                  <div class="meta">
                    <strong>{{ pick(item.label) }}</strong>
                    <div class="template-meta">
                      <span class="mono">{{ item.fileName }}</span>
                      <span class="tag" :class="item.tag">{{ pick(item.status) }}</span>
                    </div>
                    <div class="template-meta">{{ pick(item.note) }}</div>
                  </div>
                  <div class="template-actions">
                    <button
                      class="btn"
                      type="button"
                      :title="t('drafting.templates.replace') + ' ' + item.key"
                      @click="startReplaceTemplate(item.key)"
                    >
                      <AppIcon name="upload" :size="14" />
                      {{ t('drafting.templates.replace') }} {{ item.key }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="library-block">
              <div class="library-head">
                <div>
                  <strong>{{ t('drafting.inputs.title') }}</strong>
                  <p>{{ t('drafting.inputs.desc') }}</p>
                </div>
                <div class="row">
                  <input
                    ref="evidenceInput"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.eml,.msg,.txt,.md"
                    class="hidden"
                    @change="uploadInputs"
                  />
                  <button class="btn" type="button" @click="evidenceInput?.click()">
                    <AppIcon name="upload" :size="15" />{{ t('drafting.inputs.upload') }}
                  </button>
                </div>
              </div>

              <div v-if="!inputs.length" class="empty-state">{{ t('common.empty') }}</div>
              <div v-else class="input-feed">
                <div v-for="item in inputs" :key="item.code" class="input-item">
                  <div class="meta">
                    <strong>{{ pick(item.title) }}</strong>
                    <div class="input-meta">
                      <span class="tag" :class="item.tag">{{ item.status }}</span>
                      <span class="tag neutral">
                        <AppIcon name="file" :size="12" />{{ pick(item.type) }}
                      </span>
                      <span v-if="item.ocrUsed" class="tag warn">OCR</span>
                      <span v-if="item.pageCount">{{ item.pageCount }}p</span>
                    </div>
                    <div class="input-meta">{{ pick(item.body) }}</div>
                  </div>
                  <div class="input-actions">
                    <button
                      class="btn icon-only danger"
                      type="button"
                      :title="t('common.delete')"
                      @click="askDeleteInput(item)"
                    >
                      <AppIcon name="trash" :size="15" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="wizard-actions">
            <span class="muted small">{{ t('drafting.variables.extractHint') }}</span>
            <div class="row">
              <button class="btn" type="button" :disabled="extracting || !canLeaveInputs" @click="extract">
                <AppIcon name="wand" :size="15" />
                {{ extracting ? t('drafting.variables.extracting') : t('drafting.variables.extract') }}
              </button>
              <button v-if="trace" class="btn soft" type="button" @click="traceOpen = true">
                <AppIcon name="info" :size="15" />
                {{ t('drafting.variables.traceButton') }}
              </button>
              <button class="btn primary" type="button" @click="gotoStep('base')">
                {{ t('common.next') }}<AppIcon name="arrowRight" :size="15" />
              </button>
            </div>
          </div>
        </div>

        <!-- ---------------------------------------- 第 2 步 -->
        <div v-else-if="step === 'base'" class="wizard-panel">
          <div class="surface-head" style="padding: 0 0 12px">
            <div>
              <h4>{{ t('drafting.variables.baseTitle') }}</h4>
              <p>
                {{ progress?.baseConfirmed ?? 0 }} / {{ progress?.baseTotal ?? 0 }} {{ t('common.confirmed') }}
              </p>
            </div>
            <button class="btn soft" type="button" @click="confirmAll('BASE')">
              <AppIcon name="check" :size="15" />{{ t('common.confirmAll') }}
            </button>
          </div>

          <div v-if="!baseVariables.length" class="empty-state">{{ canLeaveInputs ? t('drafting.variables.emptyReady') : t('drafting.variables.empty') }}</div>
          <div v-else class="base-var-list">
            <div v-for="variable in baseVariables" :key="variable.key" class="var-card">
              <div class="var-card-head">
                <div class="title">
                  <strong><span class="key">{{ variable.key }}</span>{{ pick(variable.label) }}</strong>
                </div>
                <div class="tags">
                  <span class="tag" :class="variable.confirmed ? 'ok' : 'warn'">
                    {{ variable.confirmed ? t('common.confirmed') : t('common.unconfirmed') }}
                  </span>
                  <span v-if="variable.affects.length" class="tag neutral">{{ variable.affects.join(' · ') }}</span>
                </div>
              </div>

              <!-- 清单型变量 -->
              <template v-if="variable.kind === 'list' && variable.cols.length">
                <div class="table-wrap">
                  <table class="var-list-table">
                    <thead>
                      <tr>
                        <th v-for="col in variable.cols" :key="col">{{ col }}</th>
                        <th style="width: 60px" />
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, rowIndex) in listRows(variable)" :key="rowIndex">
                        <td v-for="(col, colIndex) in variable.cols" :key="col">
                          <input
                            :value="row[colIndex] ?? ''"
                            @change="
                              updateListRow(variable, rowIndex, colIndex, ($event.target as HTMLInputElement).value);
                              saveVariable(variable, { value: variable.value, confirmed: true })
                            "
                          />
                        </td>
                        <td>
                          <span class="tag ok">{{ t('common.confirmed') }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>

              <!-- 字符串清单 -->
              <template v-else-if="variable.kind === 'list'">
                <div v-for="(value, index) in listValues(variable)" :key="index" class="row" style="margin-bottom: 6px">
                  <input
                    style="flex: 1"
                    :value="value"
                    @change="
                      updateListValue(variable, index, ($event.target as HTMLInputElement).value);
                      saveVariable(variable, { value: variable.value, confirmed: true })
                    "
                  />
                  <button
                    class="btn icon-only danger"
                    type="button"
                    @click="removeListValue(variable, index); saveVariable(variable, { value: variable.value })"
                  >
                    <AppIcon name="trash" :size="15" />
                  </button>
                </div>
                <button class="btn" type="button" @click="addListValue(variable); saveVariable(variable, { value: variable.value })">
                  <AppIcon name="plus" :size="15" />{{ t('common.add') }}
                </button>
              </template>

              <!-- 普通取值 -->
              <div v-else class="var-field">
                <label>{{ t('drafting.variables.value') }}</label>
                <div class="row">
                  <!-- choice 型 → 下拉选择（是/否 等固定选项） -->
                  <select
                    v-if="variable.options.length"
                    class="doc-var-select"
                    style="flex: 1"
                    :value="variable.choice || variable.value"
                    @change="saveVariable(variable, { choice: ($event.target as HTMLSelectElement).value, confirmed: true })"
                  >
                    <option v-for="option in variable.options" :key="option.zhHans" :value="option[currentKey]">
                      {{ pick(option) }}
                    </option>
                  </select>
                  <input
                    v-else
                    style="flex: 1"
                    :value="variable.value"
                    @change="saveVariable(variable, { value: ($event.target as HTMLInputElement).value, confirmed: true })"
                  />
                  <button
                    class="btn"
                    :class="{ soft: variable.confirmed }"
                    type="button"
                    @click="saveVariable(variable, { confirmed: !variable.confirmed })"
                  >
                    <AppIcon name="check" :size="15" />
                    {{ variable.confirmed ? t('common.confirmed') : t('common.confirm') }}
                  </button>
                </div>
              </div>

              <div v-if="variable.note" class="var-hint">{{ variable.note }}</div>
              <div v-if="variable.source" class="var-hint">
                {{ t('drafting.variables.source') }}: {{ variable.source }}
              </div>
            </div>
          </div>

          <div class="wizard-actions">
            <button class="btn" type="button" @click="gotoStep('inputs')">
              <AppIcon name="arrowLeft" :size="15" />{{ t('common.back') }}
            </button>
            <button class="btn primary" type="button" @click="gotoStep('files')">
              {{ t('common.next') }}<AppIcon name="arrowRight" :size="15" />
            </button>
          </div>
        </div>

        <!-- ---------------------------------------- 第 3 步 · 分文件确认与预览 -->
        <div v-else class="wizard-panel file-step">
          <!-- 文件 tab：NTT / SCT / SCC（含确认计数） + 变量影响关系图 -->
          <div class="file-tabs main-tabs">
            <button
              v-for="key in draftFileKeys"
              :key="key"
              type="button"
              :class="{ active: activeFile === key }"
              @click="activeFile = key"
            >
              {{ key }}
              <span class="tab-count">{{ fileDoneOf(key) }}/{{ fileVarsOf(key).length }}</span>
            </button>
            <button
              type="button"
              :class="{ active: activeFile === 'MATRIX' }"
              @click="activeFile = 'MATRIX'"
            >
              <AppIcon name="layers" :size="14" />
              {{ t('drafting.files.matrix') }}
            </button>
          </div>

          <!-- 变量影响关系：桑基图（默认） / 矩阵表格 -->
          <div v-if="activeFile === 'MATRIX'" class="matrix-wrap" :class="{ fullscreen: matrixFullscreen }">
            <div class="matrix-toolbar">
              <input
                v-model="sankeySearch"
                type="text"
                class="matrix-search"
                :placeholder="t('drafting.files.sankeySearch')"
              />
              <div class="mode-switch" role="group">
                <button
                  v-for="f in ['NTT', 'SCT', 'SCC']"
                  :key="f"
                  type="button"
                  :class="{ active: sankeyFileFilter === f }"
                  @click="onSankeyFile(f)"
                >{{ f }}</button>
                <button
                  type="button"
                  :class="{ active: !sankeyFileFilter }"
                  @click="sankeyFileFilter = null"
                >{{ t('common.all') }}</button>
              </div>
              <div class="matrix-toolbar-right">
                <div class="mode-switch" role="group">
                  <button
                    type="button"
                    :class="{ active: matrixView === 'graph' }"
                    @click="matrixView = 'graph'"
                  >{{ t('drafting.files.viewGraph') }}</button>
                  <button
                    type="button"
                    :class="{ active: matrixView === 'table' }"
                    @click="matrixView = 'table'"
                  >{{ t('drafting.files.viewTable') }}</button>
                </div>
                <button class="btn" type="button" @click="clearSankey">
                  <AppIcon name="x" :size="14" />{{ t('drafting.files.sankeyClear') }}
                </button>
                <button class="btn" type="button" @click="matrixFullscreen = !matrixFullscreen">
                  <AppIcon :name="matrixFullscreen ? 'fullscreenExit' : 'fullscreen'" :size="14" />
                  {{ matrixFullscreen ? t('drafting.files.exitFocus') : t('drafting.files.sankeyFullscreen') }}
                </button>
              </div>
            </div>

            <!-- 图形视图：变量 → 改写动作 → 文件落点 三列桑基 -->
            <div v-if="matrixView === 'graph'" class="sankey-wrap">
              <div v-if="!sankeyVariables.length" class="empty-state">
                {{ t('drafting.files.sankeyEmpty') }}
              </div>
              <svg
                v-else
                class="sankey-svg"
                :viewBox="`0 0 ${sankeyGeom.width} ${sankeyGeom.height}`"
                preserveAspectRatio="xMidYMin meet"
              >
                <!-- 链路 -->
                <path
                  v-for="link in sankeyGeom.varLinks"
                  :key="link.id"
                  class="sankey-link"
                  :class="sankeyLinkClass(link)"
                  :d="link.d"
                />
                <path
                  v-for="link in sankeyGeom.fileLinks"
                  :key="link.id"
                  class="sankey-link file"
                  :class="sankeyLinkClass(link)"
                  :d="link.d"
                />
                <!-- 节点 -->
                <g
                  v-for="node in sankeyGeom.nodes"
                  :key="node.id"
                  class="sankey-node"
                  :class="sankeyNodeClass(node)"
                  :transform="`translate(${node.x}, ${node.y})`"
                  @click="node.kind === 'var' ? onSankeyVar(node.varKey!) : node.kind === 'file' ? onSankeyFile(node.fileKey!) : undefined"
                >
                  <rect :width="node.w" :height="node.h" rx="5" />
                  <text class="node-label" :x="9" :y="node.h / 2 - 2">
                    {{ node.kind === 'var' ? (node.confirmed ? '✓ ' : '· ') + truncateSvg(node.label) : node.label }}
                  </text>
                  <text v-if="node.sub && node.kind !== 'var'" class="node-sub" :x="9" :y="node.h / 2 + 11">
                    {{ node.sub }}
                  </text>
                  <text v-if="node.kind === 'var'" class="node-sub" :x="9" :y="node.h / 2 + 10">
                    {{ node.sub }}
                  </text>
                </g>
              </svg>

              <!-- 列标题 + 图例 -->
              <div class="sankey-cols" v-if="sankeyVariables.length">
                <span>{{ t('drafting.files.sankeyVars') }}</span>
                <span>{{ t('drafting.files.sankeyActions') }}</span>
                <span>{{ t('drafting.files.sankeyFiles') }}</span>
              </div>

              <!-- 选中变量详情 -->
              <div v-if="sankeySelectedVar" class="sankey-detail">
                <div class="sankey-detail-head">
                  <strong>{{ pick(sankeySelectedVar.label) }}</strong>
                  <span class="act-badge" :class="actionTag(sankeySelectedVar.action).cls">
                    {{ actionTag(sankeySelectedVar.action).label }}
                  </span>
                  <span class="tag" :class="sankeySelectedVar.confirmed ? 'ok' : 'warn'">
                    {{ sankeySelectedVar.confirmed ? t('common.confirmed') : t('common.unconfirmed') }}
                  </span>
                  <button class="btn primary" type="button" @click="gotoVarFile">
                    <AppIcon name="arrowRight" :size="14" />{{ t('drafting.files.sankeyGotoFile') }}
                  </button>
                </div>
                <div class="sankey-detail-body">
                  <div><b>{{ t('drafting.files.impactPoint') }}</b><span>{{ sankeySelectedVar.affects.join(' / ') || '—' }}</span></div>
                  <div><b>{{ t('drafting.files.valueLabel') }}</b><span>{{ sankeySelectedVar.result || sankeySelectedVar.choice || sankeySelectedVar.value || '—' }}</span></div>
                  <div v-if="sankeySelectedVar.note"><b>{{ t('drafting.files.sourceLabel') }}</b><span>{{ sankeySelectedVar.note }}</span></div>
                </div>
              </div>

              <div class="matrix-legend">
                <span>{{ t('drafting.files.sankeyLegend') }}</span>
              </div>
            </div>

            <!-- 表格视图（原有矩阵） -->
            <div v-else class="matrix-table">
              <table>
                <thead>
                  <tr>
                    <th style="min-width: 200px">{{ t('drafting.variables.fileTitle') }}</th>
                    <th v-for="key in draftFileKeys" :key="key">{{ key }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in matrixRows" :key="row.key">
                    <td>
                      <strong>{{ row.label }}</strong>
                      <span class="act-badge" :class="actionTag(row.action).cls">{{ actionTag(row.action).label }}</span>
                    </td>
                    <td
                      v-for="key in draftFileKeys"
                      :key="key"
                      :class="{ 'cell-empty': !row.cells[key] }"
                    >
                      <template v-if="row.cells[key]">
                        <span class="cell-anchor">{{ row.key }}</span>
                        <div class="cell-result">{{ row.value || '—' }}</div>
                      </template>
                      <template v-else>—</template>
                    </td>
                  </tr>
                  <tr v-if="!matrixRows.length">
                    <td :colspan="draftFileKeys.length + 1" class="cell-empty">
                      {{ t('drafting.variables.empty') }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div class="matrix-legend">
                <span>{{ t('drafting.files.matrixHint') }}</span>
              </div>
            </div>
          </div>

          <!-- 左右双栏：左 · 变量确认清单 / 右 · 文稿工作台 -->
          <div v-else class="doc-split" :class="{ 'is-focus': focusMode }">
            <!-- 左栏：变量确认 -->
            <div class="doc-pane">
              <div class="doc-pane-head">
                <strong>{{ activeFile }} {{ t('drafting.files.varChecklist') }}</strong>
                <div class="pane-head-actions">
                  <span class="tag" :class="fileVariables.length && fileDoneOf(activeFile) === fileVariables.length ? 'ok' : 'warn'">
                    {{ fileDoneOf(activeFile) }}/{{ fileVariables.length }}
                  </span>
                  <button
                    class="btn soft"
                    type="button"
                    :disabled="confirmingFile || !fileVariables.length"
                    @click="confirmAll('FILE')"
                  >
                    <AppIcon name="check" :size="14" />
                    {{ t('drafting.files.confirmFileAll') }}
                  </button>
                  <button class="btn" type="button" @click="focusMode = !focusMode">
                    <AppIcon :name="focusMode ? 'fullscreenExit' : 'fullscreen'" :size="14" />
                    {{ focusMode ? t('drafting.files.exitFocus') : t('drafting.files.focusMode') }}
                  </button>
                </div>
              </div>
              <div class="var-scroll">
                <div
                  v-for="variable in fileVariables"
                  :key="variable.key"
                  :data-key="variable.key"
                  class="doc-var-card"
                  :class="{
                    confirmed: variable.confirmed,
                    selected: selectedDocVarKey === variable.key,
                    flash: flashTokenKey === variable.key
                  }"
                  @click="selectDocVar(variable.key)"
                >
                  <div class="doc-var-title">
                    <div class="doc-var-title-main">
                      <strong>{{ pick(variable.label) }}</strong>
                      <span class="act-badge" :class="actionTag(variable.action).cls">
                        {{ actionTag(variable.action).label }}
                      </span>
                    </div>
                  </div>

                  <div class="doc-var-line">
                    <b>{{ t('drafting.files.impactPoint') }}</b>
                    <span class="rp-anchor">{{ variable.source || t('drafting.files.noAnchor') }}</span>
                    <span v-if="variable.affects.length > 1" class="tag info">
                      {{ t('drafting.files.sharedWith') }}
                      {{ variable.affects.filter((a) => a !== variable.fileKey).join(' / ') }}
                    </span>
                  </div>

                  <div v-if="variable.note" class="doc-var-line">
                    <b>{{ t('drafting.files.sourceLabel') }}</b>
                    <span>{{ variable.note }}</span>
                  </div>

                  <!-- 取值控件：choice → 下拉；rewrite → AI 建议稿；fill → 输入框 -->
                  <template v-if="variable.options.length">
                    <div class="doc-var-line">
                      <b>{{ t('drafting.files.valueLabel') }}</b>
                    </div>
                    <select
                      class="doc-var-select"
                      :value="variable.choice || variable.value"
                      @click.stop
                      @change="saveVariable(variable, { choice: ($event.target as HTMLSelectElement).value, confirmed: true })"
                    >
                      <option v-for="option in variable.options" :key="option.zhHans" :value="option[currentKey]">
                        {{ pick(option) }}
                      </option>
                    </select>
                  </template>
                  <template v-else-if="variable.action === 'rewrite'">
                    <div class="doc-var-line">
                      <b>{{ t('drafting.files.aiDraft') }}</b>
                    </div>
                    <textarea
                      rows="3"
                      :value="variable.value"
                      @click.stop
                      @change="saveVariable(variable, { value: ($event.target as HTMLTextAreaElement).value, confirmed: true })"
                    />
                  </template>
                  <template v-else>
                    <div class="doc-var-line">
                      <b>{{ t('drafting.files.valueLabel') }}</b>
                    </div>
                    <input
                      type="text"
                      :value="variable.value"
                      @click.stop
                      @change="saveVariable(variable, { value: ($event.target as HTMLInputElement).value, confirmed: true })"
                    />
                  </template>

                  <div class="doc-var-line">
                    <b>{{ t('drafting.files.resultLabel') }}</b>
                  </div>
                  <div class="doc-var-result">{{ variable.result || '—' }}</div>

                  <div class="doc-var-actions">
                    <span class="tag" :class="variable.confirmed ? 'ok' : 'warn'">
                      {{ variable.confirmed ? t('common.confirmed') : t('common.unconfirmed') }}
                    </span>
                    <button
                      class="btn"
                      :class="{ primary: !variable.confirmed }"
                      type="button"
                      @click.stop="saveVarConfirm(variable)"
                    >
                      <AppIcon name="check" :size="14" />
                      {{ variable.confirmed ? t('drafting.files.reedit') : t('common.confirm') }}
                    </button>
                  </div>
                </div>

                <div v-if="!fileVariables.length" class="rp-empty">
                  {{ canLeaveInputs ? t('drafting.variables.emptyReady') : t('drafting.variables.empty') }}
                </div>
              </div>
            </div>

            <!-- 右栏：标准模板 PDF（铺满整个右栏，doc/preview 双视图统一） + 审阅调整点抽屉 -->
            <div class="doc-pane">
              <div class="doc-pane-head">
                <strong>{{ activeFile }} · {{ t('drafting.files.headerTitle') }}</strong>
                <span v-if="pdfPages.length" class="pdf-diag">
                  {{ pdfDiagText }}
                </span>
                <span v-if="ocrProgress.status === 'loading'" class="pdf-ocr">
                  {{ t('drafting.files.ocrLoading') }}
                </span>
                <span v-else-if="ocrProgress.status === 'running'" class="pdf-ocr">
                  {{ t('drafting.files.ocrRunning').replace('@CURRENT@', String(ocrProgress.current)).replace('@TOTAL@', String(ocrProgress.total)) }}
                </span>
                <span v-else-if="ocrProgress.status === 'error'" class="pdf-ocr err">
                  {{ t('drafting.files.ocrError') }}
                </span>
                <div class="pane-head-actions">
                  <div class="mode-switch" role="group" :aria-label="t('drafting.files.previewMode')">
                    <button
                      type="button"
                      :class="{ active: previewMode === 'review' }"
                      @click="previewMode = 'review'"
                    >{{ t('drafting.files.modeReview') }}</button>
                    <button
                      type="button"
                      :class="{ active: previewMode === 'final' }"
                      @click="previewMode = 'final'"
                    >{{ t('drafting.files.modeFinal') }}</button>
                  </div>
                  <button
                    class="btn review-toggle"
                    :class="{ on: reviewPaneOpen }"
                    type="button"
                    :title="t('drafting.files.reviewToggleHint')"
                    @click="reviewPaneOpen = !reviewPaneOpen"
                  >
                    <AppIcon name="info" :size="14" />
                    {{ t('drafting.files.reviewToggle') }} ({{ fileVariables.length }})
                  </button>
                  <button class="btn" type="button" @click="download(activeFile)">
                    <AppIcon name="download" :size="14" />
                    {{ t('drafting.files.download') }} {{ activeFile }}
                  </button>
                  <button class="btn" type="button" :title="t('drafting.files.downloadPdfHint')" @click="downloadPdf(activeFile)">
                    <AppIcon name="download" :size="14" />
                    PDF
                  </button>
                </div>
              </div>
              <div class="doc-edit-wrap">
                <div class="doc-edit-pane">
                  <!-- PDF 铺满右栏：PDF.js canvas 多页 + overlay 替换变量；doc 与 preview 视图完全一致 -->
                  <div class="de-body">
                    <div class="de-preview-full">
                      <div v-if="pdfLoading" class="dt-loading">{{ t('common.loading') }}</div>
                      <div v-else-if="pdfError" class="dt-loading">{{ pdfError }}</div>
                      <div v-else-if="!pdfPages.length" class="dt-loading">{{ t('drafting.files.previewFailed') }}</div>
                      <div v-else class="pdf-scroll" ref="pdfScrollContainer">
                        <div
                          v-for="(page, idx) in pdfPages"
                          :key="`page-${activeFile}-${page.pageNum}`"
                          class="pdf-page-wrap"
                          :data-page="page.pageNum"
                          :style="{ width: page.width + 'px', height: page.height + 'px' }"
                        >
                          <!-- 底层：PDF.js 渲染的真实页面图片（所见即所得，扫描件同样适用） -->
                          <img
                            v-if="page.imgUrl"
                            class="pdf-canvas-img"
                            :src="page.imgUrl"
                            :width="page.width"
                            :height="page.height"
                            alt=""
                            draggable="false"
                          />
                          <!-- 顶层：变量 overlay（只含 token 徽标，透明背景不挡正文） -->
                          <div
                            class="doc-page"
                            :class="{ final: previewMode === 'final' }"
                            @click="onPdfOverlayClick"
                            v-html="page.html"
                          ></div>
                        </div>
                      </div>
                    </div>
                    <!-- 审阅调整点抽屉（覆盖在 PDF 之上） -->
                    <transition name="slide-right">
                      <aside v-if="reviewPaneOpen" class="de-review-drawer">
                        <div class="de-review-head">
                          <strong>{{ t('drafting.files.reviewPaneTitle') }}</strong>
                          <button class="btn icon-only" type="button" @click="reviewPaneOpen = false">
                            <AppIcon name="x" :size="14" />
                          </button>
                        </div>
                        <div class="de-review-hint">{{ t('drafting.files.reviewPaneHint') }}</div>
                        <div class="de-review-list">
                          <div
                            v-for="v in reviewableVars"
                            :key="v.key"
                            class="rp-item"
                            :class="{ selected: selectedDocVarKey === v.key, flash: flashTokenKey === v.key }"
                            @click="locateTokenInEditor(v.key)"
                          >
                            <div class="rp-item-head">
                              <strong>{{ pick(v.label) }}</strong>
                              <span class="act-badge" :class="actionTag(v.action).cls">{{ actionTag(v.action).label }}</span>
                            </div>
                            <div v-if="v.source" class="rp-anchor">{{ v.source }}</div>
                            <div v-if="v.confirmed && (v.value || v.choice || v.result)" class="rp-result">
                              → {{ v.result || v.choice || v.value }}
                            </div>
                          </div>
                          <div v-if="!reviewableVars.length" class="rp-empty">{{ t('drafting.files.noPoints') }}</div>
                        </div>
                      </aside>
                    </transition>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="wizard-actions">
            <button class="btn" type="button" @click="gotoStep('base')">
              <AppIcon name="arrowLeft" :size="15" />{{ t('common.back') }}
            </button>
            <div class="row">
              <span class="muted small">
                {{ progress?.allReady ? t('drafting.wizard.files.done') : t('drafting.gates.needAll') }}
              </span>
              <button class="btn success" type="button" :disabled="generating || !progress?.allReady" @click="generate">
                <AppIcon name="play" :size="15" />
                {{ generating ? t('drafting.files.generating') : t('drafting.files.generate') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除沟通证据确认 -->
    <AppModal :open="deleteEvidenceOpen" :title="t('drafting.inputs.deleteTitle')" @close="deleteEvidenceOpen = false">
      <p>
        {{
          t('drafting.inputs.deleteConfirm').replace(
            '@NAME@',
            pick(deleteEvidenceTarget?.title) || deleteEvidenceTarget?.fileName || ''
          )
        }}
      </p>
      <template #footer>
        <button class="btn" type="button" @click="deleteEvidenceOpen = false">{{ t('common.cancel') }}</button>
        <button class="btn danger" type="button" @click="confirmDeleteInput">{{ t('common.delete') }}</button>
      </template>
    </AppModal>

    <!-- 模型识别过程：提示词 + 模型原始返回（含每个变量的依据 sourceQuote 与思路 reason） -->
    <AppModal :open="traceOpen" :title="t('drafting.variables.traceTitle')" wide @close="traceOpen = false">
      <div v-if="trace" class="trace">
        <div class="trace-meta">
          <span>{{ t('drafting.variables.traceModel') }}：{{ trace.model }}</span>
          <span>{{ t('drafting.variables.traceAt') }}：{{ formatTraceTime(trace.finishedAt) }}</span>
        </div>

        <details class="trace-block" open>
          <summary>{{ t('drafting.variables.traceSystem') }}</summary>
          <pre>{{ trace.systemPrompt }}</pre>
        </details>

        <details class="trace-block">
          <summary>{{ t('drafting.variables.traceUser') }}</summary>
          <pre>{{ trace.userPrompt }}</pre>
        </details>

        <details class="trace-block" open>
          <summary>{{ t('drafting.variables.traceRaw') }}</summary>
          <pre v-for="(raw, index) in trace.rawResponses" :key="index">{{ raw }}</pre>
        </details>
      </div>
      <div v-else class="empty-state">{{ t('drafting.variables.traceEmpty') }}</div>
    </AppModal>

    
  </section>
</template>

<style>
.trace {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trace-meta {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted, #888);
}

.trace-block {
  border: 1px solid var(--border, #e2e2e2);
  border-radius: 8px;
  overflow: hidden;
}

.trace-block summary {
  cursor: pointer;
  padding: 8px 12px;
  font-weight: 600;
  font-size: 13px;
  background: rgba(127, 127, 127, 0.06);
  user-select: none;
}

.trace-block pre {
  margin: 0;
  padding: 10px 12px;
  max-height: 320px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 编辑正文弹窗 */
.doc-edit-area {
  width: 100%;
  min-height: 420px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.6;
  padding: 12px 14px;
  border: 1px solid var(--border, #d6d8de);
  border-radius: 6px;
  background: #fff;
  color: inherit;
  resize: vertical;
  box-sizing: border-box;
}
.hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--muted, #888);
}

/* ---------- 第 3 步 · 分文件确认与预览（对齐原型 doc-split 工作台） ---------- */
.file-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 文件 tab 条（原型 .file-tabs）：下边线式 tab */
.main-tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--border, #e2e2e2);
  margin-bottom: 4px;
  flex-wrap: nowrap;
  overflow-x: auto;
}
.main-tabs button {
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  font-size: 13px;
  color: var(--muted, #888);
  padding: 9px 14px;
  border-bottom: 2px solid transparent;
  flex: 0 0 auto;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.main-tabs button:hover {
  color: var(--text, #333);
}
.main-tabs button.active {
  color: var(--primary, #2563eb);
  border-bottom-color: var(--primary, #2563eb);
}
.main-tabs .tab-count {
  font-weight: 400;
  color: var(--muted, #888);
  font-size: 12px;
}

/* 左右双栏（原型 .doc-split）：左 变量确认清单（加宽）+ 右 编辑器（顶 tab 切文本 / PDF）；双栏撑满视口 */
.doc-split {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  grid-template-rows: minmax(760px, calc(100vh - 230px));
  gap: 16px;
  align-items: stretch;
}
.doc-split > .doc-pane:first-child {
  height: 0;
  min-height: 100%;
}
.doc-pane {
  border: 1px solid var(--border, #e2e2e2);
  border-radius: 10px;
  background: var(--surface, #fff);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
.doc-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #e2e2e2);
  background: rgba(127, 127, 127, 0.04);
  flex-wrap: wrap;
}
.doc-pane-head strong {
  font-size: 15px;
}
.pdf-diag {
  font-size: 12px;
  color: var(--muted, #6b7280);
  padding: 4px 10px;
  border: 1px dashed currentColor;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.03);
}
.pdf-ocr {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  border: 1px solid rgba(37, 99, 235, 0.35);
  animation: ocrPulse 1.6s ease-in-out infinite;
}
.pdf-ocr.err {
  background: rgba(217, 83, 79, 0.1);
  color: #b91c1c;
  border-color: rgba(217, 83, 79, 0.35);
  animation: none;
}
@keyframes ocrPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.pane-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 左栏变量卡列表（原型 .var-scroll / .doc-var-card，已放大） */
.var-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 14px;
  display: grid;
  gap: 12px;
  align-content: start;
}
.doc-var-card {
  border: 1px solid var(--border, #e2e2e2);
  border-radius: 10px;
  padding: 14px 16px;
  display: grid;
  gap: 10px;
  background: #fff;
  cursor: pointer;
}
.doc-var-card.confirmed {
  border-color: #9fe1cb;
  background: #f4fbf8;
}
.doc-var-card.selected {
  outline: 2px solid var(--primary, #2563eb);
}
.doc-var-card.flash {
  animation: varCardFlash 1.4s ease-out;
}
@keyframes varCardFlash {
  0%   { box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.35); }
  60%  { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
  100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
}
.doc-var-title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}
.doc-var-title strong {
  font-size: 15px;
  line-height: 1.45;
}
.doc-var-line {
  font-size: 13px;
  color: var(--muted, #888);
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  align-items: center;
}
.doc-var-line b {
  color: var(--text, #555);
  font-weight: 500;
  flex: 0 0 auto;
}
.doc-var-select,
.doc-var-card input,
.doc-var-card textarea {
  width: 100%;
  border: 1px solid var(--border, #d6d8de);
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
  font-size: 13.5px;
  background: #fff;
  color: inherit;
  box-sizing: border-box;
}
.doc-var-card textarea {
  resize: vertical;
}
.doc-var-result {
  font-size: 13px;
  color: var(--text, #555);
  line-height: 1.6;
}
.doc-var-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* 处理方式徽标（原型 .act-badge 五色，已放大） */
.act-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  border-radius: 5px;
  padding: 3px 9px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.act-del { color: #a32d2d; background: #fcebeb; border-color: #f7c1c1; }
.act-nu { color: #854f0b; background: #faeeda; border-color: #fac775; }
.act-ch { color: #185fa5; background: #e6f1fb; border-color: #b5d4f4; }
.act-rw { color: #534ab7; background: #eeedfe; border-color: #cecbf6; }
.act-fl { color: #0f6e56; background: #e1f5ee; border-color: #9fe1cb; }

.tag.info {
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary, #2563eb);
}
.tag.ok {
  background: rgba(16, 185, 129, 0.1);
  color: #0f6e56;
}
.tag.warn {
  background: rgba(245, 158, 11, 0.12);
  color: #854f0b;
}

/* 右栏模式切换（原型 .mode-switch） */
.mode-switch {
  display: inline-flex;
  border: 1px solid var(--border, #d6d8de);
  border-radius: 7px;
  overflow: hidden;
}
.mode-switch button {
  border: 0;
  background: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted, #888);
  padding: 6px 12px;
}
.mode-switch button + button {
  border-left: 1px solid var(--border, #d6d8de);
}
.mode-switch button.active {
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary, #2563eb);
}

/* 预览源切换：文稿 / 标准模板（与 mode-switch 同款） */
.source-switch {
  display: inline-flex;
  border: 1px solid var(--border, #d6d8de);
  border-radius: 7px;
  overflow: hidden;
}
.source-switch button {
  border: 0;
  background: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted, #888);
  padding: 6px 12px;
}
.source-switch button + button {
  border-left: 1px solid var(--border, #d6d8de);
}
.source-switch button.active {
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary, #2563eb);
}

/* doc-edit-wrap：右栏编辑器外壳（撑满右栏高度） */
.doc-edit-wrap {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  padding: 12px;
}
.doc-edit-pane {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border, #e2e2e2);
  border-radius: 10px;
  overflow: hidden;
}

.de-body {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  /* flex 链不能在这里断掉：de-preview-full/pdf-scroll 的 flex:1 依赖父级是 flex 容器，
     否则高度随内容撑开、滚动失效 */
  display: flex;
  flex-direction: column;
}

/* doc view = PDF 铺满整右栏（与原 preview tab 等大；文本编辑器 / 顶部 tab 已删除） */
.de-preview-full {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
}
.dt-loading { padding: 20px; color: var(--muted, #888); }

/* 文档预览：每页是流式 HTML 渲染（PDF.js textContent → 行 + hit span） */
.pdf-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  background: #eef0f3;
}
.pdf-page-wrap {
  position: relative;
  background: #fff;
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.10);
  border-radius: 6px;
  overflow: hidden;
  /* flex 纵向滚动容器内不许被压缩，否则多页被压扁、失去滚动溢出 */
  flex: 0 0 auto;
}
/* 底层：PDF.js canvas 渲染出的整页图片 */
.pdf-canvas-img {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
  -webkit-user-drag: none;
}
/* 顶层：变量 overlay，透明背景、绝对定位覆盖在整页图片之上 */
.doc-page {
  position: absolute;
  inset: 0;
  padding: 0;
  font-family: "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #1f2937;
  background: transparent;
}
/* ---------- Token 徽标（绝对定位到 PDF 坐标，覆盖在 canvas 正文之上） ---------- */
.hit {
  position: absolute;
  display: inline-block;
  box-sizing: border-box;
  padding: 0 3px;
  border-radius: 3px;
  font-weight: 600;
  line-height: 1.25;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: pointer;
  transition: background-color 0.15s ease, outline 0.15s ease;
}
.hit.tok-ok {
  background: linear-gradient(180deg, #d6f1e3 0%, #e9faf2 100%);
  border: 1px solid #9fe1cb;
  color: #0a4d3c;
}
.hit.tok-ok-empty {
  background: rgba(16, 185, 129, 0.12);
  border: 1px dashed #9fe1cb;
  color: #0f6e56;
}
.hit.tok-warn {
  background: rgba(253, 186, 116, 0.35);
  border: 1px solid #f1b878;
  color: #8a4a13;
}
.hit.tok-unknown {
  background: rgba(180, 180, 180, 0.20);
  border: 1px dashed #aaa;
  color: #555;
  font-family: var(--mono, ui-monospace, "Cascadia Mono", Menlo, monospace);
  font-size: 0.9em;
}
/* 删除 / 不使用：白底抹掉原文 + 红斜线 */
.hit.tok-deleted {
  background: #ffffff;
  border: 1px solid #d9534f;
  color: #c0392b;
  position: relative;
}
.hit.tok-deleted::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top right,
    transparent calc(50% - 1px),
    rgba(217, 83, 79, 0.85) calc(50% - 1px),
    rgba(217, 83, 79, 0.85) calc(50% + 1px),
    transparent calc(50% + 1px)
  );
  pointer-events: none;
}
.hit:hover { box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12); }

/* ---------- Final 最终预览：去掉审阅徽标，白底遮盖原文并显示替换值 ---------- */
.doc-page.final .hit { background: #fff; border: none; color: #1f2937; font-weight: 400; box-shadow: none; }
.doc-page.final .hit.tok-unknown { display: none; }
.doc-page.final .hit.tok-deleted { background: #fff; color: transparent; border: none; }
.doc-page.final .hit.tok-deleted::before { display: none; }

/* ---------- 联动高亮（locateTokenInEditor 直接 DOM toggle） ---------- */
.hit.hit-all {
  outline: 2px dashed var(--primary, #2563eb);
  outline-offset: 1px;
}
.hit.hit-current {
  outline: 3px solid #f59e0b !important;
  outline-offset: 2px;
  background: rgba(245, 158, 11, 0.22) !important;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18);
}
.hit.flash {
  animation: hitFlash 1.4s ease-out;
}
@keyframes hitFlash {
  0%   { box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.45); transform: scale(1.05); }
  60%  { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); transform: scale(1); }
  100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); transform: scale(1); }
}

/* 审阅调整点抽屉：绝对定位覆盖于 doc-view 右侧，宽度放大 */
.de-review-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(560px, 95%);
  background: #fff;
  border-left: 1px solid var(--border, #e2e2e2);
  box-shadow: -10px 0 26px rgba(0, 0, 0, 0.09);
  z-index: 6;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.de-review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border, #e2e2e2);
  font-size: 13.5px;
}
.de-review-hint {
  padding: 8px 14px 10px;
  font-size: 12px;
  color: var(--muted, #888);
  border-bottom: 1px dashed var(--border, #e2e2e2);
  background: rgba(37, 99, 235, 0.04);
}
.de-review-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 10px 12px;
  display: grid;
  gap: 8px;
  align-content: start;
}
.slide-right-enter-active,
.slide-right-leave-active { transition: transform 0.18s ease, opacity 0.18s ease; }
.slide-right-enter-from,
.slide-right-leave-to { transform: translateX(40px); opacity: 0; }
.rp-item.flash {
  outline: 3px solid var(--primary, #2563eb);
  outline-offset: 2px;
  animation: tplFlash 1.4s ease-out;
}
.rp-result {
  font-size: 11.5px;
  color: #0f6e56;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 4px;
  padding: 2px 6px;
  margin-top: 4px;
  display: inline-block;
  word-break: break-word;
}

/* 文稿 PDF 原生预览（doc 与 preview 共用：右栏全文铺满） */
.doc-pdf-frame {
  width: 100%;
  height: 100%;
  min-height: 600px;
  border: 1px solid var(--border, #e2e2e2);
  border-radius: 8px;
  background: #fff;
}
.rp-item {
  background: #fff;
  border: 1px solid var(--border, #e2e2e2);
  border-radius: 7px;
  padding: 8px 9px;
  font-size: 12px;
  line-height: 1.55;
  cursor: pointer;
}
.rp-item:hover,
.rp-item.selected {
  border-color: var(--primary, #2563eb);
}
.rp-item .rp-anchor {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: var(--primary, #2563eb);
  margin-top: 3px;
}
.rp-empty {
  padding: 14px;
  color: var(--muted, #888);
  font-size: 12px;
}
.btn.review-toggle.on {
  background: rgba(37, 99, 235, 0.08);
  border-color: #b5d4f4;
  color: var(--primary, #2563eb);
}

/* 变量影响关系矩阵（原型 .matrix-wrap） */
.matrix-wrap {
  border: 1px solid var(--border, #e2e2e2);
  border-radius: 10px;
  background: #fff;
  overflow: auto;
  min-height: min(760px, calc(100vh - 320px));
}
.matrix-wrap table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12.5px;
}
.matrix-wrap th,
.matrix-wrap td {
  border-bottom: 1px solid var(--border, #e2e2e2);
  border-right: 1px solid var(--border, #e2e2e2);
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}
.matrix-wrap thead th {
  background: rgba(127, 127, 127, 0.04);
  position: sticky;
  top: 0;
}
.matrix-wrap td.cell-empty {
  color: var(--muted, #888);
  text-align: center;
}
.matrix-wrap td .cell-anchor {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: var(--primary, #2563eb);
}
.matrix-wrap td .cell-result {
  color: var(--text, #555);
  margin-top: 3px;
  line-height: 1.5;
}
/* ---------- 桑基图（变量 → 改写动作 → 文件落点） ---------- */
.matrix-wrap.fullscreen {
  position: fixed;
  inset: 12px;
  z-index: 60;
  min-height: 0;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3);
}
.matrix-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border, #e2e2e2);
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 2;
}
.matrix-search {
  width: 200px;
}
.matrix-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}
.sankey-wrap {
  padding: 12px 14px;
  display: grid;
  gap: 10px;
}
.sankey-svg {
  width: 100%;
  height: auto;
  max-height: calc(100vh - 340px);
  min-height: 240px;
  background:
    linear-gradient(to right, transparent calc(25% - 1px), rgba(127, 127, 127, 0.06) 25%, transparent 25%),
    #fff;
}
.matrix-wrap.fullscreen .sankey-svg {
  max-height: calc(100vh - 220px);
}
.sankey-link {
  fill: none;
  stroke: #b9c4d4;
  stroke-width: 7;
  stroke-opacity: 0.35;
  stroke-linecap: round;
  transition: stroke-opacity 0.15s ease, stroke 0.15s ease;
}
.sankey-link.file {
  stroke-width: 5;
}
.sankey-link.on {
  stroke: var(--primary, #2563eb);
  stroke-opacity: 0.85;
}
.sankey-link.dim {
  stroke: #dde3ec;
  stroke-opacity: 0.3;
}
.sankey-node {
  cursor: default;
}
.sankey-node rect {
  fill: #f4f6fa;
  stroke: #c3cbd9;
  stroke-width: 1;
  transition: fill 0.15s ease, stroke 0.15s ease;
}
.sankey-node.var {
  cursor: pointer;
}
.sankey-node.var rect {
  fill: #fff7ee;
  stroke: #ecbd8b;
}
.sankey-node.var.confirmed rect {
  fill: #e9faf2;
  stroke: #9fe1cb;
}
.sankey-node.var:hover rect {
  stroke: var(--primary, #2563eb);
  stroke-width: 1.6;
}
.sankey-node.var.on rect {
  stroke: var(--primary, #2563eb);
  stroke-width: 2;
  fill: #eaf1ff;
}
.sankey-node.file {
  cursor: pointer;
}
.sankey-node.file rect {
  fill: #eff6ff;
  stroke: #93c5fd;
}
.sankey-node.file.on rect {
  stroke: var(--primary, #2563eb);
  stroke-width: 2;
  fill: #dbeafe;
}
.sankey-node.act.on rect {
  stroke: var(--primary, #2563eb);
  stroke-width: 2;
  fill: #eef2ff;
}
.sankey-node.dim rect {
  opacity: 0.45;
}
.sankey-node.on rect {
  opacity: 1;
}
.sankey-node .node-label {
  font-size: 11px;
  font-weight: 700;
  fill: #2c3444;
  dominant-baseline: middle;
}
.sankey-node .node-sub {
  font-size: 9.5px;
  fill: #8a93a6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.sankey-cols {
  display: grid;
  grid-template-columns: 202px 140px 132px;
  justify-content: space-between;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0 2px;
}
.sankey-detail {
  border: 1px solid var(--border, #e2e2e2);
  border-radius: 10px;
  background: #fbfcfe;
  padding: 10px 12px;
  display: grid;
  gap: 8px;
}
.sankey-detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.sankey-detail-head strong {
  font-size: 13.5px;
}
.sankey-detail-head .btn {
  margin-left: auto;
}
.sankey-detail-body {
  display: grid;
  gap: 4px 22px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  font-size: 12.5px;
}
.sankey-detail-body > div {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.sankey-detail-body b {
  color: var(--muted, #888);
  font-weight: 600;
  white-space: nowrap;
}
.matrix-table {
  padding: 4px 12px 12px;
}
.matrix-legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted, #888);
  padding: 8px 2px 0;
}

/* 专注模式：fixed 铺满整个视口（低于弹窗/提示层级），ESC 或按钮退出 */
.doc-split.is-focus {
  position: fixed;
  inset: 0;
  z-index: 50;
  grid-template-columns: minmax(460px, 40%) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 14px;
  padding: 16px;
  background: var(--bg, #f4f5f7);
  overflow: hidden;
}
.doc-split.is-focus > .doc-pane {
  height: 100%;
  min-height: 0;
}
.doc-split.is-focus .doc-pdf-frame {
  height: 100%;
}

/* 窄屏折叠为单列（专注模式始终双列铺满视口） */
@media (max-width: 1024px) {
  .doc-split:not(.is-focus) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
  }
  .doc-split > .doc-pane:first-child {
    height: auto;
    min-height: 0;
  }
  /* 单列时 PDF 面板必须拿到确定的视口高度，否则 auto 行内容坍塌、无法滚动浏览 */
  .doc-split:not(.is-focus) > .doc-pane:last-child {
    height: calc(100vh - 230px);
    min-height: 640px;
  }
  .doc-split-body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
