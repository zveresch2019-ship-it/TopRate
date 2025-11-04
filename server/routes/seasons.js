const express = require('express');
const router = express.Router();
const Season = require('../models/Season');
const Player = require('../models/Player');
const auth = require('../middleware/auth');
const { getSharedUserId, isAdmin } = require('../utils/shared');

// Get all seasons for current user and sportType
router.get('/', auth, async (req, res) => {
  try {
    const { sportType } = req.query;
    const currentSportType = sportType || 'football';
    
    // Получаем groupId пользователя
    const { getGroupId } = require('../utils/shared');
    let groupId;
    try {
      groupId = await getGroupId(req.userId);
    } catch (error) {
      // Если пользователь не в группе, возвращаем пустой список
      console.log('⚠️ User has no group, returning empty seasons list');
      return res.json({ seasons: [], sportType: currentSportType });
    }
    
    // Ищем сезоны по groupId
    const seasons = await Season.find({ 
      groupId: groupId,
      sportType: currentSportType
    })
    .sort({ seasonNumber: -1 });

    res.json({ seasons, sportType: currentSportType });
  } catch (error) {
    console.error('Get seasons error:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Server error fetching seasons' });
  }
});

// Get current active season for sportType
router.get('/current', auth, async (req, res) => {
  try {
    const { sportType } = req.query;
    const currentSportType = sportType || 'football';
    
    // Получаем groupId пользователя
    const { getGroupId } = require('../utils/shared');
    let groupId;
    try {
      groupId = await getGroupId(req.userId);
    } catch (error) {
      // Если пользователь не в группе, возвращаем 404
      return res.status(404).json({ error: 'User has no group' });
    }
    
    let season = await Season.findOne({ 
      groupId: groupId,
      sportType: currentSportType,
      isActive: true 
    });

    // Create first season if none exists (only for group admins)
    if (!season) {
      const { isGroupAdmin } = require('../utils/shared');
      const isAdmin = await isGroupAdmin(req.userId);
      if (isAdmin) {
        season = new Season({
          groupId: groupId,
          userId: req.userId,
          seasonNumber: 1,
          sportType: currentSportType,
          isActive: true
        });
        await season.save();
      } else {
        return res.status(404).json({ error: 'No active season found' });
      }
    }

    res.json({ season, sportType: currentSportType });
  } catch (error) {
    console.error('Get current season error:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Server error fetching current season' });
  }
});

