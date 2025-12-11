import { createRouter, createWebHistory } from 'vue-router'
// 确保引用路径正确，如果你的项目结构不同，请调整这里的引用
import NavHomeView from '../views/NavHomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: NavHomeView
    },
    {
      path: '/admin',
      name: 'admin',
      // 路由懒加载
      component: () => import('../views/AdminView.vue')
    }
  ]
})

// 全局前置守卫：进入路由前强制设置标题
router.beforeEach((to, from, next) => {
  const envTitle = import.meta.env.VITE_SITE_TITLE
  
  if (envTitle && envTitle.trim() !== '') {
    document.title = envTitle
  }
  next()
})

// 全局后置钩子：路由结束后再次确认标题，防止被组件内的逻辑覆盖
router.afterEach(() => {
  const envTitle = import.meta.env.VITE_SITE_TITLE
  
  if (envTitle && envTitle.trim() !== '') {
    // 使用 setTimeout 确保这是最后执行的逻辑
    setTimeout(() => {
      document.title = envTitle
    }, 50)
  }
})

export default router
