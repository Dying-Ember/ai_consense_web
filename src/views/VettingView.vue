<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { vettingApi } from '@/api'
import type { EvidenceBundle, Finding, VettingFile, VettingMetrics } from '@/api/types'
import { useAppStore } from '@/stores/app'
import { useLocalized } from '@/composables/useLocalized'
import AppIcon from '@/components/AppIcon.vue'
import AppModal from '@/components/AppModal.vue'

const { t } = useI18n()
const store = useAppStore()
const { pick, currentKey } = useLocalized()

const files = ref<VettingFile[]>([])
const findings = ref<Finding[]>([])
const metrics = ref<VettingMetrics | null>(null)
const running = ref(false)
const packageInput = ref<HTMLInputElement | null>(null)
const sourceOpen = ref(false)

const filters = ref({ search: '', group: 'all', scope: 'all', fileKey: 'all', page: 'all' })
const selectedCode = ref<string | null>(null)
const drawerOpen = ref(false)
const evidence = ref<EvidenceBundle | null>(null)

const projectId = computed(() => store.activeProjectId)

const GROUPS = ['reference', 'conflict', 'language', 'risk'] as const

const GROUP_CLASS: Record<string, string> = {
  reference: 'type-ref',
  conflict: 'type-conflict',
  language: 'type-lang',
  risk: 'type-risk'
}

const GROUP_TAG: Record<string, string> = {
  reference: 'info',
  conflict: 'danger',
  language: 'warn',
  risk: 'demo'
}

/** 三栏定位器第二栏的标签（变量 / 错误类别） */
const BUCKET_LABELS: Record<string, { zhHans: string; zhHant: string; en: string }> = {
  evalWeight: { zhHans: '评审权重', zhHant: '評審權重', en: 'Evaluation weighting' },
  bondForm: { zhHans: '保函表格', zhHant: '保函表格', en: 'Bond form' },
  billRange: { zhHans: '提交范围', zhHant: '提交範圍', en: 'Submission scope' },
  warranty: { zhHans: '保养期 / 保用期', zhHant: '保養期 / 保用期', en: 'Maintenance / warranty' },
  particulars: { zhHans: '项目资料', zhHant: '項目資料', en: 'Particulars' },
  programme: { zhHans: '工期', zhHant: '工期', en: 'Programme' },
  scope: { zhHans: '范围', zhHant: '範圍', en: 'Scope' },
  missing: { zhHans: '引用缺失', zhHant: '引用缺失', en: 'Missing reference' },
  wrongNo: { zhHans: '编号错误', zhHant: '編號錯誤', en: 'Wrong clause number' },
  blank: { zhHans: '空白未定稿', zhHant: '空白未定稿', en: 'Blank placeholder' },
  version: { zhHans: '版本引用错误', zhHant: '版本引用錯誤', en: 'Version reference' },
  grammar: { zhHans: '语法', zhHant: '語法', en: 'Grammar' },
  spelling: { zhHans: '拼写', zhHant: '拼寫', en: 'Spelling' },
  american: { zhHans: '英式 / 美式', zhHant: '英式 / 美式', en: 'British / American' }
}

const selectedFinding = computed(() => findings.value.find((item) => item.code === selectedCode.value) ?? null)

const canUseBuckets = computed(() => filters.value.group === 'conflict')

const fileBuckets = computed(() => {
  const map = new Map<string, number>()
  findings.value.forEach((item) => {
    const key = item.fileKey || '—'
    map.set(key, (map.get(key) ?? 0) + 1)
  })
  return [...map.entries()].map(([key, count]) => ({ key, count }))
})

const secondBuckets = computed(() => {
  const map = new Map<string, number>()
  findings.value.forEach((item) => {
    const key = canUseBuckets.value ? item.bucketKey || 'particulars' : item.pageNo || 'P1'
    map.set(key, (map.get(key) ?? 0) + 1)
  })
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => (canUseBuckets.value ? b.count - a.count : a.key.localeCompare(b.key)))
})

