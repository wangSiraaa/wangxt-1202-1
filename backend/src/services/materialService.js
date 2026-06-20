const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');
const { recordTrail } = require('../utils/auditTrail');
const { 
  checkOffLabelContent, 
  isMaterialLocked, 
  canTransition,
  isValidChannel,
  getChannelName,
  checkChannelDuplicate,
  validateChannelRevision,
  snapshotEvidenceVersion,
  CHANNEL_TYPES,
  CHANNEL_NAME_MAP
} = require('../utils/validation');

function createMaterial(data, operator) {
  const { 
    title, content, drug_name, approval_number, 
    indication, contraindication, medical_evidence, risk_warning,
    theme_id, channel, evidence_source
  } = data;

  const offLabelCheck = checkOffLabelContent(content, indication);
  if (!offLabelCheck.isValid) {
    throw new Error(`内容包含超说明书表述：${offLabelCheck.violations.join('、')}`);
  }

  const finalChannel = channel || 'POSTER';
  if (!isValidChannel(finalChannel)) {
    throw new Error(`不支持的渠道类型：${channel}，支持：${CHANNEL_TYPES.join('、')}`);
  }

  const id = uuidv4();
  let finalThemeId = theme_id;
  if (!finalThemeId) {
    finalThemeId = id;
  } else {
    const dup = checkChannelDuplicate(finalThemeId, finalChannel);
    if (dup.isDuplicate) {
      throw new Error(`同一主题下该渠道素材已存在：${getChannelName(finalChannel)}（${dup.reason}）`);
    }
  }

  const version = 1;

  const stmt = db.prepare(`
    INSERT INTO materials (
      id, title, content, drug_name, approval_number, indication,
      contraindication, medical_evidence, risk_warning, status, 
      current_step, version, created_by, theme_id, channel, evidence_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id, title, content, drug_name, approval_number, indication,
    contraindication, medical_evidence, risk_warning, 'DRAFT',
    'MARKETING', version, operator, finalThemeId, finalChannel, evidence_source || null
  );

  snapshotEvidenceVersion({
    materialId: id,
    themeId: finalThemeId,
    channel: finalChannel,
    version,
    evidenceSource: evidence_source,
    medicalEvidence: medical_evidence,
    operator
  });

  recordTrail({
    materialId: id,
    version,
    action: 'CREATE',
    operator,
    operatorRole: 'MARKETING',
    fromStatus: null,
    toStatus: 'DRAFT',
    remark: `创建${getChannelName(finalChannel)}宣传素材${theme_id ? '（加入已有主题）' : '（新建主题）'}`
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
    indication, contraindication, medical_evidence, risk_warning,
    channel, evidence_source
  } = data;

  if (channel && channel !== existing.channel) {
    if (!isValidChannel(channel)) {
      throw new Error(`不支持的渠道类型：${channel}，支持：${CHANNEL_TYPES.join('、')}`);
    }
    const dup = checkChannelDuplicate(existing.theme_id, channel, id);
    if (dup.isDuplicate) {
      throw new Error(`同一主题下该渠道素材已存在：${getChannelName(channel)}`);
    }
  }

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
  if (channel && channel !== existing.channel) 
    changes.channel = { old: existing.channel, new: channel };
  if (evidence_source !== undefined && evidence_source !== existing.evidence_source) 
    changes.evidence_source = { old: existing.evidence_source, new: evidence_source };

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
      channel = COALESCE(?, channel),
      evidence_source = COALESCE(?, evidence_source),
      version = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND is_deleted = 0
  `);

  stmt.run(
    title ?? null,
    content ?? null,
    drug_name ?? null,
    approval_number ?? null,
    indication ?? null,
    contraindication ?? null,
    medical_evidence ?? null,
    risk_warning ?? null,
    channel ?? null,
    evidence_source ?? null,
    newVersion, id
  );

  const evidenceChanged = (medical_evidence !== undefined && medical_evidence !== existing.medical_evidence) ||
    (evidence_source !== undefined && evidence_source !== existing.evidence_source);
  if (evidenceChanged) {
    snapshotEvidenceVersion({
      materialId: id,
      themeId: existing.theme_id,
      channel: channel || existing.channel,
      version: newVersion,
      evidenceSource: evidence_source !== undefined ? evidence_source : existing.evidence_source,
      medicalEvidence: medical_evidence !== undefined ? medical_evidence : existing.medical_evidence,
      operator
    });
  }

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

  snapshotEvidenceVersion({
    materialId: id,
    themeId: material.theme_id,
    channel: material.channel,
    version: newVersion,
    evidenceSource: material.evidence_source,
    medicalEvidence: material.medical_evidence,
    operator
  });

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
    remark: `提交${getChannelName(material.channel)}素材医学审核`
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
  const { status, current_step, created_by, theme_id, channel, page = 1, pageSize = 10 } = params;
  
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
  if (theme_id) {
    whereClauses.push('theme_id = ?');
    queryParams.push(theme_id);
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

function getMaterialsByTheme(themeId) {
  const list = db.prepare(`
    SELECT * FROM materials
    WHERE theme_id = ? AND is_deleted = 0
    ORDER BY 
      CASE channel
        WHEN 'POSTER' THEN 1
        WHEN 'SHORT_VIDEO' THEN 2
        WHEN 'LIVE_BROADCAST' THEN 3
        ELSE 4
      END,
      updated_at DESC
  `).all(themeId);

  const channels = list.reduce((acc, m) => {
    acc[m.channel] = m;
    return acc;
  }, {});

  return {
    theme_id: themeId,
    total: list.length,
    channels,
    list
  };
}

function getEvidenceVersions(materialId) {
  return db.prepare(`
    SELECT * FROM evidence_versions
    WHERE material_id = ?
    ORDER BY created_at ASC, version ASC
  `).all(materialId);
}

function getEvidenceVersionsByTheme(themeId) {
  return db.prepare(`
    SELECT * FROM evidence_versions
    WHERE theme_id = ?
    ORDER BY channel, created_at ASC, version ASC
  `).all(themeId);
}

function compareEvidenceVersions(versionAId, versionBId) {
  const { compareEvidenceVersions: compare } = require('../utils/validation');
  return compare(versionAId, versionBId);
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
        WHEN t.action = 'CHANNEL_REVISION' THEN '渠道修订'
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

  const evidenceVersions = getEvidenceVersions(id);

  let themeChannels = null;
  if (material.theme_id) {
    themeChannels = db.prepare(`
      SELECT id, title, channel, status, version, updated_at
      FROM materials
      WHERE theme_id = ? AND is_deleted = 0
      ORDER BY updated_at DESC
    `).all(material.theme_id);
  }

  return {
    ...material,
    medical_opinions: medicalOpinions,
    legal_opinions: legalOpinions,
    audit_trails: trails,
    published_versions: publishedVersions,
    evidence_versions: evidenceVersions,
    theme_channels: themeChannels
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
      current_step, version, created_by, theme_id, channel, evidence_source,
      revised_from_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    newId, existing.title + ' (新版本)', existing.content, existing.drug_name, 
    existing.approval_number, existing.indication, existing.contraindication, 
    existing.medical_evidence, existing.risk_warning, 'DRAFT',
    'MARKETING', newVersion, operator, existing.theme_id, existing.channel,
    existing.evidence_source, id
  );

  snapshotEvidenceVersion({
    materialId: newId,
    themeId: existing.theme_id,
    channel: existing.channel,
    version: newVersion,
    evidenceSource: existing.evidence_source,
    medicalEvidence: existing.medical_evidence,
    operator
  });

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

function createChannelRevision(materialId, revisionReason, operator) {
  const validation = validateChannelRevision(materialId, revisionReason);
  if (!validation.isValid) {
    throw new Error(validation.reason);
  }
  const existing = validation.material;

  const newId = uuidv4();
  const newVersion = 1;

  const stmt = db.prepare(`
    INSERT INTO materials (
      id, title, content, drug_name, approval_number, indication,
      contraindication, medical_evidence, risk_warning, status, 
      current_step, version, created_by, theme_id, channel, evidence_source,
      revised_from_id, revision_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    newId,
    existing.title ? `${existing.title}（渠道修订）` : `${getChannelName(existing.channel)}素材（渠道修订）`,
    existing.content,
    existing.drug_name,
    existing.approval_number,
    existing.indication,
    existing.contraindication,
    existing.medical_evidence,
    existing.risk_warning,
    'DRAFT',
    'MARKETING',
    newVersion,
    operator,
    existing.theme_id,
    existing.channel,
    existing.evidence_source,
    materialId,
    revisionReason.trim()
  );

  snapshotEvidenceVersion({
    materialId: newId,
    themeId: existing.theme_id,
    channel: existing.channel,
    version: newVersion,
    evidenceSource: existing.evidence_source,
    medicalEvidence: existing.medical_evidence,
    operator
  });

  recordTrail({
    materialId: newId,
    version: newVersion,
    action: 'CHANNEL_REVISION',
    operator,
    operatorRole: 'MARKETING',
    fromStatus: null,
    toStatus: 'DRAFT',
    remark: `渠道修订：${revisionReason.trim()}（基于已发布素材 ${getChannelName(existing.channel)}，原素材ID: ${materialId}）`
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
  createNewVersion,
  createChannelRevision,
  getMaterialsByTheme,
  getEvidenceVersions,
  getEvidenceVersionsByTheme,
  compareEvidenceVersions
};
