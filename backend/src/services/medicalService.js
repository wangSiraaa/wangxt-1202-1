const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');
const { recordTrail } = require('../utils/auditTrail');
const { 
  checkMedicalEvidence, 
  canTransition,
  checkOffLabelContent,
  checkEvidenceSource,
  getChannelName 
} = require('../utils/validation');
const { getMaterialById, getMaterialDetail } = require('./materialService');

function submitMedicalOpinion(materialId, data, operator) {
  if (!operator) {
    throw new Error('审核人信息缺失，无法提交医学审核意见');
  }

  const material = getMaterialById(materialId);
  if (!material) {
    throw new Error('素材不存在');
  }

  if (!canTransition(material.status, null, 'MEDICAL')) {
    throw new Error(`当前状态 ${material.status} 不允许医学审核`);
  }

  const {
    indication_check,
    contraindication_check,
    evidence_check,
    opinion,
    suggestion,
    is_approved,
    rejection_reason,
    evidence_source
  } = data;

  const safeSuggestion = suggestion !== undefined && suggestion !== null ? suggestion : null;
  const safeOpinion = opinion !== undefined && opinion !== null ? opinion : null;

  const approved = parseInt(is_approved) === 1;
  const evidenceMissing = parseInt(evidence_check) === 0;

  if (evidenceMissing) {
    const evidenceCheck = checkMedicalEvidence(material.medical_evidence);
    if (!evidenceCheck.isValid && approved) {
      throw new Error('医学证据缺失，不能审核通过，请驳回并退回市场部补充证据');
    }
  }

  if (approved) {
    const evidenceCheck = checkMedicalEvidence(material.medical_evidence);
    if (!evidenceCheck.isValid) {
      throw new Error(evidenceCheck.reason);
    }
  }

  const offLabelCheck = checkOffLabelContent(material.content, material.indication);
  if (!offLabelCheck.isValid && approved) {
    throw new Error(`内容包含超说明书表述：${offLabelCheck.violations.join('、')}，不能审核通过`);
  }

  const finalEvidenceSource = evidence_source !== undefined && evidence_source !== null
    ? evidence_source
    : material.evidence_source;

  if (approved) {
    const sourceCheck = checkEvidenceSource(finalEvidenceSource);
    if (!sourceCheck.isValid) {
      throw new Error(sourceCheck.reason);
    }
  }

  if (!approved && (!rejection_reason || !rejection_reason.trim())) {
    throw new Error('驳回时必须填写退回原因，以便市场部针对性补充修改');
  }

  const safeRejectionReason = !approved && rejection_reason ? rejection_reason.trim() : null;
  const newVersion = material.version + 1;
  const targetStatus = approved ? 'PENDING_LEGAL' : 'MEDICAL_REJECTED';
  const targetStep = approved ? 'LEGAL' : 'MARKETING';
  const action = approved ? 'MEDICAL_APPROVE' : 'MEDICAL_REJECT';
  const actionName = approved ? '医学审核通过' : '医学审核驳回';

  db.exec('BEGIN');
  try {
    const opinionStmt = db.prepare(`
      INSERT INTO medical_opinions (
        id, material_id, version, reviewer, indication_check,
        contraindication_check, evidence_check, opinion, suggestion, is_approved,
        rejection_reason, evidence_source, channel
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    opinionStmt.run(
      uuidv4(),
      materialId,
      newVersion,
      operator,
      indication_check ? 1 : 0,
      contraindication_check ? 1 : 0,
      evidence_check ? 1 : 0,
      safeOpinion,
      safeSuggestion,
      approved ? 1 : 0,
      safeRejectionReason,
      finalEvidenceSource,
      material.channel
    );

    const updateStmt = db.prepare(`
      UPDATE materials SET
        status = ?,
        current_step = ?,
        version = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_deleted = 0
    `);
    updateStmt.run(targetStatus, targetStep, newVersion, materialId);

    recordTrail({
      materialId,
      version: newVersion,
      action,
      operator,
      operatorRole: 'MEDICAL',
      fromStatus: material.status,
      toStatus: targetStatus,
      remark: approved
        ? `${actionName}（${getChannelName(material.channel)}）：${safeOpinion || '适应症、禁忌、证据来源均符合要求'}`
        : `${actionName}（${getChannelName(material.channel)}），退回原因：${safeRejectionReason}`,
      changes: {
        indication_check: indication_check ? 1 : 0,
        contraindication_check: contraindication_check ? 1 : 0,
        evidence_check: evidence_check ? 1 : 0,
        evidence_source: finalEvidenceSource,
        reviewer: operator,
        suggestion: safeSuggestion,
        rejection_reason: safeRejectionReason
      }
    });

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw new Error(`医学审核失败：${e.message}`);
  }

  const updatedMaterial = getMaterialDetail(materialId);

  return {
    success: true,
    status: targetStatus,
    reviewer: operator,
    channel: material.channel,
    message: approved 
      ? `${getChannelName(material.channel)}医学审核通过，已提交法务审核` 
      : `${getChannelName(material.channel)}医学审核已驳回，素材已退回市场部`,
    data: updatedMaterial
  };
}

function getPendingMedicalList(params = {}) {
  const { page = 1, pageSize = 10, keyword, channel } = params;
  
  let whereClauses = [
    'is_deleted = 0',
    "status IN ('PENDING_MEDICAL', 'MEDICAL_REVIEW')"
  ];
  let queryParams = [];

  if (keyword) {
    whereClauses.push('(title LIKE ? OR drug_name LIKE ?)');
    queryParams.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (channel) {
    whereClauses.push('channel = ?');
    queryParams.push(channel);
  }

  const offset = (page - 1) * pageSize;
  
  const countStmt = db.prepare(`
    SELECT COUNT(*) as total FROM materials WHERE ${whereClauses.join(' AND ')}
  `);
  const { total } = countStmt.get(...queryParams);

  const listStmt = db.prepare(`
    SELECT * FROM materials 
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `);
  const list = listStmt.all(...queryParams, pageSize, offset);

  return {
    list,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  };
}

function getMedicalOpinions(materialId) {
  const stmt = db.prepare(`
    SELECT 
      o.*,
      CASE WHEN o.is_approved = 1 THEN '通过' ELSE '驳回' END as result,
      CASE 
        WHEN o.channel = 'POSTER' THEN '海报'
        WHEN o.channel = 'SHORT_VIDEO' THEN '短视频'
        WHEN o.channel = 'LIVE_BROADCAST' THEN '直播口播'
        ELSE o.channel
      END as channel_name
    FROM medical_opinions o
    WHERE o.material_id = ?
    ORDER BY o.created_at DESC, o.version DESC
  `);
  return stmt.all(materialId);
}

function getRejectionReasons(materialId) {
  return db.prepare(`
    SELECT 
      id, version, reviewer, rejection_reason, opinion, suggestion,
      channel, created_at
    FROM medical_opinions
    WHERE material_id = ? AND is_approved = 0 AND rejection_reason IS NOT NULL
    ORDER BY created_at DESC
  `).all(materialId).map(o => ({
    ...o,
    stage: 'MEDICAL',
    stage_name: '医学审核',
    channel_name: getChannelName(o.channel)
  }));
}

module.exports = {
  submitMedicalOpinion,
  getPendingMedicalList,
  getMedicalOpinions,
  getRejectionReasons
};
