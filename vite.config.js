import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  // 核心修改：只读取环境变量，没有任何默认文字。如果没有变量，就是空字符串。
  const appTitle = env.VITE_SITE_TITLE || ''

  return {
    plugins: [
      vue(),
      vueDevTools(),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          // 替换标题
          let newHtml = html.replace(/%SITE_TITLE%/g, appTitle)
          
          // 顺便处理 meta description，如果 html 里有的话
          const appDesc = env.VITE_SITE_DESCRIPTION || ''
          newHtml = newHtml.replace(/%SITE_DESCRIPTION%/g, appDesc)
          
          return newHtml
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
