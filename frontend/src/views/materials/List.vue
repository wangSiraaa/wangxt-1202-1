<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">宣传素材</span>
      <a-button type="primary" @click="goCreate" v-if="userStore.isMarketing">
        <PlusOutlined /> 新建素材
      </a-button>
    </div>

    <div class="card-wrapper">
      <a-form layout="inline" style="margin-bottom: 16px">
        <a-form-item label="状态">
          <a-select v-model:value="queryParams.status" placeholder="全部状态" style="width: 150px" allow-clear>
            <a-select-option v-for="(item, key) in STATUS_MAP" :key="key" :value="key">
              {{ item.text }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="关键词">
          <a-input 
            v-model:value="queryParams.keyword" 
            placeholder="搜索标题/药品名" 
            style="width: 200px"
            @pressEnter="loadData"
          />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="loadData">
            <SearchOutlined /> 查询
          </a-button>
          <a-button style="margin-left: 8px" @click="resetQuery">
            <ReloadOutlined /> 重置
          </a-button>
        </a-form-item>
      </a-form>

      <a-table 
        :columns="columns" 
        :data-source="dataList" 
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <a @click="goDetail(record.id)">{{ record.title }}</a>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'current_step'">
            <a-tag :color="getStepColor(record.current_step)">
              {{ getStepText(record.current_step) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'version'">
            v{{ record.version }}
          </template>
          <template v-else-if="column.key === 'created_at'">
            {{ formatDate(record.created_at) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="goDetail(record.id)">
                详情
              </a-button>
              <a-button 
                type="link" 
                size="small" 
                @click="goEdit(record.id)"
                v-if="canEdit(record)"
              >
                编辑
              </a-button>
              <a-button 
                type="link" 
                size="small" 
                @click="handleSubmit(record)"
                v-if="canSubmit(record)"
              >
                提交审核
              </a-button>
              <a-button 
                type="link" 
                size="small" 
                @click="handleNewVersion(record)"
                v-if="record.status === 'PUBLISHED'"
              >
                创建新版本
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { 
  PlusOutlined, 
  SearchOutlined, 
  ReloadOutlined 
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { materialApi } from '@/api';
import { useUserStore } from '@/store/user';
import { STATUS_MAP, getStatusText, getStatusColor, getStepText, getStepColor, formatDate } from '@/utils/constants';

const router = useRouter();
const userStore = useUserStore();

const loading = ref(false);
const dataList = ref([]);

const queryParams = reactive({
  status: undefined,
  keyword: '',
  page: 1,
  pageSize: 10
});

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`
});

const columns = [
  { title: '标题', dataIndex: 'title', key: 'title', width: 200 },
  { title: '药品名称', dataIndex: 'drug_name', key: 'drug_name', width: 150 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '当前环节', dataIndex: 'current_step', key: 'current_step', width: 100 },
  { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
  { title: '创建人', dataIndex: 'created_by', key: 'created_by', width: 100 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  { title: '操作', key: 'action', width: 240, fixed: 'right' }
];

const canEdit = (record) => {
  if (!userStore.isMarketing) return false;
  return ['DRAFT', 'MEDICAL_REJECTED', 'LEGAL_REJECTED'].includes(record.status);
};

const canSubmit = (record) => {
  if (!userStore.isMarketing) return false;
  return ['DRAFT', 'MEDICAL_REJECTED', 'LEGAL_REJECTED'].includes(record.status);
};

const loadData = async () => {
  loading.value = true;
  try {
    const params = {
      status: queryParams.status,
      page: queryParams.page,
      pageSize: queryParams.pageSize
    };
    if (queryParams.keyword) {
      params.keyword = queryParams.keyword;
    }
    const res = await materialApi.list(params);
    dataList.value = res.data.list;
    pagination.total = res.data.total;
    pagination.current = res.data.page;
    pagination.pageSize = res.data.pageSize;
  } catch (e) {
    message.error(e.message);
  } finally {
    loading.value = false;
  }
};

const resetQuery = () => {
  queryParams.status = undefined;
  queryParams.keyword = '';
  queryParams.page = 1;
  loadData();
};

const handleTableChange = (pag) => {
  queryParams.page = pag.current;
  queryParams.pageSize = pag.pageSize;
  loadData();
};

const goCreate = () => {
  router.push('/materials/create');
};

const goEdit = (id) => {
  router.push(`/materials/${id}/edit`);
};

const goDetail = (id) => {
  router.push(`/materials/${id}`);
};

const handleSubmit = (record) => {
  Modal.confirm({
    title: '确认提交',
    content: `确认提交"${record.title}"进行医学审核吗？提交后将进入医学审核环节。`,
    okText: '确认提交',
    cancelText: '取消',
    onOk: async () => {
      try {
        await materialApi.submit(record.id);
        message.success('提交成功，已进入医学审核环节');
        loadData();
      } catch (e) {
        message.error(e.message);
      }
    }
  });
};

const handleNewVersion = (record) => {
  Modal.confirm({
    title: '创建新版本',
    content: `基于已发布版本创建"${record.title}"的新版本吗？`,
    okText: '创建',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await materialApi.newVersion(record.id);
        message.success('新版本创建成功');
        router.push(`/materials/${res.data.id}/edit`);
      } catch (e) {
        message.error(e.message);
      }
    }
  });
};

onMounted(() => {
  loadData();
});
</script>
