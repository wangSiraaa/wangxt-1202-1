<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">医学审核</span>
      <a-tag color="blue">待审核: {{ pendingCount }}</a-tag>
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
            <a @click="goDetail(record.id)">{{ record.title }}</a>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
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
                type="primary" 
                size="small" 
                @click="goReview(record.id)"
              >
                审核
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { medicalApi } from '@/api';
import { useUserStore } from '@/store/user';
import { getStatusText, getStatusColor, formatDate } from '@/utils/constants';

const router = useRouter();
const userStore = useUserStore();

const loading = ref(false);
const dataList = ref([]);
const pendingCount = ref(0);

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
  { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
  { title: '创建人', dataIndex: 'created_by', key: 'created_by', width: 100 },
  { title: '提交时间', dataIndex: 'updated_at', key: 'created_at', width: 160 },
  { title: '操作', key: 'action', width: 150, fixed: 'right' }
];

const loadData = async () => {
  loading.value = true;
  try {
    const res = await medicalApi.pending({
      page: pagination.current,
      pageSize: pagination.pageSize
    });
    dataList.value = res.data.list;
    pagination.total = res.data.total;
    pendingCount.value = res.data.total;
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

const goDetail = (id) => {
  router.push(`/materials/${id}`);
};

const goReview = (id) => {
  router.push(`/medical/${id}/review`);
};

onMounted(() => {
  loadData();
});
</script>
