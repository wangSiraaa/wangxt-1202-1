<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">已发布版本</span>
      <a-tag color="success">已发布: {{ total }}</a-tag>
    </div>

    <div class="card-wrapper">
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
            <a @click="goDetail(record.material_id)">{{ record.title }}</a>
          </template>
          <template v-else-if="column.key === 'version'">
            <a-tag color="green">v{{ record.version }}</a-tag>
          </template>
          <template v-else-if="column.key === 'is_latest'">
            <a-tag v-if="record.is_latest" color="success">
              <CrownOutlined /> 最新版本
            </a-tag>
          </template>
          <template v-else-if="column.key === 'published_at'">
            {{ formatDate(record.published_at) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="goDetail(record.material_id)">
                查看详情
              </a-button>
              <a-button 
                type="primary" 
                size="small" 
                ghost
                @click="createNewVersion(record.material_id)"
              >
                <ReloadOutlined /> 创建新版本
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
import { message, Modal } from 'ant-design-vue';
import { 
  CrownOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue';
import { publishedApi, materialApi } from '@/api';
import { formatDate } from '@/utils/constants';

const router = useRouter();

const loading = ref(false);
const dataList = ref([]);
const total = ref(0);

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`
});

const columns = [
  { title: '标题', dataIndex: 'title', key: 'title', width: 220 },
  { title: '药品名称', dataIndex: 'drug_name', key: 'drug_name', width: 150 },
  { title: '版本', dataIndex: 'version', key: 'version', width: 100 },
  { title: '状态', key: 'is_latest', width: 120 },
  { title: '发布人', dataIndex: 'publisher', key: 'publisher', width: 100 },
  { title: '发布时间', dataIndex: 'published_at', key: 'published_at', width: 160 },
  { title: '操作', key: 'action', width: 220, fixed: 'right' }
];

const loadData = async () => {
  loading.value = true;
  try {
    const res = await publishedApi.list({
      page: pagination.current,
      pageSize: pagination.pageSize
    });
    dataList.value = res.data.list;
    pagination.total = res.data.total;
    total.value = res.data.total;
  } catch (e) {
    message.error(e.message);
  } finally {
    loading.value = false;
  }
};

const handleTableChange = (pag) => {
  pagination.current = pag.current;
  pagination.pageSize = pag.pageSize;
  loadData();
};

const goDetail = (materialId) => {
  router.push(`/materials/${materialId}`);
};

const createNewVersion = (materialId) => {
  Modal.confirm({
    title: '创建新版本',
    content: '将基于已发布的版本创建一个新版本，原版本保持锁定不变。是否继续？',
    okText: '确认创建',
    cancelText: '取消',
    onOk: async () => {
      try {
        const res = await materialApi.createNewVersion(materialId);
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
