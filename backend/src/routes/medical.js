const express = require('express');
const router = express.Router();
const medicalService = require('../services/medicalService');
const { requireRole } = require('../middleware/auth');

router.get('/pending', requireRole(['MEDICAL']), (req, res) => {
  try {
    const result = medicalService.getPendingMedicalList(req.query);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/:materialId/opinion', requireRole(['MEDICAL']), (req, res) => {
  try {
    const result = medicalService.submitMedicalOpinion(
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
    const result = medicalService.getMedicalOpinions(req.params.materialId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
