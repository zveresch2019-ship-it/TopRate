const mongoose = require('mongoose');
const Player = require('./models/Player');
const Season = require('./models/Season');
const User = require('./models/User');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://zveresch2019_db_user:XP4g5hvaZllf1o77@veresch.8pu6fqv.mongodb.net/?retryWrites=true&w=majority&appName=Veresch';

// Football players
const footballPlayers = [
  'Gullitt', 'Stoichkov', 'Maldini', 'Ronaldo', 
  'Zidane', 'Beckham', 'Messi', 'Neymar', 
  'Veresch', 'Iniesta'
];

// Basketball players
const basketballPlayers = [
  'Jordan', 'LeBron', 'Curry', 'Durant',
  'Kobe', 'Magic', 'Bird', 'Shaq',
  'Iverson', 'Duncan'
];

async function seedPlayers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find any user (use first available)
    let user = await User.findOne({}).sort({ createdAt: -1 });
    
    if (!user) {
      console.log('❌ No users found in database!');
      console.log('\n⚠️  PLEASE:');
      console.log('1. Open the app on your phone');
      console.log('2. Register or login');
      console.log('3. Then run this script again\n');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.username} (${user._id})\n`);

    // ===== FOOTBALL PLAYERS =====
    console.log('=== CREATING FOOTBALL PLAYERS ===');
    
    // Get or create football season
    let footballSeason = await Season.findOne({
      userId: user._id,
      sportType: 'football',
      isActive: true
    });

    if (!footballSeason) {
      footballSeason = new Season({
        userId: user._id,
        seasonNumber: 1,
        sportType: 'football',
        isActive: true
      });
      await footballSeason.save();
      console.log('✅ Created football season 1');
    }

    // Delete existing football players
    await Player.deleteMany({
      userId: user._id,
      sportType: 'football',
      currentSeason: footballSeason.seasonNumber
    });

    // Create football players
    for (const name of footballPlayers) {
      const player = new Player({
        userId: user._id,
        name: name,
        rating: 1500,
        seasonStartRating: 1500,
        currentSeason: footballSeason.seasonNumber,
        sportType: 'football',
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        ratingChange: 0,
        isActive: true
      });
      await player.save();
      console.log(`✅ Created football player: ${name} (1500)`);
    }

    // Update season player count
    footballSeason.totalPlayers = footballPlayers.length;
    await footballSeason.save();

    console.log(`\n✅ Total football players: ${footballPlayers.length}\n`);

    // ===== BASKETBALL PLAYERS =====
    console.log('=== CREATING BASKETBALL PLAYERS ===');
    
    // Get or create basketball season
    let basketballSeason = await Season.findOne({
      userId: user._id,
      sportType: 'basketball',
      isActive: true
    });

    if (!basketballSeason) {
      basketballSeason = new Season({
        userId: user._id,
        seasonNumber: 1,
        sportType: 'basketball',
        isActive: true
      });
      await basketballSeason.save();
      console.log('✅ Created basketball season 1');
    }

    // Delete existing basketball players
    await Player.deleteMany({
      userId: user._id,
      sportType: 'basketball',
      currentSeason: basketballSeason.seasonNumber
    });

    // Create basketball players
    for (const name of basketballPlayers) {
      const player = new Player({
        userId: user._id,
        name: name,
        rating: 1500,
        seasonStartRating: 1500,
        currentSeason: basketballSeason.seasonNumber,
        sportType: 'basketball',
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        ratingChange: 0,
        isActive: true
      });
      await player.save();
      console.log(`✅ Created basketball player: ${name} (1500)`);
    }

    // Update season player count
    basketballSeason.totalPlayers = basketballPlayers.length;
    await basketballSeason.save();

    console.log(`\n✅ Total basketball players: ${basketballPlayers.length}\n`);

    console.log('=== SUMMARY ===');
    console.log(`⚽ Football: ${footballPlayers.length} players (Season ${footballSeason.seasonNumber})`);
    console.log(`🏀 Basketball: ${basketballPlayers.length} players (Season ${basketballSeason.seasonNumber})`);
    console.log('\n✅ ALL DONE!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seedPlayers();

