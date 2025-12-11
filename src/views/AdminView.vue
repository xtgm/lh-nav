<template>
  <div class="admin-container">
    <!-- 登录界面 -->
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

    <!-- 管理界面 -->
    <div v-else class="admin-dashboard">
      <!-- 顶部导航 -->
      <header class="admin-header">
        <div class="header-content">
          <h1>🛠️ {{ adminPageTitle }}</h1>
          <div class="header-actions">
            <button @click="emergencyReset" class="emergency-btn" hidden="true">🚨 紧急重置</button>
            <button @click="debugLoadData" class="debug-btn" hidden="true">🔍 调试加载</button>
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
            <!-- <button @click="skipLoading" class="skip-loading-btn">跳过加载</button> -->
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
const { saveCategoriesToGitHub, loadCategoriesFromGitHub } = useGitHubAPI()

const isAuthenticated = ref(false)
const loginPassword = ref('')
const loginError = ref('')
const loading = ref(false)
const saving = ref(false)

const activeTab = ref('categories')
const categories = ref([])

// ==========================================
// 核心修复 1: 初始化时直接优先读取环境变量
// 绝对不写 "猫猫导航" 作为默认值
// ==========================================
const navTitle = ref(import.meta.env.VITE_SITE_TITLE || '导航后台')

const selectedCategoryId = ref('') 

const envAdminTitle = import.meta.env.VITE_ADMIN_TITLE
const envSiteTitle = import.meta.env.VITE_SITE_TITLE

const adminPageTitle = computed(() => {
  if (envAdminTitle) {
    return envAdminTitle 
  }
  // 确保这里使用的是优先读取过环境变量的 title
  const siteName = envSiteTitle || navTitle.value || '导航后台'
  return `管理后台 - ${siteName}`
})

setTimeout(() => {
  if (loading.value) {
    console.warn('检测到loading状态异常，强制重置')
    loading.value = false
    if (categories.value.length === 0) {
      categories.value = [{ id: 'default', name: '默认分类', icon: '📁', order: 0, sites: [] }]
    }
  }
}, 8000)

const dialogVisible = ref(false)
const dialogType = ref('success')
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogDetails = ref([])

const updateDocTitle = () => {
  document.title = adminPageTitle.value
}

const handleLogin = async () => {
  loading.value = true
  loginError.value = ''
  try {
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD
    if (!adminPassword) throw new Error('管理密钥未配置，请配置环境变量')
    if (loginPassword.value === adminPassword) {
      isAuthenticated.value = true
      localStorage.setItem('admin_authenticated', 'true')
      
      // 登录成功后立即加载数据
      await loadCategories()
    } else {
      throw new Error('密钥错误，请重新输入')
    }
  } catch (error) {
    loginError.value = error.message
    // 登录失败才关闭 loading，否则保持 loading 直到数据加载完成
    loading.value = false
  }
}

const logout = () => {
  isAuthenticated.value = false
  localStorage.removeItem('admin_authenticated')
  loginPassword.value = ''
  router.push('/')
}

const debugLoadData = async () => {
  try {
    const data = await loadCategoriesFromGitHub()
    showDialog('success', '🎉 调试成功', '直接调用GitHub API成功', [`数据分类数: ${data.categories?.length || 0}`])
  } catch (error) {
    showDialog('error', '❌ 调试失败', error.message)
  }
}

// ==========================================
// 核心修复 2: 数据加载逻辑，锁死环境变量优先级
// ==========================================
const loadCategories = async () => {
  loading.value = true
  try {
    // 强制从 GitHub API 拉取最新数据
    const data = await loadCategoriesFromGitHub()
    
    if (data && data.categories) {
      categories.value = data.categories
      
      // 优先级判断：如果环境变量存在，无视 API 返回的 title
      if (import.meta.env.VITE_SITE_TITLE) {
        navTitle.value = import.meta.env.VITE_SITE_TITLE
      } else {
        navTitle.value = data.title || '导航后台'
      }
      
      console.log('✅ 成功从 GitHub 加载最新数据')
    } else {
      categories.value = []
      console.warn('⚠️ GitHub 数据为空')
    }
    updateDocTitle() 
  } catch (error) {
    console.error('加载失败:', error)
    categories.value = []
    // 如果没有环境变量，才给个默认值
    if (!import.meta.env.VITE_SITE_TITLE) {
       navTitle.value = '导航后台'
    }
    updateDocTitle()
    showDialog('error', '数据加载失败', '无法从 GitHub 获取数据，请检查网络或 Token 配置。', [error.message])
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

// ==========================================
// 核心修复 3: 跳过加载逻辑，同样锁死环境变量
// ==========================================
const skipLoading = async () => {
  loading.value = false
  // 即使是跳过加载使用兜底数据，也要尊重环境变量
  if (import.meta.env.VITE_SITE_TITLE) {
    navTitle.value = import.meta.env.VITE_SITE_TITLE
  } else {
    navTitle.value = '导航后台'
  }
  
  // 给一个空的或者默认的分类结构，防止报错
  if (categories.value.length === 0) {
    categories.value = [{ id: 'default', name: '默认分类', icon: '📁', order: 0, sites: [] }]
  }
  updateDocTitle()
}

const saveToGitHub = async () => {
  saving.value = true
  try {
    await saveCategoriesToGitHub({
      categories: categories.value,
      // 保存时，如果环境变量有值，title 实际上存什么都不重要，因为读取时会优先读环境变量
      // 但为了数据一致性，我们还是存当前的 title
      title: navTitle.value
    })
    showDialog('success', '🎉 保存成功', '您的更改已成功保存到GitHub仓库！', ['• 更改将在 2-3 分钟内自动部署到线上'])
  } catch (error) {
    showDialog('error', '❌ 保存失败', '保存过程中发生错误', [`• 详情: ${error.message}`])
  } finally {
    saving.value = false
  }
}

const emergencyReset = () => {
  loading.value = false
  const loadingOverlay = document.querySelector('.loading-overlay')
  if (loadingOverlay) loadingOverlay.style.display = 'none'
}

onMounted(() => {
  updateDocTitle()
  // 初始化时确保 loading 状态正确
  loading.value = false
  
  const savedAuth = localStorage.getItem('admin_authenticated')
  if (savedAuth === 'true') {
    isAuthenticated.value = true
    // 已认证则自动加载数据
    loadCategories()
  }
})
</script>

<style scoped>
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

.emergency-btn {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
  margin-right: 15px;
}

.emergency-btn:hover {
  background: #c0392b;
}

.debug-btn {
  padding: 8px 16px;
  background: #f39c12;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
  margin-right: 15px;
}

.debug-btn:hover {
  background: #e67e22;
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
  margin-right: 15px;
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

.skip-loading-btn {
  margin-top: 20px;
  padding: 10px 20px;
  background: #f39c12;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.skip-loading-btn:hover {
  background: #e67e22;
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
