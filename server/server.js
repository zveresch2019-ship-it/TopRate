const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());

// Request logging (before parsing)
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url} from ${req.ip}`);
  console.log(`📥 Headers:`, {
    'authorization': req.header('Authorization') ? 'Bearer ***' : 'none',
    'content-type': req.header('Content-Type'),
    'user-agent': req.header('User-Agent')?.substring(0, 50)
  });
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (after parsing body)
app.use((req, res, next) => {
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📥 Request body (parsed):`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/seasons', require('./routes/seasons'));
app.use('/api/groups', require('./routes/groups'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Serve privacy policy
app.get('/privacy', (req, res) => {
  const privacyPath = path.join(__dirname, '..', 'docs', 'privacy.html');
  res.sendFile(privacyPath);
});

// Serve privacy policy with .html extension
app.get('/privacy.html', (req, res) => {
  const privacyPath = path.join(__dirname, '..', 'docs', 'privacy.html');
  res.sendFile(privacyPath);
});

// Error handling middleware (должен быть последним middleware)
app.use((err, req, res, next) => {
  console.error('❌ Global error handler called');
  console.error('❌ Error:', err);
  console.error('❌ Error name:', err?.name);
  console.error('❌ Error message:', err?.message);
  console.error('❌ Error stack:', err?.stack);
  console.error('❌ Request URL:', req.method, req.url);
  console.error('❌ Request body:', req.body);
  console.error('❌ Request userId:', req.userId);
  
  // Если ответ уже отправлен, не отправляем снова
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({ 
    error: 'Server error adding player',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Database connection
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔍 Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI set:', Boolean(process.env.MONGODB_URI));
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All env vars:', Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('JWT') || k.includes('NODE') || k.includes('PORT')));

// Проверка обязательных переменных окружения
if (!MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI is not set!');
  console.error('Please set MONGODB_URI environment variable in Railway Settings');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Ensure indexes are created
    console.log('🔧 Creating/updating indexes...');
    const Season = require('./models/Season');
    const Player = require('./models/Player');
    const Match = require('./models/Match');
    
    await Season.syncIndexes();
    await Player.syncIndexes();
    await Match.syncIndexes();
    console.log('✅ Indexes synchronized');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📱 Mobile devices can connect at: http://10.0.0.93:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});


