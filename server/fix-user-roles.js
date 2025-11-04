const mongoose = require('mongoose');
require('dotenv').config();

async function fixUserRoles() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('./models/User');
    
    // Обновляем всех пользователей, у которых есть groupId, устанавливая им роль admin
    const result = await User.updateMany(
      { groupId: { $exists: true, $ne: null } },
      { $set: { role: 'admin' } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} users to admin role`);

    // Проверяем результат
    const users = await User.find({});
    console.log('Updated users:');
    users.forEach(user => {
      console.log(`- ${user.username}: ${user.role}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixUserRoles();
