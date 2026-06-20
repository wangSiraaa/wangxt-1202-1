const express = require('express');
const router = express.Router();
const legalService = require('../services/legalService');
const { requireRole } = require('../middleware/auth');

router.get('/pending', requireRole(['LEGAL']), (req, res) => {
  try {
    const result = legalService.getPendingLegalList(req.query);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:materialId/opinion', requireRole(['LEGAL']), (req, res) => {
  try {
    const result = legalService.submitLegalOpinion(
      req.params.materialId, 
      req.body, 
      req.operator
    );
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:materialId/opinions', (req, res) => {
  try {
    const result = legalService.getLegalOpinions(req.params.materialId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:materialId/rejection-reasons', (req, res) => {
  try {
    const result = legalService.getRejectionReasons(req.params.materialId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/published', (req, res) => {
  try {
    const result = legalService.getPublishedList(req.query);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/published/:id', (req, res) => {
  try {
    const result = legalService.getPublishedDetail(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '发布版本不存在' });
    }
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
