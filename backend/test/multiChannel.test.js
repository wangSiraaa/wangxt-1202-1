const request = require('supertest');
const app = require('../server');

const MARKETING_HEADERS = { 'x-operator': 'MarketUser', 'x-role': 'MARKETING' };
const MEDICAL_HEADERS = { 'x-operator': 'DrReview', 'x-role': 'MEDICAL' };
const LEGAL_HEADERS = { 'x-operator': 'LegalCounsel', 'x-role': 'LEGAL' };

function baseMaterial(extra = {}) {
  return {
    title: '降糖新药宣传',
    content: '本产品用于治疗2型糖尿病，请在医生指导下使用',
    drug_name: '降糖新药',
    approval_number: '国药准字H20240001',
    indication: '用于治疗2型糖尿病',
    contraindication: '孕妇禁用',
    medical_evidence: '三期临床试验数据支持，N Engl J Med 2024',
    evidence_source: '国家药品监督管理局批准的说明书及三期临床试验报告',
    risk_warning: '可能引起低血糖反应，请仔细阅读说明书',
    ...extra
  };
}

async function createMaterial(extra = {}, headers = MARKETING_HEADERS) {
  const res = await request(app)
    .post('/api/materials')
    .send(baseMaterial(extra))
    .set(headers);
  if (res.status !== 201) throw new Error(`创建素材失败：${res.body.error}`);
  return res.body.data;
}

async function submit(materialId, headers = MARKETING_HEADERS) {
  const res = await request(app)
    .post(`/api/materials/${materialId}/submit`)
    .set(headers);
  if (res.status !== 200) throw new Error(`提交审核失败：${res.body.error}`);
  return res.body.data;
}

async function createAndSubmit(extra = {}, headers = MARKETING_HEADERS) {
  const m = await createMaterial(extra, headers);
  await submit(m.id, headers);
  return m;
}

async function medicalApprove(materialId, extra = {}, headers = MEDICAL_HEADERS) {
  return await request(app)
    .post(`/api/medical/${materialId}/opinion`)
    .send({
      indication_check: 1,
      contraindication_check: 1,
      evidence_check: 1,
      is_approved: 1,
      opinion: '适应症、禁忌、证据来源均核对无误',
      ...extra
    })
    .set(headers);
}

async function medicalReject(materialId, rejectionReason, extra = {}, headers = MEDICAL_HEADERS) {
  return await request(app)
    .post(`/api/medical/${materialId}/opinion`)
    .send({
      indication_check: 1,
      contraindication_check: 1,
      evidence_check: 0,
      is_approved: 0,
      opinion: '证据不足，退回补充',
      rejection_reason: rejectionReason,
      ...extra
    })
    .set(headers);
}

async function legalApprove(materialId, headers = LEGAL_HEADERS) {
  return await request(app)
    .post(`/api/legal/${materialId}/opinion`)
    .send({
      approval_number_check: 1,
      risk_warning_check: 1,
      off_label_check: 1,
      is_approved: 1,
      opinion: '批准文号、风险警示语均符合要求，同意发布'
    })
    .set(headers);
}

async function legalReject(materialId, rejectionReason, headers = LEGAL_HEADERS) {
  return await request(app)
    .post(`/api/legal/${materialId}/opinion`)
    .send({
      approval_number_check: 1,
      risk_warning_check: 0,
      off_label_check: 1,
      is_approved: 0,
      opinion: '风险措辞不充分',
      rejection_reason: rejectionReason
    })
    .set(headers);
}

async function publishFullFlow(extra = {}, headers = MARKETING_HEADERS) {
  const m = await createAndSubmit(extra, headers);
  const med = await medicalApprove(m.id);
  if (med.status !== 200) throw new Error(`医学审核失败：${med.body.error}`);
  const legal = await legalApprove(m.id);
  if (legal.status !== 200) throw new Error(`法务发布失败：${legal.body.error}`);
  return m;
}

