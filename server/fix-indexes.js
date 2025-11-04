const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://zveresch2019_db_user:XP4g5hvaZllf1o77@veresch.8pu6fqv.mongodb.net/?retryWrites=true&w=majority&appName=Veresch';

async function fixIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // ===== FIX SEASONS INDEXES =====
    console.log('=== FIXING SEASON INDEXES ===');
    const seasonsCollection = db.collection('seasons');
    
    // Получить все индексы
    const indexes = await seasonsCollection.indexes();
    console.log('Current indexes:', indexes.map(idx => idx.name));
    
    // Удалить старый индекс userId_1_seasonNumber_1
    try {
      await seasonsCollection.dropIndex('userId_1_seasonNumber_1');
      console.log('✅ Dropped old index: userId_1_seasonNumber_1');
    } catch (error) {
      console.log('⚠️  Old index not found or already dropped:', error.message);
    }
    
    // Создать новый индекс с sportType
    await seasonsCollection.createIndex(
      { userId: 1, seasonNumber: 1, sportType: 1 }
    );
    console.log('✅ Created new index: userId_1_seasonNumber_1_sportType_1');
    
    // ===== FIX PLAYERS INDEXES =====
    console.log('\n=== FIXING PLAYER INDEXES ===');
    const playersCollection = db.collection('players');
    
    const playerIndexes = await playersCollection.indexes();
    console.log('Current indexes:', playerIndexes.map(idx => idx.name));
    
    // Удалить старый индекс userId_1_currentSeason_1
    try {
      await playersCollection.dropIndex('userId_1_currentSeason_1');
      console.log('✅ Dropped old index: userId_1_currentSeason_1');
    } catch (error) {
      console.log('⚠️  Old index not found or already dropped:', error.message);
    }
    
    // Создать новый индекс с sportType
    await playersCollection.createIndex(
      { userId: 1, currentSeason: 1, sportType: 1 }
    );
    console.log('✅ Created new index: userId_1_currentSeason_1_sportType_1');
    
    // ===== FIX MATCHES INDEXES =====
    console.log('\n=== FIXING MATCH INDEXES ===');
    const matchesCollection = db.collection('matches');
    
    const matchIndexes = await matchesCollection.indexes();
    console.log('Current indexes:', matchIndexes.map(idx => idx.name));
    
    // Удалить старый индекс userId_1_season_1_matchDate_-1
    try {
      await matchesCollection.dropIndex('userId_1_season_1_matchDate_-1');
      console.log('✅ Dropped old index: userId_1_season_1_matchDate_-1');
    } catch (error) {
      console.log('⚠️  Old index not found or already dropped:', error.message);
    }
    
    // Создать новый индекс с sportType
    await matchesCollection.createIndex(
      { userId: 1, season: 1, sportType: 1, matchDate: -1 }
    );
    console.log('✅ Created new index: userId_1_season_1_sportType_1_matchDate_-1');
    
    console.log('\n✅ ALL INDEXES FIXED!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixIndexes();

