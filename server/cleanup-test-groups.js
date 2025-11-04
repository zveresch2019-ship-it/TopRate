const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Group = require('./models/Group');
const Player = require('./models/Player');
const Season = require('./models/Season');
const Match = require('./models/Match');

async function cleanupTestGroups() {
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

    // 1. Находим группу "zapfoot"
    console.log('📋 Поиск группы "zapfoot"...');
    const zapfootGroup = await Group.findOne({ name: 'zapfoot' });
    
    if (!zapfootGroup) {
      console.error('❌ Группа "zapfoot" не найдена!');
      process.exit(1);
    }
    
    const zapfootGroupId = zapfootGroup._id.toString();
    console.log(`✅ Группа "zapfoot" найдена: ${zapfootGroupId}\n`);

    // 2. Находим все группы, кроме "zapfoot"
    console.log('📋 Поиск всех групп, кроме "zapfoot"...');
    const testGroups = await Group.find({ name: { $ne: 'zapfoot' } });
    console.log(`📊 Найдено тестовых групп: ${testGroups.length}\n`);

    if (testGroups.length === 0) {
      console.log('✅ Тестовые группы не найдены. База данных уже чистая.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // 3. Собираем ID всех тестовых групп
    const testGroupIds = testGroups.map(g => g._id.toString());
    console.log('📋 Тестовые группы для удаления:');
    testGroups.forEach(g => {
      console.log(`   - ${g.name} (${g._id})`);
    });
    console.log('');

    // 4. Удаляем пользователей из тестовых групп
    console.log('🗑️  Удаление пользователей из тестовых групп...');
    const usersResult = await User.deleteMany({ 
      groupId: { $in: testGroupIds } 
    });
    console.log(`✅ Удалено пользователей: ${usersResult.deletedCount}`);

    // 5. Удаляем игроков из тестовых групп
    console.log('🗑️  Удаление игроков из тестовых групп...');
    const playersResult = await Player.deleteMany({ 
      groupId: { $in: testGroupIds } 
    });
    console.log(`✅ Удалено игроков: ${playersResult.deletedCount}`);

    // 6. Удаляем сезоны из тестовых групп
    console.log('🗑️  Удаление сезонов из тестовых групп...');
    const seasonsResult = await Season.deleteMany({ 
      groupId: { $in: testGroupIds } 
    });
    console.log(`✅ Удалено сезонов: ${seasonsResult.deletedCount}`);

    // 7. Удаляем матчи из тестовых групп
    console.log('🗑️  Удаление матчей из тестовых групп...');
    const matchesResult = await Match.deleteMany({ 
      groupId: { $in: testGroupIds } 
    });
    console.log(`✅ Удалено матчей: ${matchesResult.deletedCount}`);

    // 8. Удаляем сами группы
    console.log('🗑️  Удаление тестовых групп...');
    const groupsResult = await Group.deleteMany({ 
      name: { $ne: 'zapfoot' } 
    });
    console.log(`✅ Удалено групп: ${groupsResult.deletedCount}\n`);

    // 9. Проверяем результат
    console.log('📊 Проверка результата...');
    const remainingGroups = await Group.find({});
    console.log(`✅ Оставшихся групп: ${remainingGroups.length}`);
    remainingGroups.forEach(g => {
      console.log(`   - ${g.name} (${g._id})`);
    });

    const zapfootUsers = await User.countDocuments({ groupId: zapfootGroupId });
    const zapfootPlayers = await Player.countDocuments({ groupId: zapfootGroupId });
    const zapfootSeasons = await Season.countDocuments({ groupId: zapfootGroupId });
    const zapfootMatches = await Match.countDocuments({ groupId: zapfootGroupId });

    console.log(`\n📊 Данные группы "zapfoot":`);
    console.log(`   - Пользователей: ${zapfootUsers}`);
    console.log(`   - Игроков: ${zapfootPlayers}`);
    console.log(`   - Сезонов: ${zapfootSeasons}`);
    console.log(`   - Матчей: ${zapfootMatches}\n`);

    console.log('✅ Очистка завершена успешно!');
    console.log('✅ Группа "zapfoot" и все её данные сохранены.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

cleanupTestGroups();

