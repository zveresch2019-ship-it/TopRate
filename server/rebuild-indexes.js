const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://zveresch2019_db_user:XP4g5hvaZllf1o77@veresch.8pu6fqv.mongodb.net/?retryWrites=true&w=majority&appName=Veresch';

async function rebuildIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // ===== SEASONS =====
    console.log('=== REBUILDING SEASON INDEXES ===');
    const seasonsCollection = db.collection('seasons');
    
    console.log('Dropping ALL indexes (except _id)...');
    await seasonsCollection.dropIndexes();
    console.log('✅ All indexes dropped');
    
    console.log('Creating new indexes...');
    await seasonsCollection.createIndex({ userId: 1 });
    console.log('✅ Created: userId_1');
    
    await seasonsCollection.createIndex(
      { userId: 1, seasonNumber: 1, sportType: 1 }
    );
    console.log('✅ Created: userId_1_seasonNumber_1_sportType_1');
    
    // ===== PLAYERS =====
    console.log('\n=== REBUILDING PLAYER INDEXES ===');
    const playersCollection = db.collection('players');
    
    console.log('Dropping ALL indexes (except _id)...');
    await playersCollection.dropIndexes();
    console.log('✅ All indexes dropped');
    
    console.log('Creating new indexes...');
    await playersCollection.createIndex({ userId: 1 });
    console.log('✅ Created: userId_1');
    
    await playersCollection.createIndex(
      { userId: 1, currentSeason: 1, sportType: 1 }
    );
    console.log('✅ Created: userId_1_currentSeason_1_sportType_1');
    
    // ===== MATCHES =====
    console.log('\n=== REBUILDING MATCH INDEXES ===');
    const matchesCollection = db.collection('matches');
    
    console.log('Dropping ALL indexes (except _id)...');
    await matchesCollection.dropIndexes();
    console.log('✅ All indexes dropped');
    
    console.log('Creating new indexes...');
    await matchesCollection.createIndex({ userId: 1 });
    console.log('✅ Created: userId_1');
    
    await matchesCollection.createIndex(
      { userId: 1, season: 1, sportType: 1, matchDate: -1 }
    );
    console.log('✅ Created: userId_1_season_1_sportType_1_matchDate_-1');
    
    console.log('\n✅ ALL INDEXES REBUILT!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

rebuildIndexes();

