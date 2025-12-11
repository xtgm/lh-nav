<!-- src/views/AdminView.vue -->
<template>
  <div class="admin-container">
    <!-- 登录界面 (保持不变) -->
    <div v-if="!isAuthenticated" class="login-container">
      <div class="login-box">
        <h1>🔐 {{ adminPageTitle }}</h1>
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label for="password">管理密钥:</label>
            <input
              id="password"
              type="password"
              v-model="loginPassword"
              placeholder="请输入管理密钥"
              required
              class="form-input"
            />
          </div>
          <button type="submit" class="login-btn" :disabled="loading">
            {{ loading ? '验证中...' : '登录' }}
          </button>
        </form>
        <div v-if="loginError" class="error-message">
          {{ loginError }}
        </div>
      </div>
    </div>

    <!-- 管理界面 (保持不变) -->
    <div v-else class="admin-dashboard">
      <!-- 顶部导航 -->
      <header class="admin-header">
        <div class="header-content">
          <h1>🛠️ {{ adminPageTitle }}</h1>
          <div class="header-actions">
            <span class="user-info">管理员</span>
            <button @click="logout" class="logout-btn">退出</button>
          </div>
        </div>
      </header>

      <!-- 主要内容 -->
      <main class="admin-main">
        <!-- 加载状态显示 -->
        <div v-if="loading" class="loading-overlay">
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>正在从 GitHub 同步最新数据...</p>
          </div>
        </div>

        <div class="admin-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'categories' }"
            @click="activeTab = 'categories'"
          >
            📁 分类管理
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'sites' }"
            @click="switchToSiteTab"
          >
            🌐 站点管理
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'settings' }"
            @click="activeTab = 'settings'"
          >
            ⚙️ 系统设置
          </button>
        </div>

        <!-- 分类管理 -->
        <div v-if="activeTab === 'categories'" class="tab-content">
          <CategoryManager
            :categories="categories"
            @update="handleCategoriesUpdate"
            @save="saveToGitHub"
            @viewSites="switchToSiteManager"
            :loading="saving"
          />
        </div>

        <!-- 站点管理 -->
        <div v-if="activeTab === 'sites'" class="tab-content">
          <SiteManager
            :categories="categories"
            :initialSelectedCategoryId="selectedCategoryId"
            @update="handleCategoriesUpdate"
            @save="saveToGitHub"
            :loading="saving"
          />
        </div>

        <!-- 系统设置 -->
        <div v-if="activeTab === 'settings'" class="tab-content">
          <SystemSettings />
        </div>
      </main>
    </div>

    <!-- 自定义弹框 -->
    <CustomDialog
      :visible="dialogVisible"
      :type="dialogType"
      :title="dialogTitle"
      :message="dialogMessage"
      :details="dialogDetails"
      @close="closeDialog"
      @confirm="closeDialog"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import CategoryManager from '../components/admin/CategoryManager.vue'
import SiteManager from '../components/admin/SiteManager.vue'
import SystemSettings from '../components/admin/SystemSettings.vue'
import CustomDialog from '../components/admin/CustomDialog.vue'
import { useGitHubAPI } from '../apis/useGitHubAPI.js'

const router = useRouter()
// 引入 GitHub API 钩子
const { saveCategoriesToGitHub, loadCategoriesFromGitHub } = useGitHubAPI()

const isAuthenticated = ref(false)
const loginPassword = ref('')
const loginError = ref('')
const loading = ref(false)
const saving = ref(false)

const activeTab = ref('categories')
const categories = ref([])
const navTitle = ref(import.meta.env.VITE_SITE_TITLE || '导航后台')
const selectedCategoryId = ref('') 

const envAdminTitle = import.meta.env.VITE_ADMIN_TITLE
const envSiteTitle = import.meta.env.VITE_SITE_TITLE

const adminPageTitle = computed(() => {
  if (envAdminTitle) {
    return envAdminTitle 
  }
  const siteName = envSiteTitle || navTitle.value || '猫猫导航'
  return `导航站管理 - ${siteName}`
})

// 弹框相关状态
const dialogVisible = ref(false)
const dialogType = ref('success')
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogDetails = ref([])

const updateDocTitle = () => {
  document.title = adminPageTitle.value
}

// 登录处理
const handleLogin = async () => {
  loading.value = true
  loginError.value = ''
  try {
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD
    if (!adminPassword) throw new Error('管理密钥未配置，请在后台环境变量中配置 VITE_ADMIN_PASSWORD')
    
    if (loginPassword.value === adminPassword) {
      isAuthenticated.value = true
      localStorage.setItem('admin_authenticated', 'true')
      
      // 登录成功后，立即尝试从 GitHub 加载数据
      await loadCategories()
    } else {
      throw new Error('密钥错误，请重新输入')
    }
  } catch (error) {
    loginError.value = error.message
    loading.value = false // 登录失败才关闭 loading
  }
}

