import axios from 'axios';

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
});

request.interceptors.request.use((config) => {
  const userStore = JSON.parse(localStorage.getItem('userStore') || '{}');
  if (userStore.currentUser) {
    config.headers['x-operator'] = userStore.currentUser.name;
    config.headers['x-role'] = userStore.currentUser.role;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    if (response.data.success === false) {
      return Promise.reject(new Error(response.data.error || '请求失败'));
    }
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.error || error.message;
    return Promise.reject(new Error(message));
  }
);

export const materialApi = {
  list: (params) => request.get('/materials', { params }),
  detail: (id) => request.get(`/materials/${id}`),
  create: (data) => request.post('/materials', data),
  update: (id, data) => request.put(`/materials/${id}`, data),
  submit: (id) => request.post(`/materials/${id}/submit`),
  trails: (id) => request.get(`/materials/${id}/trails`),
  newVersion: (id) => request.post(`/materials/${id}/new-version`),
  createNewVersion: (id) => request.post(`/materials/${id}/new-version`)
};

export const medicalApi = {
  pending: (params) => request.get('/medical/pending', { params }),
  opinions: (materialId) => request.get(`/medical/${materialId}/opinions`),
  submit: (materialId, data) => request.post(`/medical/${materialId}/opinion`, data)
};

export const legalApi = {
  pending: (params) => request.get('/legal/pending', { params }),
  opinions: (materialId) => request.get(`/legal/${materialId}/opinions`),
  submit: (materialId, data) => request.post(`/legal/${materialId}/opinion`, data),
  published: (params) => request.get('/legal/published', { params }),
  publishedDetail: (id) => request.get(`/legal/published/${id}`)
};

export const publishedApi = {
  list: (params) => request.get('/legal/published', { params }),
  detail: (id) => request.get(`/legal/published/${id}`)
};

export const validationApi = {
  checkOffLabel: (content, indication) => 
    request.post('/validation/offlabel', { content, indication }),
  checkApprovalNumber: (approvalNumber) =>
    request.post('/validation/approval-number', { approvalNumber }),
  checkMedicalEvidence: (evidence) =>
    request.post('/validation/medical-evidence', { evidence }),
  checkRiskWarning: (content, riskWarning) =>
    request.post('/validation/risk-warning', { content, riskWarning })
};

export default request;
