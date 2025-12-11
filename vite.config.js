import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  // 1. 优先读取环境变量
  // 2. 如果没变量，显示 "Loading..."
  // 3. 绝对不写 "猫猫导航"
  const appTitle = env.VITE_SITE_TITLE || 'Loading...'
  const appDesc = env.VITE_SITE_DESCRIPTION || ''

  return {
    plugins: [
      vue(),
      vueDevTools(),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html
            .replace(/%SITE_TITLE%/g, appTitle)
            .replace(/%SITE_DESCRIPTION%/g, appDesc)
        }
      }
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
