const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Player = require('./models/Player');
const Season = require('./models/Season');

async function createSharedUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/football-rating', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Проверяем, существует ли уже shared пользователь
    let sharedUser = await User.findOne({ username: 'shared' });
    
    if (sharedUser) {
      console.log('✅ Shared user already exists');
      console.log(`   ID: ${sharedUser._id}`);
      console.log(`   Role: ${sharedUser.role}`);
    } else {
      // Создаём системного пользователя для общих данных
      sharedUser = new User({
        username: 'shared',
        password: 'shared_password_' + Date.now(), // Случайный пароль, вход не нужен
        role: 'admin' // Админ по умолчанию
      });
      
      await sharedUser.save();
      console.log('✅ Created shared user');
      console.log(`   ID: ${sharedUser._id}`);
    }
    
    // Создаём начальные сезоны для shared пользователя
    const footballSeason = await Season.findOne({
      userId: sharedUser._id,
      seasonNumber: 1,
      sportType: 'football'
    });
    
    if (!footballSeason) {
      const newFootballSeason = new Season({
        userId: sharedUser._id,
        groupId: sharedUser._id, // Используем ID пользователя как groupId для shared пользователя
        seasonNumber: 1,
        sportType: 'football',
        isActive: true
      });
      await newFootballSeason.save();
      console.log('✅ Created football season for shared user');
    }
    
    const basketballSeason = await Season.findOne({
      userId: sharedUser._id,
      seasonNumber: 1,
      sportType: 'basketball'
    });
    
    if (!basketballSeason) {
      const newBasketballSeason = new Season({
        userId: sharedUser._id,
        groupId: sharedUser._id, // Используем ID пользователя как groupId для shared пользователя
        seasonNumber: 1,
        sportType: 'basketball',
        isActive: true
      });
      await newBasketballSeason.save();
      console.log('✅ Created basketball season for shared user');
    }
    
    // Проверяем количество игроков
    const footballPlayersCount = await Player.countDocuments({
      userId: sharedUser._id,
      sportType: 'football'
    });
    
    const basketballPlayersCount = await Player.countDocuments({
      userId: sharedUser._id,
      sportType: 'basketball'
    });
    
    console.log(`\n📊 Shared user stats:`);
    console.log(`   Football players: ${footballPlayersCount}`);
    console.log(`   Basketball players: ${basketballPlayersCount}`);
    
    console.log('\n✅ Setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createSharedUser();

