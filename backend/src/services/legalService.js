const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');
const { recordTrail } = require('../utils/auditTrail');
const { 
  checkApprovalNumber, 
  checkRiskWarning,
  checkOffLabelContent,
  canTransition 
} = require('../utils/validation');
const { getMaterialById } = require('./materialService');

function submitLegalOpinion(materialId, data, operator) {
  const material = getMaterialById(materialId);
  if (!material) {
    throw new Error('素材不存在');
  }

  if (!canTransition(material.status, null, 'LEGAL')) {
    throw new Error(`当前状态 ${material.status} 不允许法务审核`);
  }

  const {
    approval_number_check,
    risk_warning_check,
    off_label_check,
    opinion,
    suggestion,
    is_approved
  } = data;

  const safeSuggestion = suggestion !== undefined ? suggestion : null;
  const safeOpinion = opinion !== undefined ? opinion : null;

  const approvalCheck = checkApprovalNumber(material.approval_number);
  if (!approvalCheck.isValid) {
    throw new Error(approvalCheck.reason);
  }

  const riskCheck = checkRiskWarning(material.content, material.risk_warning);
  if (!riskCheck.isValid) {
    throw new Error(riskCheck.reason);
  }

  const offLabelCheck = checkOffLabelContent(material.content, material.indication);
  if (!offLabelCheck.isValid) {
    throw new Error(`内容包含超说明书表述：${offLabelCheck.violations.join('、')}`);
  }

  const approved = parseInt(is_approved) === 1;
  const newVersion = material.version + 1;
  const targetStatus = approved ? 'PUBLISHED' : 'LEGAL_REJECTED';
  const targetStep = approved ? 'PUBLISHED' : 'MARKETING';
  const action = approved ? 'LEGAL_APPROVE' : 'LEGAL_REJECT';
  const actionName = approved ? '法务审核通过' : '法务审核驳回';

  db.exec('BEGIN');
  try {
    const opinionStmt = db.prepare(`
      INSERT INTO legal_opinions (
        id, material_id, version, reviewer, approval_number_check,
        risk_warning_check, off_label_check, opinion, suggestion, is_approved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    opinionStmt.run(
      uuidv4(),
      materialId,
      newVersion,
      operator,
      approval_number_check ? 1 : 0,
      risk_warning_check ? 1 : 0,
      off_label_check ? 1 : 0,
      safeOpinion,
      safeSuggestion,
      approved ? 1 : 0
    );

    if (approved) {
      const publishStmt = db.prepare(`
        INSERT INTO published_versions (
          id, material_id, version, title, content, drug_name,
          approval_number, indication, contraindication, medical_evidence,
          risk_warning, published_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      publishStmt.run(
        uuidv4(),
        materialId,
        newVersion,
        material.title,
        material.content,
        material.drug_name,
        material.approval_number,
        material.indication,
        material.contraindication,
        material.medical_evidence,
        material.risk_warning,
        operator
      );
    }

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
      operatorRole: 'LEGAL',
      fromStatus: material.status,
      toStatus: targetStatus,
      remark: approved 
        ? `${actionName}，版本已发布并锁定，不可修改` 
        : `${actionName}：${opinion || '审核不通过'}`,
      changes: {
        approval_number_check,
        risk_warning_check,
        off_label_check,
        suggestion
      }
    });

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw new Error(`法务审核失败：${e.message}`);
  }

  return {
    success: true,
    status: targetStatus,
    message: approved 
      ? '法务审核通过，版本已发布并锁定，不可修改' 
      : '法务审核已驳回'
  };
}

function getPendingLegalList(params = {}) {
  const { page = 1, pageSize = 10, keyword } = params;
  
  let whereClauses = [
    'is_deleted = 0',
    "status IN ('PENDING_LEGAL', 'LEGAL_REVIEW')"
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

function getLegalOpinions(materialId) {
  const stmt = db.prepare(`
    SELECT 
      o.*,
      CASE WHEN o.is_approved = 1 THEN '通过' ELSE '驳回' END as result
    FROM legal_opinions o
    WHERE o.material_id = ?
    ORDER BY o.created_at DESC, o.version DESC
  `);
  return stmt.all(materialId);
}

function getPublishedList(params = {}) {
  const { page = 1, pageSize = 10, keyword } = params;
  
  let whereClauses = ['is_locked = 1'];
  let queryParams = [];

  if (keyword) {
    whereClauses.push('(title LIKE ? OR drug_name LIKE ?)');
    queryParams.push(`%${keyword}%`, `%${keyword}%`);
  }

  const offset = (page - 1) * pageSize;
  
  const countStmt = db.prepare(`
    SELECT COUNT(*) as total FROM published_versions WHERE ${whereClauses.join(' AND ')}
  `);
  const { total } = countStmt.get(...queryParams);

  const listStmt = db.prepare(`
    SELECT * FROM published_versions 
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY published_at DESC
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

function getPublishedDetail(publishId) {
  const stmt = db.prepare(`
    SELECT * FROM published_versions WHERE id = ?
  `);
  return stmt.get(publishId);
}

module.exports = {
  submitLegalOpinion,
  getPendingLegalList,
  getLegalOpinions,
  getPublishedList,
  getPublishedDetail
};
