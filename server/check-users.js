const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('./models/User');
    const users = await User.find({});
    
    console.log('Users in database:');
    users.forEach(user => {
      console.log(`- Username: ${user.username}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  GroupId: ${user.groupId}`);
      console.log(`  GroupName: ${user.groupName}`);
      console.log('---');
    });

    console.log(`Total users: ${users.length}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

checkUsers();