function bucketLabel(key: string) {
  const labels = BUCKET_LABELS[key]
  if (!labels) return key
  return labels[currentKey.value] || labels.zhHans
}

async function reload() {
  if (!projectId.value) return
  const [fileList, findingList, metricData] = await Promise.all([
    vettingApi.files(projectId.value),
    vettingApi.findings(projectId.value, filters.value),
    vettingApi.metrics(projectId.value)
  ])
  files.value = fileList
  findings.value = findingList
  metrics.value = metricData
}

onMounted(reload)
watch(projectId, () => {
  selectedCode.value = null
  drawerOpen.value = false
  filters.value = { search: '', group: 'all', scope: 'all', fileKey: 'all', page: 'all' }
  reload()
})

let searchTimer: number | undefined
watch(
  () => ({ ...filters.value }),
  () => {
    if (searchTimer) window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(reload, 220)
  },
  { deep: true }
)

function setGroup(group: string) {
  filters.value.group = filters.value.group === group ? 'all' : group
  filters.value.page = 'all'
}

function setFile(fileKey: string) {
  filters.value.fileKey = filters.value.fileKey === fileKey ? 'all' : fileKey
  filters.value.page = 'all'
}

function setBucket(key: string) {
  if (canUseBuckets.value) {
    filters.value.page = 'all'
    filters.value.search = ''
    // 变量维度直接在高亮状态展示，不做后端过滤（保持列表可对照）
    filters.value.search = bucketSearchKey(key)
  } else {
    filters.value.page = filters.value.page === key ? 'all' : key
  }
}

function bucketSearchKey(key: string) {
  const finding = findings.value.find((item) => (item.bucketKey || 'particulars') === key)
  return finding ? finding.refs || finding.location || '' : ''
}

function bucketActive(key: string) {
  if (canUseBuckets.value) {
    return filters.value.search === bucketSearchKey(key)
  }
  return filters.value.page === key
}

function openFinding(finding: Finding) {
  selectedCode.value = finding.code
  drawerOpen.value = true
  evidence.value = null
  vettingApi.evidence(projectId.value, finding.code).then((data) => {
    evidence.value = data
  }).catch(() => undefined)
}

function closeDrawer() {
  drawerOpen.value = false
}

async function updateStatus(status: string) {
  if (!selectedFinding.value) return
  const updated = await vettingApi.updateStatus(projectId.value, selectedFinding.value.code, status)
  const index = findings.value.findIndex((item) => item.code === updated.code)
  if (index >= 0) findings.value.splice(index, 1, updated)
  metrics.value = await vettingApi.metrics(projectId.value)
  store.notify(`${updated.code} · ${status}`)
}

async function runVetting() {
  running.value = true
  store.setBusy(t('vetting.run.started'))
  try {
    const result = await vettingApi.run(projectId.value, store.locale)
    store.notify(t('vetting.run.finished', { count: result.total }))
    result.messages?.forEach((message) => store.notify(message, 4200))
    await reload()
  } finally {
    running.value = false
    store.clearBusy()
  }
}

async function uploadPackage(event: Event) {
  const selected = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!selected.length) return
  store.setBusy(t('common.loading'))
  try {
    const result = await vettingApi.uploadPackage(projectId.value, selected)
    store.notify(result.messages.join('\n') || t('common.done'), 5000)
    await reload()
  } finally {
    store.clearBusy()
    if (packageInput.value) packageInput.value.value = ''
  }
}

async function exportReport() {
  await vettingApi.exportReport(projectId.value, store.locale, 'ConSense_Vetting_Report.pdf')
}

function metricCards() {
  const data = metrics.value
  return [
    { group: 'reference', label: t('vetting.metrics.reference'), detail: t('vetting.metrics.referenceDetail'), value: data?.reference ?? 0 },
    { group: 'conflict', label: t('vetting.metrics.conflict'), detail: t('vetting.metrics.conflictDetail'), value: data?.conflict ?? 0 },
    { group: 'language', label: t('vetting.metrics.language'), detail: t('vetting.metrics.languageDetail'), value: data?.language ?? 0 },
    { group: 'risk', label: t('vetting.metrics.risk'), detail: t('vetting.metrics.riskDetail'), value: data?.risk ?? 0 }
  ]
}

