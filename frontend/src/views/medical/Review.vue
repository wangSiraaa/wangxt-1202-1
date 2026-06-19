<template>
  <div class="page-container">
    <div class="page-header">
      <a-button @click="goBack">
        <ArrowLeftOutlined /> 返回
      </a-button>
      <span class="page-title">医学审核</span>
      <a-tag v-if="detail" :color="getStatusColor(detail.status)">
        {{ getStatusText(detail.status) }}
      </a-tag>
    </div>

    <div v-if="loading" style="text-align: center; padding: 40px">
      <a-spin size="large" />
    </div>

    <div v-else-if="detail">
      <a-row :gutter="24">
        <a-col :span="14">
          <div class="card-wrapper" style="margin-bottom: 24px">
            <h3 style="margin-bottom: 16px">宣传素材</h3>
            <a-descriptions :column="2" bordered size="middle">
              <a-descriptions-item label="标题">{{ detail.title }}</a-descriptions-item>
              <a-descriptions-item label="药品名称">{{ detail.drug_name }}</a-descriptions-item>
              <a-descriptions-item label="批准文号">{{ detail.approval_number }}</a-descriptions-item>
              <a-descriptions-item label="版本">v{{ detail.version }}</a-descriptions-item>
            </a-descriptions>
            
            <div style="margin-top: 16px">
              <div class="detail-label">宣传内容</div>
              <div class="detail-value" style="background: #fafafa; padding: 16px; border-radius: 4px">
                {{ detail.content }}
              </div>
            </div>
          </div>

          <div class="card-wrapper" style="margin-bottom: 24px">
            <h3 style="margin-bottom: 16px">医学相关信息</h3>
            <a-descriptions :column="1" bordered size="middle">
              <a-descriptions-item label="批准的适应症">
                {{ detail.indication || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="禁忌">
                {{ detail.contraindication || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="医学证据">
                <div class="detail-value">{{ detail.medical_evidence || '-' }}</div>
              </a-descriptions-item>
            </a-descriptions>
          </div>

          <div class="card-wrapper" v-if="detail.medical_opinions && detail.medical_opinions.length > 0">
            <h3 style="margin-bottom: 16px">历史医学审核意见</h3>
            <div v-for="opinion in detail.medical_opinions.slice(0, 3)" :key="opinion.id" style="margin-bottom: 16px">
              <a-card size="small">
                <template #title>
                  <a-space>
                    <span>v{{ opinion.version }}</span>
                    <a-tag :color="opinion.is_approved ? 'success' : 'warning'">
                      {{ opinion.is_approved ? '通过' : '驳回' }}
                    </a-tag>
                    <span style="color: #999">{{ opinion.reviewer }}</span>
                  </a-space>
                </template>
                <div v-if="opinion.opinion" class="detail-value">{{ opinion.opinion }}</div>
                <div v-if="opinion.suggestion" style="margin-top: 8px; color: #fa8c16">
                  建议：{{ opinion.suggestion }}
                </div>
              </a-card>
            </div>
          </div>
        </a-col>

        <a-col :span="10">
          <div class="card-wrapper">
            <h3 style="margin-bottom: 16px">
              <CheckCircleOutlined style="color: #1890ff; margin-right: 8px" />
              医学审核
            </h3>

            <a-alert
              v-if="medicalEvidenceWarning"
              type="error"
              :message="medicalEvidenceWarning"
              style="margin-bottom: 16px"
              show-icon
            />

            <a-form
              ref="formRef"
              :model="formData"
              :rules="rules"
              layout="vertical"
            >
              <a-form-item label="适应症核对" name="indication_check">
                <a-radio-group v-model:value="formData.indication_check">
                  <a-radio :value="1">符合批准的适应症</a-radio>
                  <a-radio :value="0">不符合</a-radio>
                </a-radio-group>
              </a-form-item>

              <a-form-item label="禁忌核对" name="contraindication_check">
                <a-radio-group v-model:value="formData.contraindication_check">
                  <a-radio :value="1">已正确标注禁忌</a-radio>
                  <a-radio :value="0">未正确标注</a-radio>
                </a-radio-group>
              </a-form-item>

              <a-form-item label="医学证据核对" name="evidence_check">
                <a-radio-group v-model:value="formData.evidence_check" @change="checkEvidence">
                  <a-radio :value="1">医学证据充分</a-radio>
                  <a-radio :value="0">医学证据缺失，需退回</a-radio>
                </a-radio-group>
              </a-form-item>

              <a-form-item label="审核结论" name="is_approved">
                <a-radio-group v-model:value="formData.is_approved">
                  <a-radio :value="1">
                    <CheckCircleOutlined style="color: #52c41a" /> 通过
                  </a-radio>
                  <a-radio :value="0">
                    <CloseCircleOutlined style="color: #ff4d4f" /> 驳回
                  </a-radio>
                </a-radio-group>
              </a-form-item>

              <a-form-item label="审核意见" name="opinion">
                <a-textarea
                  v-model:value="formData.opinion"
                  :rows="4"
                  placeholder="请输入审核意见"
                  :maxlength="1000"
                  show-count
                />
              </a-form-item>

              <a-form-item label="修改建议" name="suggestion" v-if="formData.is_approved === 0">
                <a-textarea
                  v-model:value="formData.suggestion"
                  :rows="4"
                  placeholder="请输入修改建议"
                  :maxlength="1000"
                  show-count
                />
              </a-form-item>

              <div class="form-footer">
                <a-button @click="goBack">取消</a-button>
                <a-button 
                  type="primary" 
                  style="margin-left: 8px" 
                  @click="handleSubmit"
                  :loading="submitting"
                  :disabled="!canSubmit"
                >
                  {{ formData.is_approved === 1 ? '通过并提交法务' : '驳回并退回市场部' }}
                </a-button>
              </div>
            </a-form>
          </div>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { 
  ArrowLeftOutlined, 
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { materialApi, medicalApi, validationApi } from '@/api';
import { useUserStore } from '@/store/user';
import { getStatusText, getStatusColor, formatDate } from '@/utils/constants';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const loading = ref(true);
const submitting = ref(false);
const detail = ref(null);
const formRef = ref();
const medicalEvidenceWarning = ref('');

const formData = reactive({
  indication_check: 1,
  contraindication_check: 1,
  evidence_check: 1,
  opinion: '',
  suggestion: '',
  is_approved: 1
});

const rules = {
  opinion: [{ required: true, message: '请输入审核意见' }]
};

const canSubmit = computed(() => {
  return formData.opinion && formData.opinion.trim().length > 0;
});

const loadDetail = async () => {
  loading.value = true;
  try {
    const res = await materialApi.detail(route.params.id);
    detail.value = res.data;
    
    if (!['PENDING_MEDICAL', 'MEDICAL_REVIEW'].includes(res.data.status)) {
      message.error('该素材不在医学审核环节');
      router.push('/medical');
      return;
    }

    const offLabelCheck = await validationApi.checkOffLabel(
      res.data.content, 
      res.data.indication
    );
    if (!offLabelCheck.data.isValid) {
      medicalEvidenceWarning.value = `内容包含超说明书表述：${offLabelCheck.data.violations.join('、')}，请驳回`;
      formData.is_approved = 0;
    }

    if (!res.data.medical_evidence || res.data.medical_evidence.trim().length < 10) {
      medicalEvidenceWarning.value = '医学证据不充分，请补充临床试验数据、文献支持或药监部门批准文件';
      formData.evidence_check = 0;
      formData.is_approved = 0;
    }
  } catch (e) {
    message.error(e.message);
  } finally {
    loading.value = false;
  }
};

const checkEvidence = () => {
  if (formData.evidence_check === 0) {
    formData.is_approved = 0;
    medicalEvidenceWarning.value = '医学证据缺失，需退回市场部补充';
  } else {
    medicalEvidenceWarning.value = '';
  }
};

const handleSubmit = () => {
  const actionText = formData.is_approved === 1 ? '通过并提交法务' : '驳回并退回市场部';
  Modal.confirm({
    title: `确认${actionText}？`,
    content: formData.is_approved === 1 
      ? '确认通过医学审核？通过后将提交法务审核。'
      : '确认驳回？驳回后将退回市场部修改。',
    okText: `确认${actionText}`,
    cancelText: '取消',
    onOk: async () => {
      submitting.value = true;
      try {
        await medicalApi.submit(route.params.id, formData);
        message.success(formData.is_approved === 1 ? '审核通过，已提交法务审核' : '审核已驳回');
        router.push('/medical');
      } catch (e) {
        message.error(e.message);
      } finally {
        submitting.value = false;
      }
    }
  });
};

const goBack = () => {
  router.push('/medical');
};

onMounted(() => {
  loadDetail();
});
</script>
