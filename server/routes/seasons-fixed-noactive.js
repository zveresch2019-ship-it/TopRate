const express = require('express');
const router = express.Router();
const Season = require('../models/Season');
const Player = require('../models/Player');
const auth = require('../middleware/auth');

// Get all seasons for current user
router.get('/', auth, async (req, res) => {
  try {
    const seasons = await Season.find({ userId: req.userId })
      .sort({ seasonNumber: -1 });

    res.json({ seasons });
  } catch (error) {
    console.error('Get seasons error:', error);
    res.status(500).json({ error: 'Server error fetching seasons' });
  }
});

// Get current active season
router.get('/current', auth, async (req, res) => {
  try {
    let season = await Season.findOne({ 
      userId: req.userId, 
      isActive: true 
    });

    // Create first season if none exists
    if (!season) {
      season = new Season({
        userId: req.userId,
        seasonNumber: 1,
        isActive: true
      });
      await season.save();
    }

    res.json({ season });
  } catch (error) {
    console.error('Get current season error:', error);
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

// Start new season
router.post('/new', auth, async (req, res) => {
  try {
    // Get current active season
    const currentSeason = await Season.findOne({ 
      userId: req.userId, 
      isActive: true 
    });

    if (!currentSeason) {
      console.log('No active season found, creating first season');
      // Создаём первый сезон если активного нет
      const firstSeason = new Season({
        userId: req.userId,
        seasonNumber: 1,
        isActive: true
      });
      await firstSeason.save();
      
      return res.status(201).json({ 
        message: 'First season created',
        season: firstSeason,
        playersCarriedOver: 0
      });
    }

    // Close current season
    currentSeason.isActive = false;
    currentSeason.endDate = new Date();
    await currentSeason.save();

    // Get all active players from current season
    const currentPlayers = await Player.find({
      userId: req.userId,
      currentSeason: currentSeason.seasonNumber,
      isActive: true
    }).sort({ name: 1 }); // ✅ Сортируем по имени для стабильности
    
    console.log(`Found ${currentPlayers.length} players in season ${currentSeason.seasonNumber}`);

    // Create new season
    const newSeasonNumber = currentSeason.seasonNumber + 1;
    const newSeason = new Season({
      userId: req.userId,
      seasonNumber: newSeasonNumber,
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
        name: player.name,
        rating: currentRating, // ✅ Сохраняем рейтинг из предыдущего сезона
        seasonStartRating: currentRating, // ✅ Запоминаем стартовый рейтинг сезона
        currentSeason: newSeasonNumber,
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
      playersCarriedOver: newPlayers.length
    });
  } catch (error) {
    console.error('Start new season error:', error);
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


