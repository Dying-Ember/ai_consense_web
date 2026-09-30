import axios, { type AxiosRequestConfig } from 'axios'

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export class ApiError extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.code = code
    this.name = 'ApiError'
  }
}

const http = axios.create({
  baseURL: '/api',
  // 变量抽取 / 审查 / 文稿生成都会调用本地模型，给足时间
  timeout: 600000,
  headers: { 'Content-Type': 'application/json' }
})

/** 错误提示回调由 app store 注入，避免 api 层依赖 UI */
let errorReporter: ((message: string) => void) | null = null

export function setApiErrorReporter(reporter: (message: string) => void) {
  errorReporter = reporter
}

async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const response = await promise
    const envelope = response.data
    if (envelope.code !== 0) {
      throw new ApiError(envelope.code, envelope.message || '请求失败')
    }
    return envelope.data
  } catch (error) {
    const message = toMessage(error)
    errorReporter?.(message)
    throw error instanceof ApiError ? error : new ApiError(-1, message)
  }
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return '本地模型响应超时，请确认 Ollama 已加载模型后重试'
    }
    if (!error.response) {
      return '无法连接后端服务（http://localhost:8080），请先启动 service'
    }
    const data = error.response.data as ApiEnvelope<unknown> | undefined
    return data?.message || `请求失败：HTTP ${error.response.status}`
  }
  return error instanceof Error ? error.message : '未知错误'
}

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) => unwrap<T>(http.get(url, config)),
  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => unwrap<T>(http.post(url, body, config)),
  put: <T>(url: string, body?: unknown) => unwrap<T>(http.put(url, body)),
  delete: <T>(url: string) => unwrap<T>(http.delete(url)),
  upload: <T>(url: string, files: File[]) => {
    const form = new FormData()
    files.forEach((file) => form.append('files', file))
    return unwrap<T>(http.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } }))
  },
  /** 单文件上传（字段名 file）：用于替换指定标准模板等场景 */
  uploadOne: <T>(url: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return unwrap<T>(http.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } }))
  },
  /** 下载二进制（文稿 / 审查报告） */
  download: async (url: string, fallbackName: string) => {
    try {
      const response = await http.get(url, { responseType: 'blob', timeout: 300000 })
      const disposition = String(response.headers['content-disposition'] || '')
      const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
      const name = match ? decodeURIComponent(match[1]) : fallbackName
      const blobUrl = URL.createObjectURL(response.data as Blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
    } catch (error) {
      const message = toMessage(error)
      errorReporter?.(message)
      throw error
    }
  },
  /** 取二进制 Blob（原件预览：PDF / 文本），不触发下载 */
  blob: async (url: string, timeout = 300000): Promise<Blob> => {
    try {
      const response = await http.get(url, { responseType: 'blob', timeout })
      return response.data as Blob
    } catch (error) {
      const message = toMessage(error)
      errorReporter?.(message)
      throw error
    }
  }
}