// Get specific season by number
router.get('/:seasonNumber', auth, async (req, res) => {
  try {
    const season = await Season.findOne({
      userId: req.userId,
      seasonNumber: parseInt(req.params.seasonNumber)
    });

    if (!season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    res.json({ season });
  } catch (error) {
    console.error('Get season error:', error);
    res.status(500).json({ error: 'Server error fetching season' });
  }
});

// Start new season for sportType
router.post('/new', auth, async (req, res) => {
  try {
    const { sportType } = req.body;
    const currentSportType = sportType || 'football';
    
    // Получаем groupId пользователя
    const { getGroupId } = require('../utils/shared');
    let groupId;
    try {
      groupId = await getGroupId(req.userId);
    } catch (error) {
      // Пользователь не имеет группы - возвращаем ошибку
      console.error('>>> User has no group:', error.message);
      return res.status(400).json({ error: 'User has no group. Please join a group first.' });
    }
    
    if (!groupId) {
      return res.status(400).json({ error: 'User has no group. Please join a group first.' });
    }
    
    // Get current active season for this sport (для группы, а не пользователя)
    const currentSeason = await Season.findOne({ 
      groupId: groupId,
      sportType: currentSportType,
      isActive: true 
    });

    if (!currentSeason) {
      console.log('>>> No active season found for', currentSportType, ', creating first season');
      console.log('>>> groupId:', groupId);
      
      try {
        // Проверяем, не создан ли уже сезон другим запросом (race condition protection)
        const existingSeason = await Season.findOne({ 
          groupId: groupId,
          seasonNumber: 1,
          sportType: currentSportType
        });
        
        if (existingSeason) {
          console.log('>>> Season already exists (created by another request), returning existing season');
          if (!existingSeason.isActive) {
            // Активируем сезон, если он был создан но не активен
            existingSeason.isActive = true;
            await existingSeason.save();
          }
          return res.status(200).json({ 
            message: 'Season already exists',
            season: existingSeason,
            playersCarriedOver: 0,
            sportType: currentSportType
          });
        }
        
        // Создаём первый сезон если активного нет
        const firstSeason = new Season({
          userId: req.userId,
          groupId: groupId, // ✅ Добавляем обязательное поле groupId
          seasonNumber: 1,
          sportType: currentSportType,
          isActive: true
        });
        
        console.log('>>> Saving first season:', firstSeason);
        await firstSeason.save();
        console.log('>>> First season saved successfully!', firstSeason._id);
        
        return res.status(201).json({ 
          message: 'First season created',
          season: firstSeason,
          playersCarriedOver: 0,
          sportType: currentSportType
        });
      } catch (saveError) {
        // Проверяем, не создан ли сезон другим запросом (дубликат из-за race condition)
        if (saveError.code === 11000 || saveError.name === 'MongoServerError') {
          // Ошибка дубликата - сезон уже создан
          console.log('>>> Season already exists (duplicate key error), fetching existing season');
          const existingSeason = await Season.findOne({ 
            groupId: groupId,
            seasonNumber: 1,
            sportType: currentSportType
          });
          if (existingSeason) {
            if (!existingSeason.isActive) {
              existingSeason.isActive = true;
              await existingSeason.save();
            }
            return res.status(200).json({ 
              message: 'Season already exists',
              season: existingSeason,
              playersCarriedOver: 0,
              sportType: currentSportType
            });
          }
        }
        
        console.error('>>> ERROR saving first season:', saveError);
        console.error('>>> Error details:', saveError.message);
        console.error('>>> Error code:', saveError.code);
        console.error('>>> Error stack:', saveError.stack);
        throw saveError;
      }
    }

    // Close current season
    currentSeason.isActive = false;
    currentSeason.endDate = new Date();
    await currentSeason.save();

    console.log(`\n>>> Closing season ${currentSeason.seasonNumber}, starting season ${currentSeason.seasonNumber + 1}`);
    
    // Get all active players from current season for this sport (для группы)
    const currentPlayers = await Player.find({
      groupId: groupId, // ✅ Используем groupId вместо userId
      currentSeason: currentSeason.seasonNumber,
      sportType: currentSportType,
      isActive: true
    }).sort({ name: 1 }); // ✅ Сортируем по имени для стабильности
    
    console.log(`>>> Found ${currentPlayers.length} players in season ${currentSeason.seasonNumber} for ${currentSportType}`);

    // Create new season
    const newSeasonNumber = currentSeason.seasonNumber + 1;
    const newSeason = new Season({
      userId: req.userId,
      groupId: groupId, // ✅ Добавляем обязательное поле groupId
      seasonNumber: newSeasonNumber,
      sportType: currentSportType, // ✅ Сохраняем тип спорта
      isActive: true,
      totalPlayers: currentPlayers.length
    });
    await newSeason.save();

    // Create copies of players for new season with SAVED ratings
    const newPlayers = [];
    console.log('\n=== COPYING PLAYERS TO NEW SEASON ===');
    
    for (const player of currentPlayers) {
      // Получаем текущий рейтинг (может быть undefined если база старая)
      const currentRating = player.rating || 1500;
      
      console.log(`Player: ${player.name}`);
      console.log(`  Old ID: ${player._id}`);
      console.log(`  Old Season: ${player.currentSeason}`);
      console.log(`  Old Rating: ${player.rating}`);
      console.log(`  → New Rating: ${currentRating}`);
      console.log(`  → New seasonStartRating: ${currentRating}`);
      
      const newPlayer = new Player({
        userId: req.userId,
        groupId: groupId, // ✅ Добавляем обязательное поле groupId
        name: player.name,
        rating: currentRating, // ✅ Сохраняем рейтинг из предыдущего сезона
        seasonStartRating: currentRating, // ✅ Запоминаем стартовый рейтинг сезона
        currentSeason: newSeasonNumber,
        sportType: currentSportType, // ✅ Сохраняем тип спорта
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        ratingChange: 0,
        isActive: true
      });
      newPlayers.push(newPlayer);
    }
    
    console.log('=== END COPYING ===\n');

    if (newPlayers.length > 0) {
      await Player.insertMany(newPlayers);
    }

    res.status(201).json({ 
      message: 'New season started successfully',
      season: newSeason,
      playersCarriedOver: newPlayers.length,
      sportType: currentSportType
    });
  } catch (error) {
    console.error('>>> Start new season ERROR:', error);
    console.error('>>> Error message:', error.message);
    console.error('>>> Error stack:', error.stack);
    res.status(500).json({ error: 'Server error starting new season' });
  }
});

// Get season statistics
router.get('/:seasonNumber/stats', auth, async (req, res) => {
  try {
    const seasonNumber = parseInt(req.params.seasonNumber);
    
    const season = await Season.findOne({
      userId: req.userId,
      seasonNumber
    });

    if (!season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    // Get top players for this season
    const topPlayers = await Player.find({
      userId: req.userId,
      currentSeason: seasonNumber,
      isActive: true
    })
    .sort({ rating: -1 })
    .limit(10)
    .select('name rating gamesPlayed wins losses');

    res.json({
      season: {
        number: season.seasonNumber,
        isActive: season.isActive,
        startDate: season.startDate,
        endDate: season.endDate,
        totalMatches: season.totalMatches,
        totalPlayers: season.totalPlayers
      },
      topPlayers
    });
  } catch (error) {
    console.error('Get season stats error:', error);
    res.status(500).json({ error: 'Server error fetching season statistics' });
  }
});

// Delete season (only if not active)
router.delete('/:seasonNumber', auth, async (req, res) => {
  try {
    const seasonNumber = parseInt(req.params.seasonNumber);
    
    const season = await Season.findOne({
      userId: req.userId,
      seasonNumber
    });

    if (!season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    if (season.isActive) {
      return res.status(400).json({ error: 'Cannot delete active season' });
    }

    // Delete season
    await Season.findByIdAndDelete(season._id);

    res.json({ message: 'Season deleted successfully' });
  } catch (error) {
    console.error('Delete season error:', error);
    res.status(500).json({ error: 'Server error deleting season' });
  }
});

module.exports = router;


