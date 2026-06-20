const request = require('supertest');
const app = require('../server');

const MARKETING_HEADERS = { 'x-operator': 'TestUser', 'x-role': 'MARKETING' };
const MEDICAL_HEADERS = { 'x-operator': 'LiMedical', 'x-role': 'MEDICAL' };
const LEGAL_HEADERS = { 'x-operator': 'WangLegal', 'x-role': 'LEGAL' };

function createValidMaterial(extra = {}) {
  return {
    title: '测试药品广告',
    content: '本产品用于治疗2型糖尿病，请在医生指导下使用',
    drug_name: '测试药品',
    approval_number: '国药准字H12345678',
    indication: '用于治疗2型糖尿病',
    contraindication: '孕妇禁用',
    medical_evidence: '三期临床试验数据支持，N Engl J Med 2023',
    risk_warning: '可能引起低血糖反应，请仔细阅读说明书',
    ...extra
  };
}

async function createAndSubmitMaterial(extra = {}) {
  const createRes = await request(app)
    .post('/api/materials')
    .send(createValidMaterial(extra))
    .set(MARKETING_HEADERS);
  expect(createRes.status).toBe(201);
  const materialId = createRes.body.data.id;
  const submitRes = await request(app)
    .post(`/api/materials/${materialId}/submit`)
    .set(MARKETING_HEADERS);
  expect(submitRes.status).toBe(200);
  expect(submitRes.body.data.status).toBe('PENDING_MEDICAL');
  return materialId;
}

async function medicalApprove(materialId, headers = MEDICAL_HEADERS) {
  return await request(app)
    .post(`/api/medical/${materialId}/opinion`)
    .send({
      indication_check: 1,
      contraindication_check: 1,
      evidence_check: 1,
      is_approved: 1,
      opinion: '适应症核对无误，禁忌标注正确，医学证据充分，同意通过。'
    })
    .set(headers);
}

async function legalApproveAndPublish(materialId, headers = LEGAL_HEADERS) {
  return await request(app)
    .post(`/api/legal/${materialId}/opinion`)
    .send({
      approval_number_check: 1,
      risk_warning_check: 1,
      off_label_check: 1,
      is_approved: 1,
      opinion: '批准文号格式正确，风险警示语充分，同意发布。'
    })
    .set(headers);
}

