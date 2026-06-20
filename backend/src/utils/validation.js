const { db } = require('../db/init');

const OFF_LABEL_KEYWORDS = [
  '超出适应症', '超说明书', '超出说明书', '非适应症',
  '未批准', '未经批准', '扩大适应症', '预防', '治愈',
  '根治', '无毒副作用', '无副作用', '最高疗效', '最佳',
  '第一', '唯一', '特效', '速效', '神效', '灵丹妙药'
];

const CHANNEL_TYPES = ['POSTER', 'SHORT_VIDEO', 'LIVE_BROADCAST'];

const CHANNEL_NAME_MAP = {
  POSTER: '海报',
  SHORT_VIDEO: '短视频',
  LIVE_BROADCAST: '直播口播'
};

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

function isValidChannel(channel) {
  return CHANNEL_TYPES.includes(channel);
}

function getChannelName(channel) {
  return CHANNEL_NAME_MAP[channel] || channel || '海报';
}

function checkEvidenceSource(evidenceSource) {
  if (!evidenceSource || !evidenceSource.trim()) {
    return {
      isValid: false,
      reason: '证据来源不能为空，请标明证据来源（如临床试验、文献、药监批准文件等）'
    };
  }
  const trimmed = evidenceSource.trim();
  if (trimmed.length < 4) {
    return {
      isValid: false,
      reason: '证据来源描述过于简略，请提供具体的证据来源说明'
    };
  }
  return { isValid: true };
}

function checkChannelDuplicate(themeId, channel, excludeMaterialId = null) {
  if (!themeId || !channel) {
    return { isDuplicate: false };
  }
  let sql = `
    SELECT id, title FROM materials
    WHERE theme_id = ? AND channel = ? AND is_deleted = 0
  `;
  const params = [themeId, channel];
  if (excludeMaterialId) {
    sql += ' AND id <> ?';
    params.push(excludeMaterialId);
  }
  const existing = db.prepare(sql).get(...params);
  if (existing) {
    return {
      isDuplicate: true,
      reason: `同一主题下已存在该渠道素材：${existing.title}`,
      existingId: existing.id
    };
  }
  return { isDuplicate: false };
}

function validateChannelRevision(materialId, revisionReason) {
  const material = db.prepare(`
    SELECT * FROM materials WHERE id = ? AND is_deleted = 0
  `).get(materialId);

  if (!material) {
    return { isValid: false, reason: '原素材不存在，无法创建渠道修订版本' };
  }

  if (material.status !== 'PUBLISHED') {
    return {
      isValid: false,
      reason: `只有已发布的素材才能创建渠道修订版本，当前状态：${material.status}`
    };
  }

  if (!revisionReason || !revisionReason.trim()) {
    return {
      isValid: false,
      reason: '创建渠道修订版本必须填写修订原因（如渠道要求更改风险措辞）'
    };
  }

  return { isValid: true, material };
}

function snapshotEvidenceVersion({ materialId, themeId, channel, version, evidenceSource, medicalEvidence, operator }) {
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  db.prepare(`
    INSERT INTO evidence_versions (
      id, material_id, theme_id, channel, version,
      evidence_source, medical_evidence, snapshot_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, materialId, themeId, channel, version,
    evidenceSource || null, medicalEvidence, operator
  );
  return id;
}

function compareEvidenceVersions(versionAId, versionBId) {
  const a = db.prepare('SELECT * FROM evidence_versions WHERE id = ?').get(versionAId);
  const b = db.prepare('SELECT * FROM evidence_versions WHERE id = ?').get(versionBId);
  if (!a || !b) {
    return { comparable: false, reason: '证据版本不存在，无法比对' };
  }
  const diff = {
    evidence_source_changed: (a.evidence_source || '') !== (b.evidence_source || ''),
    medical_evidence_changed: (a.medical_evidence || '') !== (b.medical_evidence || ''),
    version_a: a,
    version_b: b
  };
  diff.has_changes = diff.evidence_source_changed || diff.medical_evidence_changed;
  return { comparable: true, diff };
}

module.exports = {
  checkOffLabelContent,
  checkMedicalEvidence,
  checkApprovalNumber,
  checkRiskWarning,
  canTransition,
  isMaterialLocked,
  STATUS_FLOW,
  OFF_LABEL_KEYWORDS,
  CHANNEL_TYPES,
  CHANNEL_NAME_MAP,
  isValidChannel,
  getChannelName,
  checkEvidenceSource,
  checkChannelDuplicate,
  validateChannelRevision,
  snapshotEvidenceVersion,
  compareEvidenceVersions
};
