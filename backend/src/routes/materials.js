const express = require('express');
const router = express.Router();
const materialService = require('../services/materialService');
const legalService = require('../services/legalService');
const { getTrailsByMaterialId } = require('../utils/auditTrail');
const { requireRole } = require('../middleware/auth');

router.get('/', (req, res) => {
  try {
    const result = materialService.getMaterialList(req.query);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/theme/:themeId', (req, res) => {
  try {
    const result = materialService.getMaterialsByTheme(req.params.themeId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/evidence-versions/compare', (req, res) => {
  try {
    const { a, b } = req.query;
    if (!a || !b) {
      return res.status(400).json({ error: '请提供比对的两个证据版本ID（参数 a、b）' });
    }
    const result = materialService.compareEvidenceVersions(a, b);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/evidence-versions/theme/:themeId', (req, res) => {
  try {
    const result = materialService.getEvidenceVersionsByTheme(req.params.themeId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const result = materialService.getMaterialDetail(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '素材不存在' });
    }
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id/trails', (req, res) => {
  try {
    const result = getTrailsByMaterialId(req.params.id);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id/evidence-versions', (req, res) => {
  try {
    const result = materialService.getEvidenceVersions(req.params.id);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id/rejection-reasons', (req, res) => {
  try {
    const result = legalService.getAllRejectionReasons(req.params.id);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/', requireRole(['MARKETING']), (req, res) => {
  try {
    const result = materialService.createMaterial(req.body, req.operator);
    res.status(201).json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', requireRole(['MARKETING']), (req, res) => {
  try {
    const result = materialService.updateMaterial(req.params.id, req.body, req.operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/submit', requireRole(['MARKETING']), (req, res) => {
  try {
    const result = materialService.submitForReview(req.params.id, req.operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/new-version', requireRole(['MARKETING']), (req, res) => {
  try {
    const result = materialService.createNewVersion(req.params.id, req.operator);
    res.status(201).json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:id/channel-revision', requireRole(['MARKETING']), (req, res) => {
  try {
    const { revision_reason } = req.body || {};
    const result = materialService.createChannelRevision(
      req.params.id, revision_reason, req.operator
    );
    res.status(201).json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
