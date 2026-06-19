<template>
  <div class="page-container">
    <div class="page-header">
      <a-button @click="goBack">
        <ArrowLeftOutlined /> 返回
      </a-button>
      <span class="page-title">素材详情</span>
      <a-space v-if="detail">
        <a-tag :color="getStatusColor(detail.status)">
          {{ getStatusText(detail.status) }}
        </a-tag>
        <a-tag :color="getStepColor(detail.current_step)">
          {{ getStepText(detail.current_step) }}
        </a-tag>
        <span>v{{ detail.version }}</span>
      </a-space>
    </div>

    <div v-if="loading" style="text-align: center; padding: 40px">
      <a-spin size="large" />
    </div>

    <div v-else-if="detail">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="basic" tab="基本信息">
          <div class="card-wrapper">
            <a-descriptions :column="2" bordered size="middle">
              <a-descriptions-item label="标题">
                {{ detail.title }}
              </a-descriptions-item>
              <a-descriptions-item label="药品名称">
                {{ detail.drug_name }}
              </a-descriptions-item>
              <a-descriptions-item label="批准文号">
                {{ detail.approval_number || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="适应症">
                {{ detail.indication || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="禁忌">
                {{ detail.contraindication || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="风险警示语">
                {{ detail.risk_warning || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="创建人">
                {{ detail.created_by }}
              </a-descriptions-item>
              <a-descriptions-item label="创建时间">
                {{ formatDate(detail.created_at) }}
              </a-descriptions-item>
              <a-descriptions-item label="宣传内容" :span="2">
                <div class="detail-value">{{ detail.content }}</div>
              </a-descriptions-item>
              <a-descriptions-item label="医学证据" :span="2">
                <div class="detail-value">{{ detail.medical_evidence || '-' }}</div>
              </a-descriptions-item>
            </a-descriptions>

            <div class="form-footer" v-if="canEdit">
              <a-button @click="goEdit">编辑</a-button>
              <a-button type="primary" style="margin-left: 8px" @click="handleSubmit">
                提交审核
              </a-button>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="medical" tab="医学意见">
          <div class="card-wrapper">
            <a-empty v-if="!detail.medical_opinions || detail.medical_opinions.length === 0" description="暂无医学审核意见" />
            <div v-else>
              <div v-for="(opinion, index) in detail.medical_opinions" :key="opinion.id" style="margin-bottom: 24px">
                <a-card size="small">
                  <template #title>
                    <a-space>
                      <span>v{{ opinion.version }}</span>
                      <a-tag :color="opinion.is_approved ? 'success' : 'warning'">
                        {{ opinion.is_approved ? '通过' : '驳回' }}
                      </a-tag>
                      <span style="color: #999">{{ opinion.reviewer }} - {{ formatDate(opinion.created_at) }}</span>
                    </a-space>
                  </template>
                  <a-descriptions :column="3" size="small">
                    <a-descriptions-item label="适应症核对">
                      <a-badge :status="opinion.indication_check ? 'success' : 'error'" :text="opinion.indication_check ? '符合' : '不符合'" />
                    </a-descriptions-item>
                    <a-descriptions-item label="禁忌核对">
                      <a-badge :status="opinion.contraindication_check ? 'success' : 'error'" :text="opinion.contraindication_check ? '符合' : '不符合'" />
                    </a-descriptions-item>
                    <a-descriptions-item label="医学证据核对">
                      <a-badge :status="opinion.evidence_check ? 'success' : 'error'" :text="opinion.evidence_check ? '充分' : '缺失'" />
                    </a-descriptions-item>
                  </a-descriptions>
                  <div style="margin-top: 12px" v-if="opinion.opinion">
                    <div class="detail-label">审核意见：</div>
                    <div class="detail-value">{{ opinion.opinion }}</div>
                  </div>
                  <div style="margin-top: 8px" v-if="opinion.suggestion">
                    <div class="detail-label">修改建议：</div>
                    <div class="detail-value" style="color: #fa8c16">{{ opinion.suggestion }}</div>
                  </div>
                </a-card>
              </div>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="legal" tab="法务意见">
          <div class="card-wrapper">
            <a-empty v-if="!detail.legal_opinions || detail.legal_opinions.length === 0" description="暂无法务审核意见" />
            <div v-else>
              <div v-for="(opinion, index) in detail.legal_opinions" :key="opinion.id" style="margin-bottom: 24px">
                <a-card size="small">
                  <template #title>
                    <a-space>
                      <span>v{{ opinion.version }}</span>
                      <a-tag :color="opinion.is_approved ? 'success' : 'warning'">
                        {{ opinion.is_approved ? '通过' : '驳回' }}
                      </a-tag>
                      <span style="color: #999">{{ opinion.reviewer }} - {{ formatDate(opinion.created_at) }}</span>
                    </a-space>
                  </template>
                  <a-descriptions :column="3" size="small">
                    <a-descriptions-item label="批准文号核对">
                      <a-badge :status="opinion.approval_number_check ? 'success' : 'error'" :text="opinion.approval_number_check ? '有效' : '无效'" />
                    </a-descriptions-item>
                    <a-descriptions-item label="风险措辞核对">
                      <a-badge :status="opinion.risk_warning_check ? 'success' : 'error'" :text="opinion.risk_warning_check ? '合规' : '不合规'" />
                    </a-descriptions-item>
                    <a-descriptions-item label="超说明书表述">
                      <a-badge :status="opinion.off_label_check ? 'success' : 'error'" :text="opinion.off_label_check ? '无' : '有'" />
                    </a-descriptions-item>
                  </a-descriptions>
                  <div style="margin-top: 12px" v-if="opinion.opinion">
                    <div class="detail-label">审核意见：</div>
                    <div class="detail-value">{{ opinion.opinion }}</div>
                  </div>
                  <div style="margin-top: 8px" v-if="opinion.suggestion">
                    <div class="detail-label">修改建议：</div>
                    <div class="detail-value" style="color: #fa8c16">{{ opinion.suggestion }}</div>
                  </div>
                </a-card>
              </div>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="trails" tab="审核痕迹">
          <div class="card-wrapper">
            <a-timeline v-if="detail.audit_trails && detail.audit_trails.length > 0">
              <a-timeline-item 
                v-for="trail in detail.audit_trails" 
                :key="trail.id"
                :color="trail.action.includes('REJECT') ? 'red' : trail.action.includes('APPROVE') || trail.action === 'PUBLISH' ? 'green' : 'blue'"
              >
                <a-space direction="vertical" style="width: 100%">
                  <a-space>
                    <strong>{{ trail.action_name }}</strong>
                    <a-tag :color="getStepColor(trail.operator_role)">
                      {{ trail.role_name }}
                    </a-tag>
                    <span>{{ trail.operator }}</span>
                    <span style="color: #999">{{ formatDate(trail.created_at) }}</span>
                    <span>v{{ trail.version }}</span>
                  </a-space>
                  <div class="timeline-content">
                    <div v-if="trail.remark">{{ trail.remark }}</div>
                    <div v-if="trail.from_status || trail.to_status" style="margin-top: 8px">
                      <a-tag v-if="trail.from_status" :color="getStatusColor(trail.from_status)">
                        {{ getStatusText(trail.from_status) }}
                      </a-tag>
                      <ArrowRightOutlined v-if="trail.from_status && trail.to_status" style="margin: 0 8px" />
                      <a-tag v-if="trail.to_status" :color="getStatusColor(trail.to_status)">
                        {{ getStatusText(trail.to_status) }}
                      </a-tag>
                    </div>
                    <div v-if="trail.changes && Object.keys(trail.changes).length > 0" class="timeline-changes">
                      <div style="font-weight: 500; margin-bottom: 4px">变更内容：</div>
                      <div v-for="(value, key) in trail.changes" :key="key">
                        {{ getFieldName(key) }}: 
                        <span v-if="value.old !== undefined">{{ value.old }}</span>
                        <span v-if="value.old !== undefined && value.new !== undefined"> → </span>
                        <span v-if="value.new !== undefined" style="color: #52c41a">{{ value.new }}</span>
                        <span v-else>{{ value }}</span>
                      </div>
                    </div>
                  </div>
                </a-space>
              </a-timeline-item>
            </a-timeline>
            <a-empty v-else description="暂无审核痕迹" />
          </div>
        </a-tab-pane>

        <a-tab-pane key="versions" tab="已发布版本">
          <div class="card-wrapper">
            <a-empty v-if="!detail.published_versions || detail.published_versions.length === 0" description="暂无已发布版本" />
            <div v-else>
              <div v-for="version in detail.published_versions" :key="version.id" style="margin-bottom: 16px">
                <a-card size="small">
                  <template #title>
                    <a-space>
                      <a-tag color="success">已发布</a-tag>
                      <span>v{{ version.version }}</span>
                      <span style="color: #999">{{ version.published_by }} - {{ formatDate(version.published_at) }}</span>
                    </a-space>
                  </template>
                  <a-descriptions :column="2" size="small">
                    <a-descriptions-item label="标题">{{ version.title }}</a-descriptions-item>
                    <a-descriptions-item label="药品名称">{{ version.drug_name }}</a-descriptions-item>
                    <a-descriptions-item label="批准文号">{{ version.approval_number }}</a-descriptions-item>
                    <a-descriptions-item label="状态">
                      <a-tag color="red">已锁定，不可修改</a-tag>
                    </a-descriptions-item>
                  </a-descriptions>
                </a-card>
              </div>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { 
  ArrowLeftOutlined, 
  ArrowRightOutlined 
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { materialApi } from '@/api';
import { useUserStore } from '@/store/user';
import { getStatusText, getStatusColor, getStepText, getStepColor, formatDate } from '@/utils/constants';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const loading = ref(true);
const detail = ref(null);
const activeTab = ref('basic');

const canEdit = computed(() => {
  if (!detail.value || !userStore.isMarketing) return false;
  return ['DRAFT', 'MEDICAL_REJECTED', 'LEGAL_REJECTED'].includes(detail.value.status);
});

const fieldNames = {
  title: '标题',
  content: '内容',
  drug_name: '药品名称',
  approval_number: '批准文号',
  indication: '适应症',
  contraindication: '禁忌',
  medical_evidence: '医学证据',
  risk_warning: '风险警示语',
  indication_check: '适应症核对',
  contraindication_check: '禁忌核对',
  evidence_check: '医学证据核对',
  approval_number_check: '批准文号核对',
  risk_warning_check: '风险措辞核对',
  off_label_check: '超说明书表述',
  suggestion: '修改建议'
};

const getFieldName = (key) => fieldNames[key] || key;

const loadDetail = async () => {
  loading.value = true;
  try {
    const res = await materialApi.detail(route.params.id);
    detail.value = res.data;
  } catch (e) {
    message.error(e.message);
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push('/materials');
};

const goEdit = () => {
  router.push(`/materials/${route.params.id}/edit`);
};

const handleSubmit = () => {
  Modal.confirm({
    title: '确认提交',
    content: `确认提交"${detail.value.title}"进行医学审核吗？`,
    okText: '确认提交',
    cancelText: '取消',
    onOk: async () => {
      try {
        await materialApi.submit(route.params.id);
        message.success('提交成功');
        loadDetail();
      } catch (e) {
        message.error(e.message);
      }
    }
  });
};

onMounted(() => {
  loadDetail();
});
</script>
