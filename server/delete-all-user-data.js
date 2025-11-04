const mongoose = require('mongoose');
const Season = require('./models/Season');
const Player = require('./models/Player');
const Match = require('./models/Match');

const MONGODB_URI = 'mongodb+srv://zveresch2019_db_user:XP4g5hvaZllf1o77@veresch.8pu6fqv.mongodb.net/?retryWrites=true&w=majority&appName=Veresch';
const USER_ID = '68efc87bc33bc96f0804da7f';

async function deleteAllUserData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('=== DELETING ALL DATA FOR USER', USER_ID, '===\n');
    
    // Delete all seasons
    const seasonsResult = await Season.deleteMany({ userId: USER_ID });
    console.log(`✅ Deleted ${seasonsResult.deletedCount} seasons`);
    
    // Delete all players
    const playersResult = await Player.deleteMany({ userId: USER_ID });
    console.log(`✅ Deleted ${playersResult.deletedCount} players`);
    
    // Delete all matches
    const matchesResult = await Match.deleteMany({ userId: USER_ID });
    console.log(`✅ Deleted ${matchesResult.deletedCount} matches`);
    
    console.log('\n✅ ALL USER DATA DELETED!');
    console.log('\nNow you can start fresh - login to the app and it will create a new Season 1.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteAllUserData();



