const { db } = require('../db/init');

const OFF_LABEL_KEYWORDS = [
  '超出适应症', '超说明书', '超出说明书', '非适应症',
  '未批准', '未经批准', '扩大适应症', '预防', '治愈',
  '根治', '无毒副作用', '无副作用', '最高疗效', '最佳',
  '第一', '唯一', '特效', '速效', '神效', '灵丹妙药'
];

const STATUS_FLOW = {
  DRAFT: { next: 'PENDING_MEDICAL', allowedRoles: ['MARKETING'] },
  PENDING_MEDICAL: { next: 'MEDICAL_REVIEW', allowedRoles: ['MEDICAL'] },
  MEDICAL_REVIEW: { next: 'PENDING_LEGAL', allowedRoles: ['MEDICAL'] },
  MEDICAL_REJECTED: { next: 'PENDING_MEDICAL', allowedRoles: ['MARKETING'] },
  PENDING_LEGAL: { next: 'LEGAL_REVIEW', allowedRoles: ['LEGAL'] },
  LEGAL_REVIEW: { next: 'PUBLISHED', allowedRoles: ['LEGAL'] },
  LEGAL_REJECTED: { next: 'PENDING_LEGAL', allowedRoles: ['MARKETING'] },
  PUBLISHED: { next: null, allowedRoles: [] }
};

function checkOffLabelContent(content, indication) {
  const foundKeywords = [];
  const lowerContent = (content || '').toLowerCase();
  
  for (const keyword of OFF_LABEL_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    }
  }
  
  if (indication) {
    const indicationKeywords = (indication || '').split(/[，,、；;]/).map(k => k.trim()).filter(k => k);
    const contentSentences = content.split(/[。！？.!?]/);
    
    for (const sentence of contentSentences) {
      const hasDrugEffect = /(治疗|缓解|改善|用于|适用).*?(症状|疾病|症)/.test(sentence);
      if (hasDrugEffect) {
        const matchesIndication = indicationKeywords.some(kw => 
          sentence.includes(kw)
        );
        if (!matchesIndication && sentence.trim().length > 5) {
          foundKeywords.push(`超说明书表述: "${sentence.trim().substring(0, 50)}..."`);
        }
      }
    }
  }
  
  return {
    isValid: foundKeywords.length === 0,
    violations: foundKeywords
  };
}

function checkMedicalEvidence(evidence) {
  if (!evidence || evidence.trim().length < 10) {
    return {
      isValid: false,
      reason: '医学证据不充分，请提供临床试验数据、文献支持或药监部门批准文件'
    };
  }
  return { isValid: true };
}

function checkApprovalNumber(approvalNumber) {
  if (!approvalNumber || !approvalNumber.trim()) {
    return { isValid: false, reason: '批准文号不能为空' };
  }
  
  const pattern = /^国药准字[HZSJ][0-9]{8}$/;
  if (!pattern.test(approvalNumber.trim())) {
    return { isValid: false, reason: '批准文号格式不正确，应为：国药准字+1位字母+8位数字' };
  }
  
  return { isValid: true };
}

function checkRiskWarning(content, riskWarning) {
  if (!riskWarning || riskWarning.trim().length < 5) {
    return { isValid: false, reason: '风险警示语不能为空' };
  }
  
  const requiredPhrases = ['请仔细阅读说明书', '按说明书使用', '医师指导', '医生指导', '药师指导', '医生建议'];
  const hasRequired = requiredPhrases.some(phrase => riskWarning.includes(phrase));
  
  if (!hasRequired) {
    return { 
      isValid: false, 
      reason: '风险警示语必须包含"请仔细阅读说明书"、"按说明书使用"或"医师/药师指导"等提示' 
    };
  }
  
  return { isValid: true };
}

function canTransition(currentStatus, targetStatus, role) {
  const flow = STATUS_FLOW[currentStatus];
  if (!flow) return false;
  
  if (!flow.allowedRoles.includes(role)) return false;
  
  if (targetStatus && flow.next !== targetStatus) {
    if (['MEDICAL_REJECTED', 'LEGAL_REJECTED'].includes(targetStatus)) {
      return ['MEDICAL', 'LEGAL'].includes(role);
    }
    return false;
  }
  
  return true;
}

function isMaterialLocked(materialId) {
  const stmt = db.prepare(`
    SELECT status FROM materials WHERE id = ? AND is_deleted = 0
  `);
  const material = stmt.get(materialId);
  
  if (!material) return { locked: true, reason: '素材不存在' };
  
  if (material.status === 'PUBLISHED') {
    return { locked: true, reason: '已发布的素材不能修改，请创建新版本' };
  }
  
  return { locked: false };
}

module.exports = {
  checkOffLabelContent,
  checkMedicalEvidence,
  checkApprovalNumber,
  checkRiskWarning,
  canTransition,
  isMaterialLocked,
  STATUS_FLOW,
  OFF_LABEL_KEYWORDS
};
