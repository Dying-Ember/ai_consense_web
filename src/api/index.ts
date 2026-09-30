import { api } from './client'
import type {
  AskResponse,
  ChatMessage,
  DraftDocument,
  DraftProgress,
  DraftVariable,
  EvidenceBundle,
  EvidenceItem,
  ExtractTrace,
  Finding,
  IndexStatus,
  Project,
  PromptSaveRequest,
  PromptTemplate,
  QuickQuestion,
  SkillDoc,
  SystemHealth,
  TemplateItem,
  UploadResult,
  VariableCreateRequest,
  VettingFile,
  VettingMetrics,
  VettingRunResult
} from './types'

export * from './types'
export { api, ApiError, setApiErrorReporter } from './client'

/* ------------------------------------------------------------ 项目 */

export const projectApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  save: (body: Partial<Project> & { id: string; nameZhHans: string; nameZhHant?: string; nameEn?: string }) =>
    api.post<Project>('/projects', body),
  remove: (id: string) => api.delete<void>(`/projects/${id}`)
}

/* ------------------------------------------------------------ 起草 */

export const draftingApi = {
  templates: (projectId: string) => api.get<TemplateItem[]>(`/drafting/${projectId}/templates`),
  templatePreview: (projectId: string, fileKey: string) =>
    api.blob(`/drafting/${projectId}/templates/${fileKey}/preview.pdf`),
  getTemplateText: (projectId: string, fileKey: string) =>
    api.get<{ text: string }>(`/drafting/${projectId}/templates/${fileKey}/text`),
  updateTemplateText: (projectId: string, fileKey: string, text: string) =>
    api.put<{ text: string }>(`/drafting/${projectId}/templates/${fileKey}/text`, { text }),
  uploadTemplates: (projectId: string, files: File[]) =>
    api.upload<UploadResult>(`/drafting/${projectId}/templates/upload`, files),
  replaceTemplate: (projectId: string, fileKey: string, file: File) =>
    api.uploadOne<UploadResult>(`/drafting/${projectId}/templates/${fileKey}/replace`, file),

  inputs: (projectId: string) => api.get<EvidenceItem[]>(`/drafting/${projectId}/inputs`),
  uploadInputs: (projectId: string, files: File[]) =>
    api.upload<UploadResult>(`/drafting/${projectId}/inputs/upload`, files),

  variables: (projectId: string) => api.get<DraftVariable[]>(`/drafting/${projectId}/variables`),
  extract: (projectId: string) => api.post<DraftVariable[]>(`/drafting/${projectId}/variables/extract`),
  extractTrace: (projectId: string) =>
    api.get<ExtractTrace | null>(`/drafting/${projectId}/variables/extract-trace`),
  updateVariable: (
    projectId: string,
    key: string,
    patch: { value?: string; choice?: string; confirmed?: boolean; note?: string; result?: string }
  ) => api.put<DraftVariable>(`/drafting/${projectId}/variables/${key}`, patch),
  createVariable: (projectId: string, body: VariableCreateRequest) =>
    api.post<DraftVariable>(`/drafting/${projectId}/variables`, body),
  confirmAll: (projectId: string, scope: 'BASE' | 'FILE', fileKey?: string) =>
    api.post<DraftVariable[]>(
      `/drafting/${projectId}/variables/confirm-all?scope=${scope}${fileKey ? `&fileKey=${fileKey}` : ''}`
    ),

  progress: (projectId: string) => api.get<DraftProgress>(`/drafting/${projectId}/progress`),
  generate: (projectId: string, lang: string) =>
    api.post<DraftDocument[]>(`/drafting/${projectId}/generate?lang=${encodeURIComponent(lang)}`),
  documents: (projectId: string) => api.get<DraftDocument[]>(`/drafting/${projectId}/documents`),
  updateDocument: (projectId: string, fileKey: string, content: string) =>
    api.put<DraftDocument>(`/drafting/${projectId}/documents/${fileKey}`, { content }),
  download: (projectId: string, fileKey: string, fallbackName: string) =>
    api.download(`/drafting/${projectId}/documents/${fileKey}/download`, fallbackName)
}

/* ------------------------------------------------------------ 审查 */

export const vettingApi = {
  files: (projectId: string) => api.get<VettingFile[]>(`/vetting/${projectId}/files`),
  uploadPackage: (projectId: string, files: File[]) =>
    api.upload<UploadResult>(`/vetting/${projectId}/package/upload`, files),
  run: (projectId: string, lang: string) =>
    api.post<VettingRunResult>(`/vetting/${projectId}/run?lang=${encodeURIComponent(lang)}`),
  findings: (
    projectId: string,
    filters: { search?: string; group?: string; scope?: string; fileKey?: string; page?: string }
  ) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') params.set(key, value)
    })
    const query = params.toString()
    return api.get<Finding[]>(`/vetting/${projectId}/findings${query ? `?${query}` : ''}`)
  },
  metrics: (projectId: string) => api.get<VettingMetrics>(`/vetting/${projectId}/metrics`),
  updateStatus: (projectId: string, code: string, status: string) =>
    api.post<Finding>(`/vetting/${projectId}/findings/${code}/status?status=${encodeURIComponent(status)}`),
  evidence: (projectId: string, code: string) =>
    api.get<EvidenceBundle>(`/vetting/${projectId}/findings/${code}/evidence`),
  exportReport: (projectId: string, lang: string, fallbackName: string) =>
    api.download(`/vetting/${projectId}/report.pdf?lang=${encodeURIComponent(lang)}`, fallbackName)
}

/* ------------------------------------------------------------ 咨询 */

export const adviceApi = {
  rebuildIndex: (projectId: string) => api.post<IndexStatus>(`/advice/${projectId}/index/rebuild`),
  indexStatus: (projectId: string) => api.get<IndexStatus>(`/advice/${projectId}/index/status`),
  messages: (projectId: string) => api.get<ChatMessage[]>(`/advice/${projectId}/messages`),
  clearMessages: (projectId: string) => api.delete<void>(`/advice/${projectId}/messages`),
  ask: (projectId: string, question: string, scope: string) =>
    api.post<AskResponse>(`/advice/${projectId}/ask`, { question, scope }),
  quickQuestions: (projectId: string) => api.get<QuickQuestion[]>(`/advice/${projectId}/quick-questions`)
}

/* ------------------------------------------------------------ 技能与系统 */

export const skillApi = {
  list: () => api.get<SkillDoc[]>('/skills'),
  save: (id: string, doc: SkillDoc) => api.put<SkillDoc>(`/skills/${id}`, doc),
  reset: (id: string) => api.post<SkillDoc>(`/skills/${id}/reset`)
}

export const systemApi = {
  health: () => api.get<SystemHealth>('/system/health')
}

/** 提示词配置（在线编辑，保存后立即对后续模型调用生效） */
export const promptApi = {
  list: () => api.get<PromptTemplate[]>('/prompts'),
  save: (key: string, body: PromptSaveRequest) =>
    api.put<PromptTemplate>(`/prompts/${encodeURIComponent(key)}`, body),
  reset: (key: string) => api.post<PromptTemplate>(`/prompts/${encodeURIComponent(key)}/reset`)
}
