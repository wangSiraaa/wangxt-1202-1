const request = require('supertest');
const app = require('../server');

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
        .send({
          title: '测试药品广告',
          content: '本产品可以根治糖尿病，无毒副作用，治愈率100%',
          drug_name: '测试药品',
          approval_number: '国药准字H12345678',
          indication: '用于治疗2型糖尿病',
          contraindication: '孕妇禁用',
          medical_evidence: '三期临床试验数据支持，N Engl J Med 2023',
          risk_warning: '可能引起低血糖反应'
        })
        .set('x-operator', 'TestUser')
        .set('x-role', 'MARKETING');
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('超说明书表述');
    });

    test('1.2 创建素材 - 合法内容应该成功', async () => {
      const res = await request(app)
        .post('/api/materials')
        .send({
          title: '测试药品广告',
          content: '本产品用于治疗2型糖尿病，请在医生指导下使用',
          drug_name: '测试药品',
          approval_number: '国药准字H12345678',
          indication: '用于治疗2型糖尿病',
          contraindication: '孕妇禁用',
          medical_evidence: '三期临床试验数据支持，N Engl J Med 2023',
          risk_warning: '可能引起低血糖反应'
        })
        .set('x-operator', 'TestUser')
        .set('x-role', 'MARKETING');
      
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('测试药品广告');
      expect(res.body.data.status).toBe('DRAFT');
      materialId = res.body.data.id;
    });

    test('1.3 提交审核 - 状态应该流转到待医学审核', async () => {
      const res = await request(app)
        .post(`/api/materials/${materialId}/submit`)
        .set('x-operator', 'TestUser')
        .set('x-role', 'MARKETING');
      
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING_MEDICAL');
    });

    test('1.4 获取素材列表', async () => {
      const res = await request(app)
        .get('/api/materials')
        .set('x-operator', 'TestUser')
        .set('x-role', 'MARKETING');
      
      expect(res.status).toBe(200);
      expect(res.body.data.list.length).toBeGreaterThan(0);
    });

    test('1.5 获取素材详情 - 应该包含完整信息', async () => {
      const res = await request(app)
        .get(`/api/materials/${materialId}`)
        .set('x-operator', 'TestUser')
        .set('x-role', 'MARKETING');
      
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(materialId);
      expect(res.body.data.audit_trails).toBeDefined();
    });
  });

  describe('2. 医学审核测试', () => {
    test('2.1 获取待医学审核列表', async () => {
      const res = await request(app)
        .get('/api/medical/pending')
        .set('x-operator', 'MedicalReviewer')
        .set('x-role', 'MEDICAL');
      
      expect(res.status).toBe(200);
      expect(res.body.data.list.length).toBeGreaterThan(0);
    });

    test('2.2 医学审核 - 提交医学意见', async () => {
      const res = await request(app)
        .post(`/api/medical/${materialId}/opinion`)
        .send({
          indication_check: 1,
          contraindication_check: 1,
          evidence_check: 1,
          is_approved: 1,
          opinion: '适应症核对无误，禁忌标注正确，医学证据充分，同意通过。'
        })
        .set('x-operator', 'MedicalReviewer')
        .set('x-role', 'MEDICAL');
      
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
        .set('x-operator', 'TestUser')
        .set('x-role', 'MARKETING');
      
      expect(res.status).toBe(403);
    });
  });

  describe('3. 法务审核测试', () => {
    test('3.1 获取待法务审核列表', async () => {
      const res = await request(app)
        .get('/api/legal/pending')
        .set('x-operator', 'LegalReviewer')
        .set('x-role', 'LEGAL');
      
      expect(res.status).toBe(200);
      expect(res.body.data.list.length).toBeGreaterThan(0);
    });

    test('3.2 法务审核 - 批准文号格式错误应该被拦截', async () => {
      const res = await request(app)
        .post(`/api/legal/${materialId}/opinion`)
        .send({
          approval_number_check: 0,
          risk_warning_check: 1,
          off_label_check: 1,
          is_approved: 0,
          opinion: '批准文号格式有误，请核对。',
          suggestion: '请使用正确的国药准字格式，如：国药准字H12345678'
        })
        .set('x-operator', 'LegalReviewer')
        .set('x-role', 'LEGAL');
      
      expect(res.status).toBe(400);
    });

    test('3.3 修改素材后重新提交', async () => {
      const updateRes = await request(app)
        .put(`/api/materials/${materialId}`)
        .send({
          title: '测试药品广告（修订）',
          content: '本产品用于治疗2型糖尿病，请在医生指导下使用',
          drug_name: '测试药品',
          approval_number: '国药准字H12345678',
          indication: '用于治疗2型糖尿病',
          contraindication: '孕妇禁用',
          medical_evidence: '三期临床试验数据支持，N Engl J Med 2023',
          risk_warning: '可能引起低血糖反应，请定期监测血糖，请仔细阅读说明书'
        })
        .set('x-operator', 'TestUser')
        .set('x-role', 'MARKETING');
      
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
});
