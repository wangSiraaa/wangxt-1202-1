<template>
  <a-layout style="min-height: 100vh">
    <a-layout-header class="header">
      <div class="header-content">
        <div class="logo">
          <FileTextOutlined style="font-size: 20px; margin-right: 8px" />
          <span class="title">药品广告合规审查系统</span>
        </div>
        <div class="header-right">
          <a-space>
            <span class="role-badge">
              <UserOutlined />
              当前角色：
              <a-select v-model:value="currentRole" @change="handleRoleChange" style="width: 120px">
                <a-select-option value="MARKETING">市场部</a-select-option>
                <a-select-option value="MEDICAL">医学审核</a-select-option>
                <a-select-option value="LEGAL">法务</a-select-option>
              </a-select>
            </span>
            <span v-if="userStore.currentUser">
              <UserOutlined /> {{ userStore.currentUser.displayName || userStore.currentUser.name }}
            </span>
          </a-space>
        </div>
      </div>
    </a-layout-header>

    <a-layout>
      <a-layout-sider width="200" theme="light">
        <a-menu
          v-model:selectedKeys="selectedKeys"
          mode="inline"
          @click="handleMenuClick"
        >
          <a-menu-item key="/materials">
            <template #icon><FileTextOutlined /></template>
            宣传素材
          </a-menu-item>
          <a-menu-item key="/medical" v-if="userStore.isMedical || true">
            <template #icon><CheckCircleOutlined /></template>
            医学审核
          </a-menu-item>
          <a-menu-item key="/legal" v-if="userStore.isLegal || true">
            <template #icon><SafetyOutlined /></template>
            法务审核
          </a-menu-item>
          <a-menu-item key="/published">
            <template #icon><CloudUploadOutlined /></template>
            版本发布
          </a-menu-item>
        </a-menu>
      </a-layout-sider>

      <a-layout-content>
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { 
  FileTextOutlined, 
  UserOutlined, 
  CheckCircleOutlined, 
  SafetyOutlined,
  CloudUploadOutlined
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { useUserStore } from '@/store/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const selectedKeys = ref(['/materials']);
const currentRole = ref('MARKETING');

const roleName = computed(() => {
  const roles = {
    MARKETING: '市场部',
    MEDICAL: '医学审核',
    LEGAL: '法务'
  };
  return roles[userStore.role] || '市场部';
});

onMounted(() => {
  userStore.initFromStorage();
  currentRole.value = userStore.role;
  selectedKeys.value = [route.path];
});

const handleRoleChange = (role) => {
  userStore.setRole(role);
  message.success(`已切换到${roleName.value}角色`);
};

const handleMenuClick = ({ key }) => {
  router.push(key);
};
</script>

<style scoped>
.header {
  background: #fff;
  padding: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 64px;
}

.logo {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 18px;
  color: #1890ff;
}

.title {
  background: linear-gradient(135deg, #1890ff 0%, #722ed1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-right {
  display: flex;
  align-items: center;
}
</style>
