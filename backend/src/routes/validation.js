const express = require('express');
const router = express.Router();

const {
  checkOffLabelContent,
  checkApprovalNumber,
  checkMedicalEvidence,
  checkRiskWarning,
  checkEvidenceSource,
  isValidChannel,
  checkChannelDuplicate,
  CHANNEL_TYPES,
  CHANNEL_NAME_MAP
} = require('../utils/validation');

router.post('/offlabel', (req, res) => {
  try {
    const { content, indication } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content参数不能为空' });
    }
    const result = checkOffLabelContent(content, indication);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/approval-number', (req, res) => {
  try {
    const { approvalNumber } = req.body;
    if (!approvalNumber) {
      return res.status(400).json({ error: 'approvalNumber参数不能为空' });
    }
    const result = checkApprovalNumber(approvalNumber);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/medical-evidence', (req, res) => {
  try {
    const { evidence } = req.body;
    const result = checkMedicalEvidence(evidence);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/risk-warning', (req, res) => {
  try {
    const { content, riskWarning } = req.body;
    if (!content || !riskWarning) {
      return res.status(400).json({ error: 'content和riskWarning参数不能为空' });
    }
    const result = checkRiskWarning(content, riskWarning);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/channels', (req, res) => {
  res.json({
    success: true,
    data: CHANNEL_TYPES.map(c => ({ code: c, name: CHANNEL_NAME_MAP[c] }))
  });
});

router.post('/channel', (req, res) => {
  try {
    const { channel, theme_id } = req.body || {};
    if (!channel) {
      return res.status(400).json({ error: 'channel参数不能为空' });
    }
    const valid = isValidChannel(channel);
    const dup = valid && theme_id ? checkChannelDuplicate(theme_id, channel) : { isDuplicate: false };
    res.json({
      success: true,
      isValid: valid,
      channel_name: CHANNEL_NAME_MAP[channel] || channel,
      is_duplicate: dup.isDuplicate,
      duplicate_reason: dup.reason || null,
      supported: CHANNEL_TYPES
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/evidence-source', (req, res) => {
  try {
    const { evidenceSource } = req.body || {};
    const result = checkEvidenceSource(evidenceSource);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/offlabel', (req, res) => {
  try {
    const { content, indication } = req.query;
    if (!content) {
      return res.status(400).json({ error: 'content参数不能为空' });
    }
    const result = checkOffLabelContent(content, indication);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
