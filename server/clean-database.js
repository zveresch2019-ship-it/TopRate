const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://zveresch2019_db_user:XP4g5hvaZllf1o77@veresch.8pu6fqv.mongodb.net/?retryWrites=true&w=majority&appName=Veresch';

async function cleanDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    console.log('=== DELETING ALL COLLECTIONS ===\n');
    
    // Delete all seasons
    await db.collection('seasons').deleteMany({});
    console.log('✅ Deleted all seasons');
    
    // Delete all players
    await db.collection('players').deleteMany({});
    console.log('✅ Deleted all players');
    
    // Delete all matches
    await db.collection('matches').deleteMany({});
    console.log('✅ Deleted all matches');
    
    console.log('\n=== DROPPING ALL INDEXES ===\n');
    
    // Drop all indexes except _id
    await db.collection('seasons').dropIndexes();
    console.log('✅ Dropped all season indexes');
    
    await db.collection('players').dropIndexes();
    console.log('✅ Dropped all player indexes');
    
    await db.collection('matches').dropIndexes();
    console.log('✅ Dropped all match indexes');
    
    console.log('\n✅ DATABASE CLEANED!');
    console.log('\nNow restart the server and try to login again.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanDatabase();



