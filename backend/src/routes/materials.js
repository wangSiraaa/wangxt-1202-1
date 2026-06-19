const express = require('express');
const router = express.Router();
const materialService = require('../services/materialService');
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

module.exports = router;
