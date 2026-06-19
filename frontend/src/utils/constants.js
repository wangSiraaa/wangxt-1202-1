export const STATUS_MAP = {
  DRAFT: { text: '草稿', color: 'default' },
  PENDING_MEDICAL: { text: '待医学审核', color: 'blue' },
  MEDICAL_REVIEW: { text: '医学审核中', color: 'processing' },
  MEDICAL_REJECTED: { text: '医学审核驳回', color: 'warning' },
  PENDING_LEGAL: { text: '待法务审核', color: 'blue' },
  LEGAL_REVIEW: { text: '法务审核中', color: 'processing' },
  LEGAL_REJECTED: { text: '法务审核驳回', color: 'warning' },
  PUBLISHED: { text: '已发布', color: 'success' }
};

export const STEP_MAP = {
  MARKETING: { text: '市场部', color: 'orange' },
  MEDICAL: { text: '医学审核', color: 'blue' },
  LEGAL: { text: '法务', color: 'purple' },
  PUBLISHED: { text: '已发布', color: 'green' }
};

export const ROLE_MAP = {
  MARKETING: '市场部',
  MEDICAL: '医学审核',
  LEGAL: '法务'
};

export function getStatusText(status) {
  return STATUS_MAP[status]?.text || status;
}

export function getStatusColor(status) {
  return STATUS_MAP[status]?.color || 'default';
}

export function getStepText(step) {
  return STEP_MAP[step]?.text || step;
}

export function getStepColor(step) {
  return STEP_MAP[step]?.color || 'default';
}

export function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