const severityClass = (finding: Finding) => finding.severity || 'low'

function tagClass(group: string) {
  return GROUP_TAG[group] ?? 'neutral'
}
</script>

<template>
  <section class="screen">
    <div class="screen-head">
      <div>
        <span class="eyebrow">{{ t('screen.vetting') }}</span>
        <h3>{{ t('vetting.title') }}</h3>
        <p>{{ t('vetting.subtitle') }}</p>
      </div>
      <div class="row">
        <button class="btn" type="button" @click="sourceOpen = true">
          <AppIcon name="layers" :size="15" />{{ t('vetting.actions.source') }}
        </button>
        <input ref="packageInput" type="file" multiple class="hidden"
               accept=".pdf,.doc,.docx,.txt,.md" @change="uploadPackage" />
        <button class="btn" type="button" @click="packageInput?.click()">
          <AppIcon name="upload" :size="15" />{{ t('vetting.actions.upload') }}
        </button>
        <button class="btn primary" type="button" :disabled="running" @click="runVetting">
          <AppIcon name="play" :size="15" />
          {{ running ? t('vetting.actions.running') : t('vetting.actions.run') }}
        </button>
        <button class="btn" type="button" :disabled="!metrics?.total" @click="exportReport">
          <AppIcon name="download" :size="15" />{{ t('vetting.actions.export') }}
        </button>
      </div>
    </div>

    <!-- 指标卡 -->
    <div class="layout-grid grid-4">
      <button
        v-for="card in metricCards()"
        :key="card.group"
        type="button"
        class="metric"
        :class="[GROUP_CLASS[card.group], { active: filters.group === card.group }]"
        @click="setGroup(card.group)"
      >
        <span class="label">{{ card.label }}</span>
        <span class="value">{{ card.value }}</span>
        <span class="detail">{{ card.detail }}</span>
      </button>
    </div>

    <!-- 工具栏 -->
    <div class="surface section-gap">
      <div class="surface-body">
        <div class="toolbar">
          <input
            type="search"
            v-model="filters.search"
            :placeholder="t('vetting.toolbar.searchPlaceholder')"
          />
          <select v-model="filters.group">
            <option value="all">{{ t('vetting.toolbar.allTypes') }}</option>
            <option value="reference">{{ t('vetting.metrics.reference') }}</option>
            <option value="conflict">{{ t('vetting.metrics.conflict') }}</option>
            <option value="language">{{ t('vetting.metrics.language') }}</option>
            <option value="risk">{{ t('vetting.metrics.risk') }}</option>
          </select>
          <select v-model="filters.scope">
            <option value="all">{{ t('vetting.toolbar.allScopes') }}</option>
            <option value="intra">{{ t('vetting.toolbar.intra') }}</option>
            <option value="inter">{{ t('vetting.toolbar.inter') }}</option>
          </select>
          <select v-model="filters.fileKey">
            <option value="all">{{ t('common.file') }}</option>
            <option v-for="file in files" :key="file.key" :value="file.key">{{ file.key }}</option>
          </select>
          <span class="spacer" />
          <span class="muted small">{{ findings.length }} / {{ metrics?.total ?? 0 }}</span>
          <button class="btn" type="button" @click="reload">
            <AppIcon name="refresh" :size="15" />{{ t('common.refresh') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 三栏工作台 -->
    <div class="vetting-workbench section-gap">
      <div class="locator-panel">
        <div class="locator-title">{{ t('vetting.locator.file') }}</div>
        <div class="locator-list">
          <button
            type="button"
            class="locator-item"
            :class="{ active: filters.fileKey === 'all' }"
            @click="filters.fileKey = 'all'"
          >
            <span>{{ t('vetting.locator.all') }}</span>
            <span class="count">{{ metrics?.total ?? 0 }}</span>
          </button>
          <button
            v-for="bucket in fileBuckets"
            :key="bucket.key"
            type="button"
            class="locator-item"
            :class="{ active: filters.fileKey === bucket.key }"
            @click="setFile(bucket.key)"
          >
            <span>{{ bucket.key }}</span>
            <span class="count">{{ bucket.count }}</span>
          </button>
        </div>
      </div>

      <div class="locator-panel">
        <div class="locator-title">
          {{ canUseBuckets ? t('vetting.locator.variable') : t('vetting.locator.page') }}
        </div>
        <div class="locator-list">
          <button
            type="button"
            class="locator-item"
            :class="{ active: canUseBuckets ? !filters.search : filters.page === 'all' }"
            @click="
              canUseBuckets ? (filters.search = '') : (filters.page = 'all')
            "
          >
            <span>{{ t('vetting.locator.all') }}</span>
          </button>
          <button
            v-for="bucket in secondBuckets"
            :key="bucket.key"
            type="button"
            class="locator-item"
            :class="{ active: bucketActive(bucket.key) }"
            @click="setBucket(bucket.key)"
          >
            <span>{{ canUseBuckets ? bucketLabel(bucket.key) : bucket.key }}</span>
            <span class="count">{{ bucket.count }}</span>
          </button>
        </div>
      </div>

      <div class="finding-list">
        <div v-if="!findings.length" class="empty-state">{{ t('vetting.list.empty') }}</div>
        <button
          v-for="finding in findings"
          :key="finding.code"
          type="button"
          class="finding"
          :class="[severityClass(finding), { active: selectedCode === finding.code }]"
          @click="openFinding(finding)"
        >
          <div class="finding-top">
            <span class="code mono">{{ finding.code }}</span>
            <span class="tag" :class="tagClass(finding.group)">
              {{ t(`vetting.metrics.${finding.group}`) }}
            </span>
            <span class="tag" :class="finding.scope === 'inter' ? 'scope-inter' : 'neutral'">
              {{ finding.scope === 'inter' ? t('vetting.toolbar.inter') : t('vetting.toolbar.intra') }}
            </span>
            <span class="tag neutral">{{ finding.severity }}</span>
            <span v-if="finding.status !== 'Open'" class="tag ok">{{ finding.status }}</span>
            <span class="spacer" />
            <span class="finding-meta">{{ finding.fileKey }} · {{ finding.pageNo }}</span>
          </div>
          <div class="finding-title">{{ pick(finding.title) }}</div>
          <div class="finding-meta">
            <span class="mono">{{ finding.refs }}</span>
            <span v-if="finding.evidenceId === 'unverified'" class="tag warn">
              {{ t('vetting.drawer.unverified') }}
            </span>
          </div>
          <div class="finding-body">{{ pick(finding.body) }}</div>
        </button>
      </div>
    </div>

    <!-- 详情抽屉 -->
    <div class="drawer-backdrop" :class="{ show: drawerOpen }" @click="closeDrawer" />
    <aside class="finding-drawer" :class="{ open: drawerOpen }">
      <div class="finding-drawer-head">
        <div>
          <h4>{{ t('vetting.drawer.title') }}</h4>
          <p>{{ t('vetting.drawer.subtitle') }}</p>
        </div>
        <button class="btn icon-only" type="button" @click="closeDrawer">
          <AppIcon name="close" />
        </button>
      </div>

      <div v-if="selectedFinding" class="finding-drawer-body">
        <div class="finding-detail">
          <div>
            <span class="code mono">{{ selectedFinding.code }}</span>
            <h4 style="margin: 6px 0 0">{{ pick(selectedFinding.title) }}</h4>
          </div>

          <div class="detail-grid">
            <div class="detail-cell">
              <div class="detail-title">{{ t('vetting.drawer.type') }}</div>
              <div class="detail-value">
                {{ t(`vetting.metrics.${selectedFinding.group}`) }}
                <span class="mono muted">（{{ selectedFinding.types.join(' / ') }}）</span>
              </div>
            </div>
            <div class="detail-cell">
              <div class="detail-title">{{ t('vetting.drawer.scope') }}</div>
              <div class="detail-value">
                {{ selectedFinding.scope === 'inter' ? t('vetting.toolbar.inter') : t('vetting.toolbar.intra') }}
              </div>
            </div>
            <div class="detail-cell">
              <div class="detail-title">{{ t('vetting.drawer.reference') }}</div>
              <div class="detail-value mono">{{ selectedFinding.refs }}</div>
            </div>
            <div class="detail-cell">
              <div class="detail-title">{{ t('vetting.drawer.status') }}</div>
              <div class="detail-value">{{ selectedFinding.status }}</div>
            </div>
          </div>

          <div class="detail-block">
            <h5>{{ t('vetting.drawer.location') }}</h5>
            <p>{{ selectedFinding.location }}</p>
          </div>

          <div class="detail-block" v-if="selectedFinding.expected">
            <h5>{{ t('vetting.drawer.expected') }}</h5>
            <p class="mono">{{ selectedFinding.expected }}</p>
          </div>

          <div class="detail-block" v-if="selectedFinding.pattern">
            <h5>{{ t('vetting.drawer.pattern') }}</h5>
            <p class="mono">{{ selectedFinding.pattern }}</p>
          </div>

          <div class="detail-block">
            <h5>{{ t('vetting.drawer.reason') }}</h5>
            <p>{{ pick(selectedFinding.impact) }}</p>
          </div>

          <div class="detail-block">
            <h5>{{ t('vetting.drawer.suggestion') }}</h5>
            <p>{{ pick(selectedFinding.suggestion) }}</p>
          </div>

          <div class="detail-block">
            <h5>
              {{ t('vetting.drawer.evidence') }}
              <span v-if="evidence" class="tag" :class="evidence.located ? 'ok' : 'warn'">
                {{ evidence.located ? t('vetting.drawer.located') : t('vetting.drawer.unverified') }}
              </span>
            </h5>
            <div v-if="!evidence" class="muted small">{{ t('vetting.drawer.locating') }}</div>
            <div v-else-if="evidence.located" class="evidence-stack">
              <div
                v-for="item in evidence.items"
                :key="item.code + item.text.slice(0, 12)"
                class="evidence-item"
              >
                <div class="meta">
                  <code>{{ item.code }}</code>
                  <span v-if="item.pageNo" class="tag neutral mono">{{ item.pageNo }}</span>
                </div>
                <div class="quote">{{ item.text }}</div>
              </div>
            </div>
            <div v-else class="evidence-missing">
              <AppIcon name="alert" :size="14" />
              <span>{{ t('vetting.drawer.notLocated') }}</span>
            </div>
          </div>

          <div class="detail-actions">
            <button
              class="btn success"
              type="button"
              :disabled="selectedFinding.status === 'Handled'"
              @click="updateStatus('Handled')"
            >
              <AppIcon name="check" :size="15" />{{ t('vetting.drawer.markHandled') }}
            </button>
            <button
              class="btn"
              type="button"
              :disabled="selectedFinding.status === 'Assigned'"
              @click="updateStatus('Assigned')"
            >
              <AppIcon name="external" :size="15" />{{ t('vetting.drawer.assign') }}
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- 审查源集 -->
    <AppModal :open="sourceOpen" :title="t('vetting.actions.source')" @close="sourceOpen = false">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('common.file') }}</th>
              <th>{{ t('common.type') }}</th>
              <th>{{ t('common.status') }}</th>
              <th>{{ t('common.page') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in files" :key="file.key">
              <td>
                <strong class="mono">{{ file.key }}</strong>
                <div class="muted small">{{ file.fileName }}</div>
              </td>
              <td>{{ pick(file.role) }}</td>
              <td>
                <span class="tag" :class="file.parsed ? 'ok' : 'warn'">{{ file.status }}</span>
              </td>
              <td>{{ file.pageCount || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppModal>
  </section>
</template>
