import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig(({ mode }) => {
  // 加载环境变量，允许读取所有变量
  const env = loadEnv(mode, process.cwd(), '')
  
  // 确定最终标题：
  // 1. 优先读取 VITE_SITE_TITLE (您的设置)
  // 2. 其次读取 VITE_SITE_NAME (您的冗余设置)
  // 3. 最后兜底 '猫猫导航'
  const finalTitle = env.VITE_SITE_TITLE || env.VITE_SITE_NAME || '猫猫导航'

  return {
    plugins: [
      vue(),
      vueDevTools(),
      // 核心插件：在 HTML 构建阶段直接替换标题，彻底解决闪烁
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          // 将 HTML 中的 %SITE_TITLE% 替换为环境变量的值
          return html.replace(/%SITE_TITLE%/g, finalTitle)
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
