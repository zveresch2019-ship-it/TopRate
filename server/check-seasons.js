const mongoose = require('mongoose');
const Season = require('./models/Season');

const MONGODB_URI = 'mongodb+srv://zveresch2019_db_user:XP4g5hvaZllf1o77@veresch.8pu6fqv.mongodb.net/?retryWrites=true&w=majority&appName=Veresch';
const USER_ID = '68efc87bc33bc96f0804da7f';

async function checkSeasons() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('=== SEASONS FOR USER', USER_ID, '===\n');
    
    const seasons = await Season.find({ userId: USER_ID }).sort({ seasonNumber: 1 });
    
    console.log(`Found ${seasons.length} seasons:\n`);
    
    seasons.forEach((season, idx) => {
      console.log(`${idx + 1}. Season ${season.seasonNumber}:`);
      console.log(`   _id: ${season._id}`);
      console.log(`   sportType: ${season.sportType || 'MISSING!'}`);
      console.log(`   isActive: ${season.isActive}`);
      console.log(`   startDate: ${season.startDate}`);
      console.log(`   endDate: ${season.endDate || 'N/A'}`);
      console.log('');
    });
    
    // Найти дубликаты Season 1
    const season1List = seasons.filter(s => s.seasonNumber === 1);
    if (season1List.length > 1) {
      console.log(`⚠️  WARNING: Found ${season1List.length} seasons with seasonNumber=1!`);
      console.log('This is causing the duplicate key error.\n');
      console.log('Deleting all Season 1 except the newest one...\n');
      
      // Сортируем по дате создания, оставляем самый новый
      season1List.sort((a, b) => b.startDate - a.startDate);
      const toKeep = season1List[0];
      const toDelete = season1List.slice(1);
      
      console.log(`Keeping: ${toKeep._id} (${toKeep.startDate})`);
      
      for (const season of toDelete) {
        console.log(`Deleting: ${season._id} (${season.startDate})`);
        await Season.deleteOne({ _id: season._id });
        console.log('✅ Deleted');
      }
      
      console.log('\n✅ Duplicates removed!');
    } else if (season1List.length === 1) {
      console.log('✅ Only one Season 1 found - good!');
    } else {
      console.log('⚠️  No Season 1 found!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkSeasons();