const logout = () => {
  isAuthenticated.value = false
  localStorage.removeItem('admin_authenticated')
  loginPassword.value = ''
  router.push('/')
}

// 核心修复：直接从 GitHub API 加载数据，不再读取本地 mock 文件
const loadCategories = async () => {
  loading.value = true
  try {
    // 调用 API 获取 GitHub 上最新的 mock_data.js 内容
    const data = await loadCategoriesFromGitHub()
    
    // 修改后：(增加优先级判断：如果环境变量有值，绝不使用 data.title)
if (data && data.categories) {
  categories.value = data.categories
  
  // 核心逻辑：环境变量优先级最高 > GitHub数据 > 默认值
  if (import.meta.env.VITE_SITE_TITLE) {
    navTitle.value = import.meta.env.VITE_SITE_TITLE
  } else {
    navTitle.value = data.title || '导航后台'
  }
  
  console.log('✅ 成功从 GitHub 加载最新数据')
}
    } else {
      console.warn('⚠️ GitHub 数据为空或格式错误，初始化为空分类')
      categories.value = []
    }
    updateDocTitle() 
  } catch (error) {
    console.error('❌ 加载 GitHub 数据失败:', error)
    // 如果 API 失败（比如第一次没配 Token），给一个友好的提示或空状态，而不是回滚到旧数据
    categories.value = []
    showDialog('error', '数据同步失败', '无法从 GitHub 获取最新数据，请检查 VITE_GITHUB_TOKEN 是否配置正确。', [error.message])
  } finally {
    loading.value = false
  }
}

const handleCategoriesUpdate = (newCategories) => {
  categories.value = newCategories
}

const switchToSiteManager = (categoryId) => {
  selectedCategoryId.value = categoryId
  activeTab.value = 'sites'
}

const switchToSiteTab = () => {
  selectedCategoryId.value = '' 
  activeTab.value = 'sites'
}

const showDialog = (type, title, message, details = []) => {
  dialogType.value = type
  dialogTitle.value = title
  dialogMessage.value = message
  dialogDetails.value = details
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
}

const saveToGitHub = async () => {
  saving.value = true
  try {
    await saveCategoriesToGitHub({
      categories: categories.value,
      title: navTitle.value
    })
    showDialog('success', '🎉 保存成功', '您的更改已成功保存到 GitHub 仓库！', ['• GitHub Actions 将自动触发构建', '• 请等待 2-3 分钟后刷新前台页面查看效果'])
  } catch (error) {
    showDialog('error', '❌ 保存失败', '保存过程中发生错误', [`• 详情: ${error.message}`])
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  updateDocTitle()
  // 检查是否已登录
  const savedAuth = localStorage.getItem('admin_authenticated')
  if (savedAuth === 'true') {
    isAuthenticated.value = true
    // 已登录状态下，组件挂载即加载数据
    loadCategories()
  }
})
</script>

<style scoped>
/* 保持原有样式不变 */
.admin-container {
  min-height: 100vh;
  background: #2c3e50;
}

.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
}

.login-box {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 400px;
}

.login-box h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #2c3e50;
  font-size: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
}

.login-btn {
  width: 100%;
  padding: 12px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.login-btn:hover:not(:disabled) {
  background: #2980b9;
}

.login-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.error-message {
  margin-top: 15px;
  padding: 10px;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
}

.admin-dashboard {
  min-height: 100vh;
  background: #f5f7fa;
}

.admin-header {
  background: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 30px;
  max-width: 1200px;
  margin: 0 auto;
}

.header-content h1 {
  color: #2c3e50;
  margin: 0;
  font-size: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info {
  color: #7f8c8d;
  font-size: 14px;
}

.logout-btn {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.logout-btn:hover {
  background: #c0392b;
}

.admin-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(3px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.admin-tabs {
  display: flex;
  background: white;
  border-radius: 8px;
  padding: 5px;
  margin-bottom: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #7f8c8d;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.tab-btn.active {
  background: #3498db;
  color: white;
}

.tab-btn:hover:not(.active) {
  background: #f8f9fa;
  color: #2c3e50;
}

.tab-content {
  background: white;
  border-radius: 8px;
  padding: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .header-content {
    padding: 15px 20px;
  }
  .admin-main {
    padding: 20px 15px;
  }
  .tab-content {
    padding: 20px 15px;
  }
  .admin-tabs {
    flex-direction: column;
  }
  .tab-btn {
    margin-bottom: 5px;
  }
}
</style>
