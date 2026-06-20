<template>
  <div class="page-container">
    <div class="page-header">
      <a-button @click="goBack">
        <ArrowLeftOutlined /> 返回
      </a-button>
      <span class="page-title">法务审核</span>
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
            <h3 style="margin-bottom: 16px">法务相关信息</h3>
            <a-descriptions :column="1" bordered size="middle">
              <a-descriptions-item label="批准文号">
                <a-tag :color="approvalNumberValid ? 'success' : 'error'">
                  {{ detail.approval_number }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="风险警示语">
                <div class="detail-value">{{ detail.risk_warning || '-' }}</div>
              </a-descriptions-item>
              <a-descriptions-item label="适应症">
                {{ detail.indication || '-' }}
              </a-descriptions-item>
            </a-descriptions>
          </div>

          <div class="card-wrapper" style="margin-bottom: 24px" v-if="detail.medical_opinions && detail.medical_opinions.length > 0">
            <h3 style="margin-bottom: 16px">医学审核意见</h3>
            <a-card size="small">
              <template #title>
                <a-space>
                  <span>v{{ detail.medical_opinions[0].version }}</span>
                  <a-tag :color="detail.medical_opinions[0].is_approved ? 'success' : 'warning'">
                    {{ detail.medical_opinions[0].is_approved ? '通过' : '驳回' }}
                  </a-tag>
                  <span style="color: #999">{{ detail.medical_opinions[0].reviewer }}</span>
                </a-space>
              </template>
              <div v-if="detail.medical_opinions[0].opinion" class="detail-value">
                {{ detail.medical_opinions[0].opinion }}
              </div>
            </a-card>
          </div>

          <div class="card-wrapper" v-if="detail.legal_opinions && detail.legal_opinions.length > 0">
            <h3 style="margin-bottom: 16px">历史法务审核意见</h3>
            <div v-for="opinion in detail.legal_opinions.slice(0, 3)" :key="opinion.id" style="margin-bottom: 16px">
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
              </a-card>
            </div>
          </div>
        </a-col>

        <a-col :span="10">
          <div class="card-wrapper">
            <h3 style="margin-bottom: 16px">
              <SafetyOutlined style="color: #722ed1; margin-right: 8px" />
              法务审核
            </h3>

            <a-alert
              v-if="legalWarning"
              type="error"
              :message="legalWarning"
              style="margin-bottom: 16px"
              show-icon
            />

            <a-form
              ref="formRef"
              :model="formData"
              :rules="rules"
              layout="vertical"
            >
              <a-form-item label="批准文号核对" name="approval_check">
                <a-radio-group v-model:value="formData.approval_check" @change="checkApproval">
                  <a-radio :value="1">格式合规，真实有效</a-radio>
                  <a-radio :value="0">格式错误或缺失</a-radio>
                </a-radio-group>
              </a-form-item>

              <a-form-item label="风险措辞核对" name="risk_check">
                <a-radio-group v-model:value="formData.risk_check" @change="checkRisk">
                  <a-radio :value="1">风险警示充分</a-radio>
                  <a-radio :value="0">风险警示不足，需补充</a-radio>
                </a-radio-group>
              </a-form-item>

              <a-form-item label="超说明书表述检查" name="offlabel_check">
                <a-radio-group v-model:value="formData.offlabel_check" @change="checkOffLabel">
                  <a-radio :value="1">无超说明书表述</a-radio>
                  <a-radio :value="0">存在超说明书表述</a-radio>
                </a-radio-group>
              </a-form-item>

              <a-form-item label="审核结论" name="is_approved">
                <a-radio-group v-model:value="formData.is_approved">
                  <a-radio :value="1">
                    <CheckCircleOutlined style="color: #52c41a" /> 通过并发布
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

              <a-alert
                v-if="formData.is_approved === 1"
                type="warning"
                message="发布后素材将被锁定，无法修改原始内容。如需修改请创建新版本。"
                show-icon
                style="margin-bottom: 16px"
              />

              <div class="form-footer">
                <a-button @click="goBack">取消</a-button>
                <a-button 
                  type="primary" 
                  style="margin-left: 8px" 
                  @click="handleSubmit"
                  :loading="submitting"
                  :disabled="!canSubmit"
                >
                  {{ formData.is_approved === 1 ? '通过并发布' : '驳回并退回' }}
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
  SafetyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { materialApi, legalApi, validationApi } from '@/api';
import { useUserStore } from '@/store/user';
import { getStatusText, getStatusColor, formatDate } from '@/utils/constants';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const loading = ref(true);
const submitting = ref(false);
const detail = ref(null);
const formRef = ref();
const legalWarning = ref('');
const approvalNumberValid = ref(true);

const formData = reactive({
  approval_check: 1,
  risk_check: 1,
  offlabel_check: 1,
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
    
    if (!['PENDING_LEGAL', 'LEGAL_REVIEW'].includes(res.data.status)) {
      message.error('该素材不在法务审核环节');
      router.push('/legal');
      return;
    }

    const approvalCheck = await validationApi.checkApprovalNumber(res.data.approval_number);
    approvalNumberValid.value = approvalCheck.data.isValid;
    if (!approvalCheck.data.isValid) {
      legalWarning.value = `批准文号格式错误：${approvalCheck.data.message}，请驳回`;
      formData.approval_check = 0;
      formData.is_approved = 0;
    }

    const riskCheck = await validationApi.checkRiskWarning(
      res.data.content, 
      res.data.risk_warning
    );
    if (!riskCheck.data.isValid && !legalWarning.value) {
      legalWarning.value = '风险警示语不充分，请补充不良反应、禁忌等风险提示';
      formData.risk_check = 0;
      formData.is_approved = 0;
    }

    const offLabelCheck = await validationApi.checkOffLabel(
      res.data.content, 
      res.data.indication
    );
    if (!offLabelCheck.data.isValid) {
      const violationMsg = `内容包含超说明书表述：${offLabelCheck.data.violations.join('、')}，请驳回`;
      legalWarning.value = legalWarning.value ? `${legalWarning.value}；${violationMsg}` : violationMsg;
      formData.offlabel_check = 0;
      formData.is_approved = 0;
    }
  } catch (e) {
    message.error(e.message);
  } finally {
    loading.value = false;
  }
};

const checkApproval = () => {
  if (formData.approval_check === 0) {
    formData.is_approved = 0;
    updateWarning();
  }
};

const checkRisk = () => {
  if (formData.risk_check === 0) {
    formData.is_approved = 0;
    updateWarning();
  }
};

const checkOffLabel = () => {
  if (formData.offlabel_check === 0) {
    formData.is_approved = 0;
    updateWarning();
  }
};

const updateWarning = () => {
  const warnings = [];
  if (formData.approval_check === 0) warnings.push('批准文号有误');
  if (formData.risk_check === 0) warnings.push('风险警示不足');
  if (formData.offlabel_check === 0) warnings.push('存在超说明书表述');
  legalWarning.value = warnings.length > 0 ? `${warnings.join('、')}，需退回修改` : '';
};

const handleSubmit = () => {
  if (formData.is_approved === 1) {
    if (formData.approval_check === 0) {
      message.error('批准文号校验未通过，不能发布');
      return;
    }
    if (formData.risk_check === 0) {
      message.error('风险警示语校验未通过，不能发布');
      return;
    }
    if (formData.offlabel_check === 0) {
      message.error('存在超说明书表述，不能发布');
      return;
    }
  }

  const actionText = formData.is_approved === 1 ? '通过并发布' : '驳回并退回';
  Modal.confirm({
    title: `确认${actionText}？`,
    content: formData.is_approved === 1 
      ? '确认通过法务审核并发布？发布后素材将被锁定，无法修改。'
      : '确认驳回？驳回后将退回重新修改。',
    okText: `确认${actionText}`,
    cancelText: '取消',
    okType: formData.is_approved === 1 ? 'danger' : 'primary',
    onOk: async () => {
      submitting.value = true;
      try {
        const result = await legalApi.submit(route.params.id, formData);
        const expectedStatus = formData.is_approved === 1 ? 'PUBLISHED' : 'LEGAL_REJECTED';
        const returnedStatus = result.status || result.data?.status;
        if (returnedStatus && returnedStatus !== expectedStatus) {
          message.warning(`状态流转异常：期望 ${expectedStatus}，实际 ${returnedStatus}`);
        } else {
          message.success(formData.is_approved === 1 ? '审核通过，已发布，素材已锁定' : '审核已驳回，素材已退回市场部');
        }
        router.push('/legal');
      } catch (e) {
        message.error(e.message);
      } finally {
        submitting.value = false;
      }
    }
  });
};

const goBack = () => {
  router.push('/legal');
};

onMounted(() => {
  loadDetail();
});
</script>
