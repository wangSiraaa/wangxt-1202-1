const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');
const { recordTrail } = require('../utils/auditTrail');
const { 
  checkMedicalEvidence, 
  canTransition,
  checkOffLabelContent 
} = require('../utils/validation');
const { getMaterialById } = require('./materialService');

function submitMedicalOpinion(materialId, data, operator) {
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
    is_approved
  } = data;

  const safeSuggestion = suggestion !== undefined ? suggestion : null;
  const safeOpinion = opinion !== undefined ? opinion : null;

  const evidenceCheck = checkMedicalEvidence(material.medical_evidence);
  if (!evidenceCheck.isValid) {
    throw new Error(evidenceCheck.reason);
  }

  const offLabelCheck = checkOffLabelContent(material.content, material.indication);
  if (!offLabelCheck.isValid) {
    throw new Error(`内容包含超说明书表述：${offLabelCheck.violations.join('、')}`);
  }

  const approved = parseInt(is_approved) === 1;
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
        contraindication_check, evidence_check, opinion, suggestion, is_approved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      approved ? 1 : 0
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
      remark: `${actionName}：${opinion || (approved ? '适应症、禁忌、医学证据均符合要求' : '审核不通过')}`,
      changes: {
        indication_check,
        contraindication_check,
        evidence_check,
        suggestion
      }
    });

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw new Error(`医学审核失败：${e.message}`);
  }

  return {
    success: true,
    status: targetStatus,
    message: approved ? '医学审核通过，已提交法务审核' : '医学审核已驳回'
  };
}

function getPendingMedicalList(params = {}) {
  const { page = 1, pageSize = 10, keyword } = params;
  
  let whereClauses = [
    'is_deleted = 0',
    "status IN ('PENDING_MEDICAL', 'MEDICAL_REVIEW')"
  ];
  let queryParams = [];

  if (keyword) {
    whereClauses.push('(title LIKE ? OR drug_name LIKE ?)');
    queryParams.push(`%${keyword}%`, `%${keyword}%`);
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
      CASE WHEN o.is_approved = 1 THEN '通过' ELSE '驳回' END as result
    FROM medical_opinions o
    WHERE o.material_id = ?
    ORDER BY o.created_at DESC, o.version DESC
  `);
  return stmt.all(materialId);
}

module.exports = {
  submitMedicalOpinion,
  getPendingMedicalList,
  getMedicalOpinions
};
