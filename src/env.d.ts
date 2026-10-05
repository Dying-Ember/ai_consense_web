/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'mammoth/mammoth.browser.min.js' {
  interface MammothResult {
    value: string
    messages: unknown[]
  }
  interface MammothConvertOptions {
    arrayBuffer?: ArrayBuffer
    styleMap?: string[]
    includeDefaultStyleMap?: boolean
    [key: string]: unknown
  }
  interface MammothLib {
    convertToHtml(input: { arrayBuffer: ArrayBuffer } | MammothConvertOptions): Promise<MammothResult>
    convertToText?(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>
  }
  const mammoth: MammothLib
  export default mammoth
}
