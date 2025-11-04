const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function setAdminRole() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/football-rating', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Получаем имя пользователя из аргументов командной строки
    const username = process.argv[2];
    
    if (!username) {
      console.log('❌ Please provide username as argument');
      console.log('Usage: node set-admin-role.js <username>');
      process.exit(1);
    }
    
    // Находим пользователя и устанавливаем роль админа
    const user = await User.findOneAndUpdate(
      { username: username.toLowerCase() },
      { role: 'admin' },
      { new: true }
    );
    
    if (!user) {
      console.log(`❌ User "${username}" not found`);
      process.exit(1);
    }
    
    console.log(`✅ User "${username}" is now admin`);
    console.log(`   Role: ${user.role}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setAdminRole();

