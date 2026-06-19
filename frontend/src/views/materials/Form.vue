<template>
  <div class="page-container">
    <div class="page-header">
      <a-button @click="goBack">
      </a-button>
      <span class="page-title">{{ isEdit ? '编辑素材' : '新建素材' }}</span>
      <a-space>
        <a-button @click="saveDraft">保存草稿</a-button>
        <a-button type="primary" @click="handleSubmit" :disabled="!formValid">
          <CheckOutlined /> 提交审核
        </a-button>
      </a-space>
    </div>

    <div class="card-wrapper">
      <a-alert
        v-if="validationResult && !validationResult.isValid"
        type="warning"
        :message="'内容包含超说明书表述：' + validationResult.violations.join('、')"
        style="margin-bottom: 16px"
        show-icon
      />

      <a-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        layout="vertical"
      >
        <a-row :gutter="24">
          <a-col :span="12">
            <a-form-item label="标题" name="title">
              <a-input v-model:value="formData.title" placeholder="请输入素材标题" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="药品名称" name="drug_name">
              <a-input v-model:value="formData.drug_name" placeholder="请输入药品名称" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="24">
          <a-col :span="12">
            <a-form-item label="批准文号" name="approval_number">
              <a-input 
                v-model:value="formData.approval_number" 
                placeholder="例：国药准字H12345678"
                @blur="validateApprovalNumber"
              />
              <div v-if="approvalNumberError" style="color: #ff4d4f; font-size: 12px; margin-top: 4px">
                {{ approvalNumberError }}
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="适应症" name="indication">
              <a-input v-model:value="formData.indication" placeholder="请输入批准的适应症，多个用逗号分隔" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="宣传内容" name="content">
          <a-textarea
            v-model:value="formData.content"
            :rows="8"
            placeholder="请输入宣传内容"
            @blur="validateContent"
            show-count
            :maxlength="5000"
          />
          <div v-if="contentWarning" style="color: #faad14; font-size: 12px; margin-top: 4px">
            <WarningOutlined /> {{ contentWarning }}
          </div>
        </a-form-item>

        <a-row :gutter="24">
          <a-col :span="12">
            <a-form-item label="禁忌" name="contraindication">
            <a-textarea
              v-model:value="formData.contraindication"
              :rows="4"
              placeholder="请输入药品禁忌"
            />
          </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="风险警示语" name="risk_warning">
              <a-textarea
                v-model:value="formData.risk_warning"
                :rows="4"
                placeholder="请输入风险警示语，需包含'请仔细阅读说明书'等提示"
                @blur="validateRiskWarning"
              />
              <div v-if="riskWarningError" style="color: #ff4d4f; font-size: 12px; margin-top: 4px">
                {{ riskWarningError }}
              </div>
          </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="医学证据" name="medical_evidence">
          <a-textarea
            v-model:value="formData.medical_evidence"
            :rows="4"
            placeholder="请提供医学证据，如临床试验数据、文献支持、药监部门批准文件等"
            @blur="validateMedicalEvidence"
          />
          <div v-if="medicalEvidenceError" style="color: #ff4d4f; font-size: 12px; margin-top: 4px">
            {{ medicalEvidenceError }}
          </div>
        </a-form-item>

        <a-divider />

        <div class="form-footer">
          <a-button @click="goBack">取消</a-button>
          <a-button style="margin-left: 8px" @click="saveDraft">保存草稿</a-button>
          <a-button 
            type="primary" 
            style="margin-left: 8px" 
            @click="handleSubmit"
            :disabled="!formValid"
          >
            <CheckOutlined /> 提交审核
          </a-button>
        </div>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { CheckOutlined, ArrowLeftOutlined, WarningOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import { materialApi, validationApi } from '@/api';
import { useUserStore } from '@/store/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const formRef = ref();
const isEdit = computed(() => !!route.params.id);

const formData = reactive({
  title: '',
  content: '',
  drug_name: '',
  approval_number: '',
  indication: '',
  contraindication: '',
  medical_evidence: '',
  risk_warning: ''
});

const validationResult = ref(null);
const approvalNumberError = ref('');
const contentWarning = ref('');
const riskWarningError = ref('');
const medicalEvidenceError = ref('');

const formValid = computed(() => {
  return formData.title && 
         formData.content && 
         formData.drug_name &&
         formData.approval_number &&
         formData.indication &&
         formData.risk_warning &&
         formData.medical_evidence &&
         !approvalNumberError.value &&
         !riskWarningError.value &&
         !medicalEvidenceError.value &&
         (!validationResult.value || validationResult.value.isValid);
});

const rules = {
  title: [{ required: true, message: '请输入标题' }],
  content: [{ required: true, message: '请输入宣传内容' }],
  drug_name: [{ required: true, message: '请输入药品名称' }],
  approval_number: [{ required: true, message: '请输入批准文号' }],
  indication: [{ required: true, message: '请输入适应症' }],
  risk_warning: [{ required: true, message: '请输入风险警示语' }],
  medical_evidence: [{ required: true, message: '请输入医学证据' }]
};

const loadDetail = async (id) => {
  try {
    const res = await materialApi.detail(id);
    if (res.data.status === 'PUBLISHED') {
      message.error('已发布的素材不能修改');
      router.push('/materials');
      return;
    }
    Object.assign(formData, {
      title: res.data.title,
      content: res.data.content,
      drug_name: res.data.drug_name,
      approval_number: res.data.approval_number,
      indication: res.data.indication,
      contraindication: res.data.contraindication,
      medical_evidence: res.data.medical_evidence,
      risk_warning: res.data.risk_warning
    });
  } catch (e) {
    message.error(e.message);
  }
};

const validateApprovalNumber = () => {
  const pattern = /^国药准字[HZSJ][0-9]{8}$/;
  if (!formData.approval_number || !pattern.test(formData.approval_number)) {
    approvalNumberError.value = '批准文号格式不正确，应为：国药准字+1位字母+8位数字';
  } else {
    approvalNumberError.value = '';
  }
};

const validateContent = async () => {
  if (!formData.content) return;
  
  try {
    const res = await validationApi.checkOffLabel(formData.content, formData.indication);
    validationResult.value = res.data;
    if (!res.data.isValid) {
      contentWarning.value = `检测到 ${res.data.violations.length} 处超说明书表述，请修改后再提交`;
    } else {
      contentWarning.value = '';
    }
  } catch (e) {
    contentWarning.value = '';
  }
};

const validateRiskWarning = () => {
  if (!formData.risk_warning) {
    riskWarningError.value = '';
    return;
  }
  const requiredPhrases = ['请仔细阅读说明书', '按说明书使用', '医师指导', '药师指导'];
  const hasRequired = requiredPhrases.some(phrase => formData.risk_warning.includes(phrase));
  if (!hasRequired) {
    riskWarningError.value = '风险警示语必须包含"请仔细阅读说明书"、"按说明书使用"或"医师/药师指导"等提示';
  } else {
    riskWarningError.value = '';
  }
};

const validateMedicalEvidence = () => {
  if (!formData.medical_evidence || formData.medical_evidence.trim().length < 10) {
    medicalEvidenceError.value = '医学证据不充分，请提供临床试验数据、文献支持或药监部门批准文件';
  } else {
    medicalEvidenceError.value = '';
  }
};

const saveDraft = async () => {
  try {
    if (isEdit.value) {
      await materialApi.update(route.params.id, formData);
      message.success('草稿保存成功');
    } else {
      await materialApi.create(formData);
      message.success('草稿保存成功');
      router.push('/materials');
    }
  } catch (e) {
    message.error(e.message);
  }
};

const handleSubmit = () => {
  Modal.confirm({
    title: '确认提交',
    content: '确认提交进行医学审核吗？提交后将进入审核流程，不能再修改。',
    okText: '确认提交',
    cancelText: '取消',
    onOk: async () => {
      try {
        let materialId = isEdit.value ? await materialApi.update(route.params.id, formData) : await materialApi.create(formData);
        if (isEdit.value) {
          await materialApi.submit(route.params.id);
        } else {
          await materialApi.submit(materialId.data.id);
        }
        message.success('提交成功，已进入医学审核环节');
        router.push('/materials');
      } catch (e) {
        message.error(e.message);
      }
    }
  });
};

const goBack = () => {
  router.push('/materials');
};

onMounted(() => {
  if (isEdit.value) {
    loadDetail(route.params.id);
  }
});
</script>
