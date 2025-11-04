const mongoose = require('mongoose');
require('dotenv').config();

async function cleanDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Получаем все коллекции
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Found collections:', collections.map(c => c.name));

    // Удаляем все коллекции, связанные с нашим приложением
    const collectionsToDelete = ['seasons', 'players', 'matches', 'users', 'groups'];
    
    for (const collectionName of collectionsToDelete) {
      try {
        await mongoose.connection.db.dropCollection(collectionName);
        console.log(`✅ Dropped collection: ${collectionName}`);
      } catch (error) {
        if (error.codeName === 'NamespaceNotFound') {
          console.log(`ℹ️  Collection ${collectionName} does not exist`);
        } else {
          console.log(`❌ Error dropping ${collectionName}:`, error.message);
        }
      }
    }

    console.log('✅ DATABASE COMPLETELY CLEANED!');
    console.log('Now restart the server and try to login again.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

cleanDatabase();
