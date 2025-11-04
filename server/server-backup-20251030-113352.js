require('dotenv').config({ path: './.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());

// Request logging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url} from ${req.ip}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Database connection
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://veresch:veresch123@cluster0.mongodb.net/footballrating?retryWrites=true&w=majority';

console.log('🔍 Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('Using MONGODB_URI:', MONGODB_URI);

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


