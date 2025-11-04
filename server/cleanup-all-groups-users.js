const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Group = require('./models/Group');
const Player = require('./models/Player');
const Season = require('./models/Season');
const Match = require('./models/Match');

async function cleanupAllGroupsAndUsers() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI не задан. Укажите строку подключения в server/.env');
      process.exit(1);
    }

    console.log('🔌 Подключение к MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Подключено к MongoDB\n');

    // Подсчитываем данные ДО удаления
    console.log('📊 Текущее состояние базы данных:');
    const groupsCount = await Group.countDocuments({});
    const usersCount = await User.countDocuments({});
    const playersCount = await Player.countDocuments({});
    const seasonsCount = await Season.countDocuments({});
    const matchesCount = await Match.countDocuments({});
    
    console.log(`   - Групп: ${groupsCount}`);
    console.log(`   - Пользователей: ${usersCount}`);
    console.log(`   - Игроков: ${playersCount}`);
    console.log(`   - Сезонов: ${seasonsCount}`);
    console.log(`   - Матчей: ${matchesCount}\n`);

    if (groupsCount === 0 && usersCount === 0) {
      console.log('✅ База данных уже пустая. Нет данных для удаления.');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log('🗑️  Начинаем удаление всех данных...\n');

    // 1. Удаляем всех пользователей
    console.log('🗑️  Удаление всех пользователей...');
    const usersResult = await User.deleteMany({});
    console.log(`✅ Удалено пользователей: ${usersResult.deletedCount}`);

    // 2. Удаляем всех игроков
    console.log('🗑️  Удаление всех игроков...');
    const playersResult = await Player.deleteMany({});
    console.log(`✅ Удалено игроков: ${playersResult.deletedCount}`);

    // 3. Удаляем все сезоны
    console.log('🗑️  Удаление всех сезонов...');
    const seasonsResult = await Season.deleteMany({});
    console.log(`✅ Удалено сезонов: ${seasonsResult.deletedCount}`);

    // 4. Удаляем все матчи
    console.log('🗑️  Удаление всех матчей...');
    const matchesResult = await Match.deleteMany({});
    console.log(`✅ Удалено матчей: ${matchesResult.deletedCount}`);

    // 5. Удаляем все группы
    console.log('🗑️  Удаление всех групп...');
    const groupsResult = await Group.deleteMany({});
    console.log(`✅ Удалено групп: ${groupsResult.deletedCount}\n`);

    // 6. Проверяем результат
    console.log('📊 Проверка результата...');
    const remainingGroups = await Group.countDocuments({});
    const remainingUsers = await User.countDocuments({});
    const remainingPlayers = await Player.countDocuments({});
    const remainingSeasons = await Season.countDocuments({});
    const remainingMatches = await Match.countDocuments({});

    console.log(`✅ Оставшихся данных:`);
    console.log(`   - Групп: ${remainingGroups}`);
    console.log(`   - Пользователей: ${remainingUsers}`);
    console.log(`   - Игроков: ${remainingPlayers}`);
    console.log(`   - Сезонов: ${remainingSeasons}`);
    console.log(`   - Матчей: ${remainingMatches}\n`);

    if (remainingGroups === 0 && remainingUsers === 0 && remainingPlayers === 0 && remainingSeasons === 0 && remainingMatches === 0) {
      console.log('✅ База данных полностью очищена!');
    } else {
      console.log('⚠️  В базе данных остались некоторые данные.');
    }

    console.log('\n✅ Очистка завершена!\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

cleanupAllGroupsAndUsers();

