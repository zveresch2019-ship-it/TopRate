const mongoose = require('mongoose');
const Season = require('./models/Season');
const Player = require('./models/Player');
const Match = require('./models/Match');

const MONGODB_URI = 'mongodb+srv://zveresch2019_db_user:XP4g5hvaZllf1o77@veresch.8pu6fqv.mongodb.net/?retryWrites=true&w=majority&appName=Veresch';

async function fixOldData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ===== FIX SEASONS =====
    console.log('=== FIXING OLD SEASONS ===');
    
    // Найти все сезоны БЕЗ sportType
    const seasonsWithoutSport = await Season.find({ sportType: { $exists: false } });
    console.log(`Found ${seasonsWithoutSport.length} seasons without sportType`);
    
    // Обновить их на football (по умолчанию)
    for (const season of seasonsWithoutSport) {
      season.sportType = 'football';
      await season.save();
      console.log(`✅ Updated season ${season.seasonNumber} → football`);
    }

    // ===== FIX PLAYERS =====
    console.log('\n=== FIXING OLD PLAYERS ===');
    
    const playersWithoutSport = await Player.find({ sportType: { $exists: false } });
    console.log(`Found ${playersWithoutSport.length} players without sportType`);
    
    for (const player of playersWithoutSport) {
      player.sportType = 'football';
      if (!player.seasonStartRating) {
        player.seasonStartRating = player.rating || 1500;
      }
      await player.save();
      console.log(`✅ Updated ${player.name} → football (seasonStart: ${player.seasonStartRating})`);
    }

    // ===== FIX MATCHES =====
    console.log('\n=== FIXING OLD MATCHES ===');
    
    const matchesWithoutSport = await Match.find({ sportType: { $exists: false } });
    console.log(`Found ${matchesWithoutSport.length} matches without sportType`);
    
    for (const match of matchesWithoutSport) {
      match.sportType = 'football';
      await match.save();
    }
    console.log(`✅ Updated ${matchesWithoutSport.length} matches → football`);

    // ===== SUMMARY =====
    console.log('\n=== SUMMARY ===');
    console.log(`✅ Seasons fixed: ${seasonsWithoutSport.length}`);
    console.log(`✅ Players fixed: ${playersWithoutSport.length}`);
    console.log(`✅ Matches fixed: ${matchesWithoutSport.length}`);
    console.log('\n✅ ALL DONE! You can now start the server.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixOldData();