describe('多渠道素材与证据版本比对 - 集成测试', () => {
  describe('8. 多渠道主题创建与去重', () => {
    let posterId;
    let themeId;

    test('8.1 同一主题创建海报、短视频、直播口播三种渠道素材', async () => {
      const poster = await createMaterial({ channel: 'POSTER' });
      posterId = poster.id;
      themeId = poster.theme_id;
      expect(poster.channel).toBe('POSTER');
      expect(poster.theme_id).toBe(poster.id);

      const video = await createMaterial({
        channel: 'SHORT_VIDEO', theme_id: themeId,
        title: '降糖新药短视频', content: '本产品用于治疗2型糖尿病，请在医生指导下使用'
      });
      expect(video.channel).toBe('SHORT_VIDEO');
      expect(video.theme_id).toBe(themeId);

      const live = await createMaterial({
        channel: 'LIVE_BROADCAST', theme_id: themeId,
        title: '降糖新药直播口播', content: '本产品用于治疗2型糖尿病，请在医生指导下使用'
      });
      expect(live.channel).toBe('LIVE_BROADCAST');
      expect(live.theme_id).toBe(themeId);
    });

    test('8.2 同主题同渠道素材不可重复创建', async () => {
      const res = await request(app)
        .post('/api/materials')
        .send(baseMaterial({
          channel: 'POSTER', theme_id: themeId,
          title: '重复海报'
        }))
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('已存在');
    });

    test('8.3 主题分组查询返回全部渠道', async () => {
      const res = await request(app)
        .get(`/api/materials/theme/${themeId}`)
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.channels.POSTER).toBeDefined();
      expect(res.body.data.channels.SHORT_VIDEO).toBeDefined();
      expect(res.body.data.channels.LIVE_BROADCAST).toBeDefined();
    });
  });

  describe('9. 按渠道分别医学审核', () => {
    let themeId;
    let channelIds = {};

    beforeAll(async () => {
      const poster = await createAndSubmit({ channel: 'POSTER' });
      themeId = poster.theme_id;
      channelIds.POSTER = poster.id;

      const video = await createAndSubmit({
        channel: 'SHORT_VIDEO', theme_id: themeId,
        title: '短视频素材', content: '本产品用于治疗2型糖尿病，请在医生指导下使用'
      });
      channelIds.SHORT_VIDEO = video.id;

      const live = await createAndSubmit({
        channel: 'LIVE_BROADCAST', theme_id: themeId,
        title: '直播口播素材', content: '本产品用于治疗2型糖尿病，请在医生指导下使用'
      });
      channelIds.LIVE_BROADCAST = live.id;
    });

    test('9.1 海报渠道医学审核通过并流转法务', async () => {
      const res = await medicalApprove(channelIds.POSTER);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING_LEGAL');
      expect(res.body.data.channel).toBe('POSTER');
    });

    test('9.2 短视频渠道医学审核通过并流转法务', async () => {
      const res = await medicalApprove(channelIds.SHORT_VIDEO);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING_LEGAL');
      expect(res.body.data.channel).toBe('SHORT_VIDEO');
    });

    test('9.3 直播口播渠道医学审核通过并流转法务', async () => {
      const res = await medicalApprove(channelIds.LIVE_BROADCAST);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING_LEGAL');
      expect(res.body.data.channel).toBe('LIVE_BROADCAST');
    });

    test('9.4 各渠道医学意见分别记录渠道与证据来源', async () => {
      const res = await request(app)
        .get(`/api/medical/${channelIds.LIVE_BROADCAST}/opinions`)
        .set(MEDICAL_HEADERS);

      expect(res.status).toBe(200);
      expect(res.body.data[0].channel).toBe('LIVE_BROADCAST');
      expect(res.body.data[0].channel_name).toBe('直播口播');
      expect(res.body.data[0].evidence_source).toBeDefined();
    });
  });

  describe('10. 证据版本快照与比对', () => {
    let materialId;
    let firstVersionId;

    test('10.1 创建素材时生成首个证据版本快照', async () => {
      const m = await createMaterial();
      materialId = m.id;
      const res = await request(app)
        .get(`/api/materials/${materialId}/evidence-versions`)
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      firstVersionId = res.body.data[0].id;
      expect(res.body.data[0].evidence_source).toContain('临床试验报告');
    });

    test('10.2 修改证据来源后生成新版本快照', async () => {
      const res = await request(app)
        .put(`/api/materials/${materialId}`)
        .send(baseMaterial({
          evidence_source: '国家药监局批准文件及上市后真实世界研究数据',
          title: '降糖新药宣传（证据更新）'
        }))
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(200);

      const versionsRes = await request(app)
        .get(`/api/materials/${materialId}/evidence-versions`)
        .set(MARKETING_HEADERS);

      expect(versionsRes.body.data.length).toBeGreaterThanOrEqual(2);
      const latest = versionsRes.body.data[versionsRes.body.data.length - 1];
      expect(latest.evidence_source).toContain('真实世界研究');
    });

    test('10.3 比对两个证据版本可识别差异', async () => {
      const versionsRes = await request(app)
        .get(`/api/materials/${materialId}/evidence-versions`)
        .set(MARKETING_HEADERS);
      const versions = versionsRes.body.data;
      const aId = versions[0].id;
      const bId = versions[versions.length - 1].id;

      const res = await request(app)
        .get(`/api/materials/evidence-versions/compare?a=${aId}&b=${bId}`)
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(200);
      expect(res.body.data.comparable).toBe(true);
      expect(res.body.data.diff.has_changes).toBe(true);
      expect(res.body.data.diff.evidence_source_changed).toBe(true);
    });
  });

  describe('11. 渠道风险措辞修订审批流', () => {
    let publishedId;
    let revisionId;

    beforeAll(async () => {
      const m = await publishFullFlow({ channel: 'POSTER' });
      publishedId = m.id;
    });

    test('11.1 已发布素材锁定不可修改', async () => {
      const res = await request(app)
        .put(`/api/materials/${publishedId}`)
        .send(baseMaterial({ title: '试图修改已发布' }))
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('已发布');
    });

    test('11.2 未发布素材不能创建渠道修订', async () => {
      const draft = await createMaterial({ channel: 'POSTER' });
      const res = await request(app)
        .post(`/api/materials/${draft.id}/channel-revision`)
        .send({ revision_reason: '渠道要求更改风险措辞' })
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('已发布');
    });

    test('11.3 创建渠道修订版本需填写修订原因', async () => {
      const res = await request(app)
        .post(`/api/materials/${publishedId}/channel-revision`)
        .send({ revision_reason: '' })
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('修订原因');
    });

    test('11.4 渠道修订创建新版本并保留溯源关系', async () => {
      const res = await request(app)
        .post(`/api/materials/${publishedId}/channel-revision`)
        .send({ revision_reason: '海报投放渠道要求强化低血糖风险提示' })
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.revised_from_id).toBe(publishedId);
      expect(res.body.data.revision_reason).toContain('低血糖风险');
      expect(res.body.data.theme_id).toBeDefined();
      revisionId = res.body.data.id;

      const trailRes = await request(app)
        .get(`/api/materials/${revisionId}/trails`)
        .set(MARKETING_HEADERS);
      const revisionTrail = trailRes.body.data.find(t => t.action === 'CHANNEL_REVISION');
      expect(revisionTrail).toBeDefined();
    });

    test('11.5 渠道修订版本走完整审批流并发布', async () => {
      await submit(revisionId);
      const med = await medicalApprove(revisionId);
      expect(med.status).toBe(200);

      const legal = await legalApprove(revisionId);
      expect(legal.status).toBe(200);
      expect(legal.body.data.status).toBe('PUBLISHED');

      const detailRes = await request(app)
        .get(`/api/materials/${revisionId}`)
        .set(LEGAL_HEADERS);
      const published = detailRes.body.data.published_versions;
      expect(published.length).toBeGreaterThan(0);
      expect(published[0].revision_reason).toContain('低血糖风险');
      expect(published[0].revised_from_id).toBe(publishedId);
    });
  });

  describe('12. 退回原因留存', () => {
    test('12.1 医学审核退回原因被记录并可查询', async () => {
      const m = await createAndSubmit({
        medical_evidence: '数据不足',
        evidence_source: '暂无'
      });

      const rejectRes = await medicalReject(
        m.id,
        '适应症证据来源不明确，需补充三期临床试验报告编号'
      );
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('MEDICAL_REJECTED');

      const reasonsRes = await request(app)
        .get(`/api/medical/${m.id}/rejection-reasons`)
        .set(MEDICAL_HEADERS);
      expect(reasonsRes.status).toBe(200);
      expect(reasonsRes.body.data.length).toBeGreaterThan(0);
      expect(reasonsRes.body.data[0].rejection_reason).toContain('三期临床试验');
      expect(reasonsRes.body.data[0].stage).toBe('MEDICAL');
    });

    test('12.2 医学退回时不填退回原因应被拦截', async () => {
      const m = await createAndSubmit({ medical_evidence: '数据不足' });
      const res = await request(app)
        .post(`/api/medical/${m.id}/opinion`)
        .send({
          indication_check: 1,
          contraindication_check: 1,
          evidence_check: 0,
          is_approved: 0,
          opinion: '退回'
        })
        .set(MEDICAL_HEADERS);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('退回原因');
    });

    test('12.3 法务审核退回原因被记录并可查询', async () => {
      const m = await createAndSubmit({ channel: 'SHORT_VIDEO' });
      await medicalApprove(m.id);

      const rejectRes = await legalReject(m.id, '风险警示语未覆盖低血糖处置方式，需补充');
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.data.status).toBe('LEGAL_REJECTED');

      const reasonsRes = await request(app)
        .get(`/api/legal/${m.id}/rejection-reasons`)
        .set(LEGAL_HEADERS);
      expect(reasonsRes.status).toBe(200);
      expect(reasonsRes.body.data.length).toBeGreaterThan(0);
      expect(reasonsRes.body.data[0].rejection_reason).toContain('低血糖');
      expect(reasonsRes.body.data[0].stage).toBe('LEGAL');
    });

    test('12.4 综合退回原因查询汇总医学与法务', async () => {
      const m = await createAndSubmit({ medical_evidence: '数据不足' });

      await medicalReject(m.id, '医学证据不足，退回一');

      await request(app)
        .put(`/api/materials/${m.id}`)
        .send(baseMaterial({
          title: '降糖新药宣传（补充证据）',
          medical_evidence: '三期临床试验数据支持，N Engl J Med 2024',
          evidence_source: '国家药品监督管理局批准的说明书及三期临床试验报告'
        }))
        .set(MARKETING_HEADERS);
      await submit(m.id);
      await medicalApprove(m.id);
      await legalReject(m.id, '风险措辞不充分，退回一');

      const res = await request(app)
        .get(`/api/materials/${m.id}/rejection-reasons`)
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(200);
      const stages = res.body.data.map(r => r.stage);
      expect(stages).toContain('MEDICAL');
      expect(stages).toContain('LEGAL');
      expect(res.body.data.every(r => r.rejection_reason)).toBe(true);
    });
  });

  describe('13. 渠道与证据来源校验接口', () => {
    test('13.1 渠道枚举查询', async () => {
      const res = await request(app).get('/api/validation/channels');
      expect(res.status).toBe(200);
      const codes = res.body.data.map(c => c.code);
      expect(codes).toEqual(expect.arrayContaining(['POSTER', 'SHORT_VIDEO', 'LIVE_BROADCAST']));
    });

    test('13.2 非法渠道校验失败', async () => {
      const res = await request(app)
        .post('/api/validation/channel')
        .send({ channel: 'RADIO' });
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(false);
    });

    test('13.3 证据来源校验 - 过于简略', async () => {
      const res = await request(app)
        .post('/api/validation/evidence-source')
        .send({ evidenceSource: '文献' });
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(false);
    });

    test('13.4 证据来源校验 - 合法', async () => {
      const res = await request(app)
        .post('/api/validation/evidence-source')
        .send({ evidenceSource: '三期临床试验报告及药监批准文件' });
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
    });
  });
});
