import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // 允许局域网 IP / 任意 host 访问（Vite 7+ 用 allowedHosts 替代已废弃的 cors）
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // 审查 / 变量抽取会调用本地大模型，超时放宽到 10 分钟
        timeout: 600000,
        proxyTimeout: 600000
      }
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    target: 'esnext'   // pdfjs-dist 4.x 使用了 top-level await
  },
  optimizeDeps: {
    // pdfjs-dist / tesseract.js 都是按需动态 import 的大依赖，预构建避免 dev 加载失败
    include: ['pdfjs-dist', 'tesseract.js'],
    esbuildOptions: {
      target: 'esnext'   // pdfjs-dist 4.x 含 top-level await
    }
  },
  worker: {
    format: 'es'
  }
})
