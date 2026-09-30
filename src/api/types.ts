/** 后端统一返回的三语文案对象 */
export interface LocalizedText {
  zhHans: string
  zhHant: string
  en: string
}

export interface Project {
  id: string
  name: LocalizedText
  contractNo: string | null
  packageRef: string | null
  outputReferenceFile: string | null
  pages: string | null
  nttRange: string | null
  sctRange: string | null
  sccRange: string | null
  specification: string | null
  titleLines: LocalizedText[]
}

/* ------------------------------------------------------------ 起草 */

export interface TemplateItem {
  key: string
  id: string
  label: LocalizedText
  fileName: string
  note: LocalizedText
  status: LocalizedText
  tag: string
}

export interface EvidenceItem {
  id: number | null
  code: string
  type: LocalizedText
  status: string
  tag: string
  title: LocalizedText
  body: LocalizedText
  source: string
  fileName: string
  fileKey: string | null
  pageCount: number | null
  ocrUsed: boolean | null
  message: LocalizedText
}

export interface DraftVariable {
  key: string
  scope: 'BASE' | 'FILE'
  fileKey: string | null
  label: LocalizedText
  action: string
  value: string
  choice: string | null
  options: LocalizedText[]
  confirmed: boolean
  confirmedFrom: string | null
  source: string | null
  result: string | null
  kind: string | null
  cols: string[]
  linkedBase: string | null
  derivedFrom: string[]
  affects: string[]
  note: string | null
}

/** 手工新增 FILE 变量的请求体 */
export interface VariableCreateRequest {
  key: string
  fileKey: string
  labelZhHans: string
  labelZhHant?: string
  labelEn?: string
  action: 'fill' | 'choice' | 'rewrite' | 'delete' | 'notused' | string
  options?: string[]
  value?: string
  affects?: string
  sourceQuote?: string
  reason?: string
  confidence?: number
}

/** 最近一次变量识别的过程留痕（提示词 + 模型原始返回） */
export interface ExtractTrace {
  model: string
  finishedAt: string
  systemPrompt: string
  userPrompt: string
  rawResponses: string[]
}

export interface DraftProgress {
  evidenceCount: number
  templateCount: number
  baseTotal: number
  baseConfirmed: number
  fileTotal: number
  fileConfirmed: number
  baseReady: boolean
  allReady: boolean
  generatedFiles: string[]
}

export interface DraftDocument {
  fileKey: string
  title: string
  content: string
  generated: boolean
}

export interface UploadResult {
  accepted: number
  parsed: number
  failed: number
  messages: string[]
}

/* ------------------------------------------------------------ 审查 */

export interface VettingFile {
  key: string
  role: LocalizedText
  fileName: string
  basis: string
  status: string
  generated: boolean
  parsed: boolean
  pageCount: number
}

export interface Finding {
  code: string
  types: string[]
  group: string
  scope: string
  severity: 'high' | 'medium' | 'low' | string
  status: string
  title: LocalizedText
  body: LocalizedText
  impact: LocalizedText
  suggestion: LocalizedText
  pattern: string | null
  refs: string | null
  location: string | null
  expected: string | null
  evidenceId: string | null
  fileKey: string | null
  pageNo: string | null
  bucketKey: string | null
}

export interface VettingMetrics {
  reference: number
  conflict: number
  language: number
  risk: number
  total: number
  crossFile: number
}

export interface VettingRunResult {
  total: number
  metrics: VettingMetrics
  messages: string[]
  model: string
}

export interface EvidenceSnippet {
  code: string
  /** 原文中该片段所在页码，由正文 --- Pn --- 标记反推 */
  pageNo: string | null
  text: string
}

export interface EvidenceBundle {
  title: string
  /** 是否在原文里逐字定位到；false 时 items 为空，应提示人工复核 */
  located: boolean
  items: EvidenceSnippet[]
}

/* ------------------------------------------------------------ 咨询 */

export interface Citation {
  fileLabel: string
  pageNo: string
  anchor: string
  content: string
  score: number
}

export interface ChatMessage {
  id: number | null
  role: 'user' | 'assistant'
  title: LocalizedText | null
  content: LocalizedText | null
  unknownScope: string | null
  citations: string[]
  evidenceId: string | null
  sources: Citation[]
}

export interface AskResponse {
  grounded: boolean
  title: LocalizedText
  content: LocalizedText | null
  unknownScope: string | null
  citations: string[]
  evidenceId: string | null
  sources: Citation[]
  model: string
}

export interface IndexStatus {
  chunks: number
  indexed: number
  vectorProvider: string
  collection: string
  embedModel: string
  llmModel: string
  llmReady: boolean
  vectorReady: boolean
  ocrReady: boolean
  message: LocalizedText
}

export interface QuickQuestion {
  text: LocalizedText
  unknown: boolean | null
  evidenceId: string | null
}

/* ------------------------------------------------------------ 技能与系统 */

export interface SkillDoc {
  id: string
  code: string
  name: LocalizedText
  purpose: LocalizedText
  badges: LocalizedText[]
  steps: LocalizedText[][]
  ruleHead: LocalizedText[]
  rules: string[][]
  outItems: LocalizedText[]
  guardItems: LocalizedText[]
  order: number
}

export interface SystemHealth {
  llm: { available: boolean; provider: string; baseUrl: string; chatModel: string; embedModel: string }
  ocr: { available: boolean; enabled: boolean; baseUrl: string; mode: string }
  vector: { available: boolean; provider: string; baseUrl: string; collection: string }
  storageRoot: string
  ready: boolean
}

/** 可在线编辑的模型提示词 */
export interface PromptTemplate {
  key: string
  group: string
  name: LocalizedText
  description: LocalizedText
  systemText: string
  userTemplate: string
  defaultSystemText: string
  defaultUserTemplate: string
  customized: boolean
  placeholderCount: number
  sortOrder: number
  updatedAt: string
}

export interface PromptSaveRequest {
  systemText: string
  userTemplate: string
}
