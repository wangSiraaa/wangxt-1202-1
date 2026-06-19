const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');

function recordTrail({
  materialId,
  version,
  action,
  operator,
  operatorRole,
  fromStatus,
  toStatus,
  remark,
  changes
}) {
  const stmt = db.prepare(`
    INSERT INTO audit_trails (
      id, material_id, version, action, operator, operator_role,
      from_status, to_status, remark, changes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const trailId = uuidv4();
  stmt.run(
    trailId,
    materialId,
    version,
    action,
    operator,
    operatorRole,
    fromStatus,
    toStatus,
    remark,
    changes ? JSON.stringify(changes) : null
  );

  return trailId;
}

function getTrailsByMaterialId(materialId) {
  const stmt = db.prepare(`
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
    ORDER BY t.created_at DESC, t.version DESC
  `);

  return stmt.all(materialId).map(trail => ({
    ...trail,
    changes: trail.changes ? JSON.parse(trail.changes) : null
  }));
}

function getTrailById(trailId) {
  const stmt = db.prepare('SELECT * FROM audit_trails WHERE id = ?');
  const trail = stmt.get(trailId);
  if (trail) {
    trail.changes = trail.changes ? JSON.parse(trail.changes) : null;
  }
  return trail;
}

module.exports = {
  recordTrail,
  getTrailsByMaterialId,
  getTrailById
};
