const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Group = require('./models/Group');
const Player = require('./models/Player');
const Season = require('./models/Season');
const Match = require('./models/Match');

async function migrateToGroups() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/football-rating', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    // 1. Создаем группы для всех админов
    console.log('📝 Creating groups for admins...');
    const admins = await User.find({ role: 'admin' });
    
    for (const admin of admins) {
      if (!admin.groupId) {
        // Создаем группу для админа
        const group = new Group({
          name: `${admin.username}_group`,
          description: `Group created by ${admin.username}`,
          adminId: admin._id,
          adminUsername: admin.username
        });
        
        await group.save();
        
        // Обновляем админа
        admin.groupId = group._id;
        admin.groupName = group.name;
        await admin.save();
        
        console.log(`✅ Created group for admin: ${admin.username}`);
      }
    }
    
    // 2. Обновляем модели данных
    console.log('📝 Updating data models...');
    
    // Обновляем Player модель
    const players = await Player.find({});
    for (const player of players) {
      if (!player.groupId && player.userId) {
        const user = await User.findById(player.userId);
        if (user && user.groupId) {
          player.groupId = user.groupId;
          await player.save();
        }
      }
    }
    
    // Обновляем Season модель
    const seasons = await Season.find({});
    for (const season of seasons) {
      if (!season.groupId && season.userId) {
        const user = await User.findById(season.userId);
        if (user && user.groupId) {
          season.groupId = user.groupId;
          await season.save();
        }
      }
    }
    
    // Обновляем Match модель
    const matches = await Match.find({});
    for (const match of matches) {
      if (!match.groupId && match.userId) {
        const user = await User.findById(match.userId);
        if (user && user.groupId) {
          match.groupId = user.groupId;
          await match.save();
        }
      }
    }
    
    console.log('✅ Data models updated');
    
    // 3. Пересоздаем индексы
    console.log('🔧 Recreating indexes...');
    
    // Удаляем старые индексы
    try {
      await Player.collection.dropIndexes();
      await Season.collection.dropIndexes();
      await Match.collection.dropIndexes();
      console.log('✅ Old indexes dropped');
    } catch (error) {
      console.log('ℹ️ No old indexes to drop');
    }
    
    // Создаем новые индексы
    await Player.syncIndexes();
    await Season.syncIndexes();
    await Match.syncIndexes();
    await Group.syncIndexes();
    console.log('✅ New indexes created');
    
    // 4. Статистика
    const groupCount = await Group.countDocuments();
    const playerCount = await Player.countDocuments();
    const seasonCount = await Season.countDocuments();
    const matchCount = await Match.countDocuments();
    
    console.log('\n📊 Migration completed!');
    console.log(`   Groups: ${groupCount}`);
    console.log(`   Players: ${playerCount}`);
    console.log(`   Seasons: ${seasonCount}`);
    console.log(`   Matches: ${matchCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

migrateToGroups();
