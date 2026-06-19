const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');
const { recordTrail } = require('../utils/auditTrail');
const { 
  checkOffLabelContent, 
  isMaterialLocked, 
  canTransition 
} = require('../utils/validation');

function createMaterial(data, operator) {
  const { 
    title, content, drug_name, approval_number, 
    indication, contraindication, medical_evidence, risk_warning 
  } = data;

  const offLabelCheck = checkOffLabelContent(content, indication);
  if (!offLabelCheck.isValid) {
    throw new Error(`内容包含超说明书表述：${offLabelCheck.violations.join('、')}`);
  }

  const id = uuidv4();
  const version = 1;

  const stmt = db.prepare(`
    INSERT INTO materials (
      id, title, content, drug_name, approval_number, indication,
      contraindication, medical_evidence, risk_warning, status, 
      current_step, version, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id, title, content, drug_name, approval_number, indication,
    contraindication, medical_evidence, risk_warning, 'DRAFT',
    'MARKETING', version, operator
  );

  recordTrail({
    materialId: id,
    version,
    action: 'CREATE',
    operator,
    operatorRole: 'MARKETING',
    fromStatus: null,
    toStatus: 'DRAFT',
    remark: '创建宣传素材'
  });

  return getMaterialById(id);
}

function updateMaterial(id, data, operator) {
  const lockCheck = isMaterialLocked(id);
  if (lockCheck.locked) {
    throw new Error(lockCheck.reason);
  }

  const existing = getMaterialById(id);
  if (!existing) {
    throw new Error('素材不存在');
  }

  const { 
    title, content, drug_name, approval_number, 
    indication, contraindication, medical_evidence, risk_warning 
  } = data;

  if (content) {
    const offLabelCheck = checkOffLabelContent(content, indication || existing.indication);
    if (!offLabelCheck.isValid) {
      throw new Error(`内容包含超说明书表述：${offLabelCheck.violations.join('、')}`);
    }
  }

  const changes = {};
  if (title && title !== existing.title) changes.title = { old: existing.title, new: title };
  if (content && content !== existing.content) changes.content = { old: existing.content, new: content };
  if (drug_name && drug_name !== existing.drug_name) changes.drug_name = { old: existing.drug_name, new: drug_name };
  if (approval_number !== undefined && approval_number !== existing.approval_number) 
    changes.approval_number = { old: existing.approval_number, new: approval_number };
  if (indication !== undefined && indication !== existing.indication) 
    changes.indication = { old: existing.indication, new: indication };
  if (contraindication !== undefined && contraindication !== existing.contraindication) 
    changes.contraindication = { old: existing.contraindication, new: contraindication };
  if (medical_evidence !== undefined && medical_evidence !== existing.medical_evidence) 
    changes.medical_evidence = { old: existing.medical_evidence, new: medical_evidence };
  if (risk_warning !== undefined && risk_warning !== existing.risk_warning) 
    changes.risk_warning = { old: existing.risk_warning, new: risk_warning };

  const newVersion = existing.version + 1;

  const stmt = db.prepare(`
    UPDATE materials SET
      title = COALESCE(?, title),
      content = COALESCE(?, content),
      drug_name = COALESCE(?, drug_name),
      approval_number = COALESCE(?, approval_number),
      indication = COALESCE(?, indication),
      contraindication = COALESCE(?, contraindication),
      medical_evidence = COALESCE(?, medical_evidence),
      risk_warning = COALESCE(?, risk_warning),
      version = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND is_deleted = 0
  `);

  stmt.run(
    title, content, drug_name, approval_number, indication,
    contraindication, medical_evidence, risk_warning, newVersion, id
  );

  recordTrail({
    materialId: id,
    version: newVersion,
    action: 'UPDATE',
    operator,
    operatorRole: 'MARKETING',
    fromStatus: existing.status,
    toStatus: existing.status,
    remark: '修改素材内容',
    changes
  });

  return getMaterialById(id);
}

function submitForReview(id, operator) {
  const lockCheck = isMaterialLocked(id);
  if (lockCheck.locked) {
    throw new Error(lockCheck.reason);
  }

  const material = getMaterialById(id);
  if (!material) {
    throw new Error('素材不存在');
  }

  if (!canTransition(material.status, 'PENDING_MEDICAL', 'MARKETING')) {
    throw new Error(`当前状态 ${material.status} 不允许提交审核`);
  }

  const offLabelCheck = checkOffLabelContent(material.content, material.indication);
  if (!offLabelCheck.isValid) {
    throw new Error(`内容包含超说明书表述，不能提交：${offLabelCheck.violations.join('、')}`);
  }

  const newVersion = material.version + 1;

  const stmt = db.prepare(`
    UPDATE materials SET
      status = 'PENDING_MEDICAL',
      current_step = 'MEDICAL',
      version = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND is_deleted = 0
  `);

  stmt.run(newVersion, id);

  recordTrail({
    materialId: id,
    version: newVersion,
    action: 'SUBMIT',
    operator,
    operatorRole: 'MARKETING',
    fromStatus: material.status,
    toStatus: 'PENDING_MEDICAL',
    remark: '提交医学审核'
  });

  return getMaterialById(id);
}

function getMaterialById(id) {
  const stmt = db.prepare(`
    SELECT * FROM materials WHERE id = ? AND is_deleted = 0
  `);
  return stmt.get(id);
}

function getMaterialList(params = {}) {
  const { status, current_step, created_by, page = 1, pageSize = 10 } = params;
  
  let whereClauses = ['is_deleted = 0'];
  let queryParams = [];

  if (status) {
    whereClauses.push('status = ?');
    queryParams.push(status);
  }
  if (current_step) {
    whereClauses.push('current_step = ?');
    queryParams.push(current_step);
  }
  if (created_by) {
    whereClauses.push('created_by = ?');
    queryParams.push(created_by);
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

function getMaterialDetail(id) {
  const material = getMaterialById(id);
  if (!material) return null;

  const medicalOpinions = db.prepare(`
    SELECT * FROM medical_opinions 
    WHERE material_id = ? 
    ORDER BY created_at DESC, version DESC
  `).all(id);

  const legalOpinions = db.prepare(`
    SELECT * FROM legal_opinions 
    WHERE material_id = ? 
    ORDER BY created_at DESC, version DESC
  `).all(id);

  const trails = db.prepare(`
    SELECT 
      t.*,
      CASE 
        WHEN t.action = 'CREATE' THEN '创建'
        WHEN t.action = 'UPDATE' THEN '修改'
        WHEN t.action = 'SUBMIT' THEN '提交'
        WHEN t.action = 'MEDICAL_APPROVE' THEN '医学审核通过'
        WHEN t.action = 'MEDICAL_REJECT' THEN '医学审核驳回'
        WHEN t.action = 'LEGAL_APPROVE' THEN '法务审核通过'
        WHEN t.action = 'LEGAL_REJECT' THEN '法务审核驳回'
        WHEN t.action = 'PUBLISH' THEN '发布'
        ELSE t.action
      END as action_name,
      CASE 
        WHEN t.operator_role = 'MARKETING' THEN '市场部'
        WHEN t.operator_role = 'MEDICAL' THEN '医学审核'
        WHEN t.operator_role = 'LEGAL' THEN '法务'
        ELSE t.operator_role
      END as role_name
    FROM audit_trails t
    WHERE t.material_id = ?
    ORDER BY t.created_at DESC
  `).all(id).map(t => ({
    ...t,
    changes: t.changes ? JSON.parse(t.changes) : null
  }));

  const publishedVersions = db.prepare(`
    SELECT * FROM published_versions 
    WHERE material_id = ? 
    ORDER BY published_at DESC
  `).all(id);

  return {
    ...material,
    medical_opinions: medicalOpinions,
    legal_opinions: legalOpinions,
    audit_trails: trails,
    published_versions: publishedVersions
  };
}

function createNewVersion(id, operator) {
  const existing = getMaterialById(id);
  if (!existing) {
    throw new Error('素材不存在');
  }

  if (existing.status !== 'PUBLISHED') {
    throw new Error('只有已发布的素材才能创建新版本');
  }

  const newId = uuidv4();
  const newVersion = 1;

  const stmt = db.prepare(`
    INSERT INTO materials (
      id, title, content, drug_name, approval_number, indication,
      contraindication, medical_evidence, risk_warning, status, 
      current_step, version, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    newId, existing.title + ' (新版本)', existing.content, existing.drug_name, 
    existing.approval_number, existing.indication, existing.contraindication, 
    existing.medical_evidence, existing.risk_warning, 'DRAFT',
    'MARKETING', newVersion, operator
  );

  recordTrail({
    materialId: newId,
    version: newVersion,
    action: 'CREATE',
    operator,
    operatorRole: 'MARKETING',
    fromStatus: null,
    toStatus: 'DRAFT',
    remark: `基于已发布版本 v${existing.version} 创建新版本，原素材ID: ${id}`
  });

  return getMaterialById(newId);
}

module.exports = {
  createMaterial,
  updateMaterial,
  submitForReview,
  getMaterialById,
  getMaterialList,
  getMaterialDetail,
  createNewVersion
};