describe('药品广告合规审查系统 - 集成测试', () => {
  let materialId;

  beforeAll(() => {
    process.env.OPERATOR = 'TestUser';
    process.env.ROLE = 'MARKETING';
  });

  describe('1. 素材管理测试', () => {
    test('1.1 创建素材 - 超说明书表述应该被拦截', async () => {
      const res = await request(app)
        .post('/api/materials')
        .send(createValidMaterial({
          content: '本产品可以根治糖尿病，无毒副作用，治愈率100%'
        }))
        .set(MARKETING_HEADERS);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('超说明书表述');
    });

    test('1.2 创建素材 - 合法内容应该成功', async () => {
      const res = await request(app)
        .post('/api/materials')
        .send(createValidMaterial())
        .set(MARKETING_HEADERS);
      
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('测试药品广告');
      expect(res.body.data.status).toBe('DRAFT');
      materialId = res.body.data.id;
    });

    test('1.3 提交审核 - 状态应该流转到待医学审核', async () => {
      const res = await request(app)
        .post(`/api/materials/${materialId}/submit`)
        .set(MARKETING_HEADERS);
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING_MEDICAL');
    });

    test('1.4 获取素材列表', async () => {
      const res = await request(app)
        .get('/api/materials')
        .set(MARKETING_HEADERS);
      
      expect(res.status).toBe(200);
      expect(res.body.data.list.length).toBeGreaterThan(0);
    });

    test('1.5 获取素材详情 - 应该包含完整信息', async () => {
      const res = await request(app)
        .get(`/api/materials/${materialId}`)
        .set(MARKETING_HEADERS);
      
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(materialId);
      expect(res.body.data.audit_trails).toBeDefined();
    });
  });

  describe('2. 医学审核测试', () => {
    test('2.1 获取待医学审核列表', async () => {
      const res = await request(app)
        .get('/api/medical/pending')
        .set(MEDICAL_HEADERS);
      
      expect(res.status).toBe(200);
      expect(res.body.data.list.length).toBeGreaterThan(0);
    });

    test('2.2 医学审核 - 提交医学意见', async () => {
      const res = await medicalApprove(materialId);
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING_LEGAL');
    });

    test('2.3 医学审核 - 非法角色不能操作', async () => {
      const res = await request(app)
        .post(`/api/medical/${materialId}/opinion`)
        .send({
          indication_check: 1,
          is_approved: 1,
          opinion: '测试'
        })
        .set(MARKETING_HEADERS);
      
      expect(res.status).toBe(403);
    });
  });

  describe('3. 法务审核测试', () => {
    test('3.1 获取待法务审核列表', async () => {
      const res = await request(app)
        .get('/api/legal/pending')
        .set(LEGAL_HEADERS);
      
      expect(res.status).toBe(200);
      expect(res.body.data.list.length).toBeGreaterThan(0);
    });

    test('3.2 法务审核 - 批准文号格式错误应该被拦截', async () => {
      const badApprovalMaterialId = await createAndSubmitMaterial({
        approval_number: 'H12345678'
      });
      await medicalApprove(badApprovalMaterialId);

      const res = await request(app)
        .post(`/api/legal/${badApprovalMaterialId}/opinion`)
        .send({
          approval_number_check: 0,
          risk_warning_check: 1,
          off_label_check: 1,
          is_approved: 1,
          opinion: '尝试通过但批准文号格式有误'
        })
        .set(LEGAL_HEADERS);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('批准文号');
    });

    test('3.3 修改素材后重新提交', async () => {
      const updateRes = await request(app)
        .put(`/api/materials/${materialId}`)
        .send(createValidMaterial({
          title: '测试药品广告（修订）',
          risk_warning: '可能引起低血糖反应，请定期监测血糖，请仔细阅读说明书'
        }))
        .set(MARKETING_HEADERS);
      
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.version).toBeGreaterThanOrEqual(2);
    });
  });

  describe('4. 业务规则校验测试', () => {
    test('4.1 超说明书表述检测', async () => {
      const res = await request(app)
        .post('/api/validation/offlabel')
        .send({
          content: '本产品可以根治糖尿病，治愈率100%，永不复发',
          indication: '用于治疗2型糖尿病'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(false);
      expect(res.body.violations.length).toBeGreaterThan(0);
    });

    test('4.2 批准文号格式校验 - 合法', async () => {
      const res = await request(app)
        .post('/api/validation/approval-number')
        .send({ approvalNumber: '国药准字H12345678' });
      
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
    });

    test('4.3 批准文号格式校验 - 非法', async () => {
      const res = await request(app)
        .post('/api/validation/approval-number')
        .send({ approvalNumber: 'H12345678' });
      
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(false);
    });

    test('4.4 医学证据充分性校验 - 不充分', async () => {
      const res = await request(app)
        .post('/api/validation/medical-evidence')
        .send({ evidence: '测试' });
      
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(false);
    });

    test('4.5 风险警示语校验 - 充分', async () => {
      const res = await request(app)
        .post('/api/validation/risk-warning')
        .send({
          content: '本产品用于治疗糖尿病',
          riskWarning: '可能引起低血糖反应，请在医生指导下使用'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
    });
  });

  describe('5. 医学审核人写入回归测试', () => {
    let regressionMaterialId;

    beforeAll(async () => {
      regressionMaterialId = await createAndSubmitMaterial();
    });

    test('5.1 缺失医学证据 - 退回市场部', async () => {
      const noEvidenceMaterialId = await createAndSubmitMaterial({
        medical_evidence: '不足'
      });

      const res = await request(app)
        .post(`/api/medical/${noEvidenceMaterialId}/opinion`)
        .send({
          indication_check: 1,
          contraindication_check: 1,
          evidence_check: 0,
          is_approved: 0,
          opinion: '医学证据不充分，请补充临床试验数据。',
          suggestion: '请提供三期临床试验报告或权威文献支持。'
        })
        .set(MEDICAL_HEADERS);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('MEDICAL_REJECTED');
      expect(res.body.data.reviewer).toBe('LiMedical');
    });

    test('5.2 缺失医学证据 - 尝试通过应被拦截', async () => {
      const noEvidenceMaterialId = await createAndSubmitMaterial({
        medical_evidence: '不足'
      });

      const res = await request(app)
        .post(`/api/medical/${noEvidenceMaterialId}/opinion`)
        .send({
          indication_check: 1,
          contraindication_check: 1,
          evidence_check: 0,
          is_approved: 1,
          opinion: '尝试通过'
        })
        .set(MEDICAL_HEADERS);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('医学证据缺失');
    });

    test('5.3 医学审核通过 - 审核人正确写入并流转到法务', async () => {
      const res = await medicalApprove(regressionMaterialId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PENDING_LEGAL');
      expect(res.body.data.reviewer).toBe('LiMedical');

      const opinionsRes = await request(app)
        .get(`/api/medical/${regressionMaterialId}/opinions`)
        .set(MEDICAL_HEADERS);

      expect(opinionsRes.status).toBe(200);
      const latestOpinion = opinionsRes.body.data[0];
      expect(latestOpinion.reviewer).toBe('LiMedical');
      expect(latestOpinion.is_approved).toBe(1);
      expect(latestOpinion.evidence_check).toBe(1);
    });

    test('5.4 医学审核通过 - 审核痕迹记录操作人和', async () => {
      const detailRes = await request(app)
        .get(`/api/materials/${regressionMaterialId}`)
        .set(MEDICAL_HEADERS);

      const medicalTrails = detailRes.body.data.audit_trails.filter(
        t => t.action === 'MEDICAL_APPROVE'
      );
      expect(medicalTrails.length).toBeGreaterThan(0);
      expect(medicalTrails[0].operator).toBe('LiMedical');
      expect(medicalTrails[0].operator_role).toBe('MEDICAL');
      expect(medicalTrails[0].to_status).toBe('PENDING_LEGAL');
    });
  });

  describe('6. 法务审核发布回归测试', () => {
    let legalMaterialId;

    beforeAll(async () => {
      legalMaterialId = await createAndSubmitMaterial();
      const medRes = await medicalApprove(legalMaterialId);
      expect(medRes.status).toBe(200);
      expect(medRes.body.data.status).toBe('PENDING_LEGAL');
    });

    test('6.1 法务发布 - 审核人写入并流转到已发布', async () => {
      const res = await legalApproveAndPublish(legalMaterialId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PUBLISHED');
      expect(res.body.data.reviewer).toBe('WangLegal');

      const detailRes = await request(app)
        .get(`/api/materials/${legalMaterialId}`)
        .set(LEGAL_HEADERS);

      const legalOpinions = detailRes.body.data.legal_opinions;
      expect(legalOpinions.length).toBeGreaterThan(0);
      expect(legalOpinions[0].reviewer).toBe('WangLegal');
      expect(legalOpinions[0].is_approved).toBe(1);
    });

    test('6.2 法务发布后 - 素材被锁定不可修改', async () => {
      const res = await request(app)
        .put(`/api/materials/${legalMaterialId}`)
        .send(createValidMaterial({ title: '试图修改已发布素材' }))
        .set(MARKETING_HEADERS);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('已发布');
    });

    test('6.3 法务发布后 - published_versions 记录发布人', async () => {
      const detailRes = await request(app)
        .get(`/api/materials/${legalMaterialId}`)
        .set(LEGAL_HEADERS);

      const publishedVersions = detailRes.body.data.published_versions;
      expect(publishedVersions.length).toBeGreaterThan(0);
      expect(publishedVersions[0].published_by).toBe('WangLegal');
      expect(publishedVersions[0].is_locked).toBe(1);
    });

    test('6.4 法务发布后 - 审核痕迹包含发布记录', async () => {
      const detailRes = await request(app)
        .get(`/api/materials/${legalMaterialId}`)
        .set(LEGAL_HEADERS);

      const trails = detailRes.body.data.audit_trails;
      const publishTrail = trails.find(t => t.action === 'LEGAL_APPROVE');
      expect(publishTrail).toBeDefined();
      expect(publishTrail.operator).toBe('WangLegal');
      expect(publishTrail.operator_role).toBe('LEGAL');
      expect(publishTrail.to_status).toBe('PUBLISHED');
    });
  });

  describe('7. 审核人缺失防护回归测试', () => {
    test('7.1 缺少 x-operator 请求头应被拒绝', async () => {
      const submitMaterialId = await createAndSubmitMaterial();
      const res = await request(app)
        .post(`/api/medical/${submitMaterialId}/opinion`)
        .send({
          indication_check: 1,
          contraindication_check: 1,
          evidence_check: 1,
          is_approved: 1,
          opinion: '测试缺少审核人'
        })
        .set('x-role', 'MEDICAL');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('审核人信息');
    });

    test('7.2 缺少 x-role 请求头应被拒绝', async () => {
      const submitMaterialId = await createAndSubmitMaterial();
      const res = await request(app)
        .post(`/api/medical/${submitMaterialId}/opinion`)
        .send({
          indication_check: 1,
          contraindication_check: 1,
          evidence_check: 1,
          is_approved: 1,
          opinion: '测试缺少角色'
        })
        .set('x-operator', 'LiMedical');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('角色信息');
    });
  });
});
