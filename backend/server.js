require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initDatabase } = require('./src/db/init');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initDatabase();

const app = express();
const PORT = process.env.API_PORT || 19502;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const { extractOperator } = require('./src/middleware/auth');
app.use('/api', extractOperator);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: '药品广告合规审查系统',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/materials', require('./src/routes/materials'));
app.use('/api/medical', require('./src/routes/medical'));
app.use('/api/legal', require('./src/routes/legal'));
app.use('/api/validation', require('./src/routes/validation'));

app.use((req, res) => {
  res.status(404).json({ error: 'API接口不存在' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 药品广告合规审查系统后端服务已启动`);
  console.log(`📡 服务地址: http://0.0.0.0:${PORT}`);
  console.log(`💾 数据库: ${path.join(__dirname, 'data/drug_ad_review.db')}`);
});

module.exports = app;
