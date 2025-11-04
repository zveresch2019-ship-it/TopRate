const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Match = require('../models/Match');
const Player = require('../models/Player');
const Season = require('../models/Season');
const auth = require('../middleware/auth');

// Get all matches for current user and season
router.get('/', auth, async (req, res) => {
  try {
    const { season, limit = 50 } = req.query;
    
    // Get current season if not specified
    let seasonNumber = season;
    if (!seasonNumber) {
      const currentSeason = await Season.findOne({ 
        userId: req.userId, 
        isActive: true 
      });
      seasonNumber = currentSeason?.seasonNumber || 1;
    }

    const matches = await Match.find({
      userId: req.userId,
      season: seasonNumber
    })
    .sort({ matchDate: -1 })
    .limit(parseInt(limit));

    res.json({ matches, season: seasonNumber });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Server error fetching matches' });
  }
});

// Get single match by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ match });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ error: 'Server error fetching match' });
  }
});

// Add new match - SIMPLIFIED (trust client calculations)
router.post('/', auth, async (req, res) => {
  try {
    const { homeTeam, awayTeam, homeScore, awayScore, matchDate } = req.body;

    console.log('\n>>> Creating match (client-calculated ratings)');
    console.log('Home team players:', homeTeam.length);
    console.log('Away team players:', awayTeam.length);
    console.log('Score:', homeScore, ':', awayScore);

    // Get current season
    const currentSeason = await Season.findOne({ 
      userId: req.userId, 
      isActive: true 
    });
    const seasonNumber = currentSeason?.seasonNumber || 1;

    // ✅ ПРОСТО ПРИМЕНЯЕМ ИЗМЕНЕНИЯ ОТ КЛИЕНТА
    // Обновляем рейтинги всех игроков из обеих команд
    const allPlayers = [...homeTeam, ...awayTeam];
    
    for (const playerData of allPlayers) {
      const player = await Player.findById(playerData.playerId);
      
      if (player) {
        console.log(`Updating ${player.name}: ${player.rating} → ${playerData.ratingAfter} (${playerData.ratingChange > 0 ? '+' : ''}${playerData.ratingChange})`);
        
        player.rating = playerData.ratingAfter;
        player.gamesPlayed += 1;
        player.ratingChange = playerData.ratingChange;
        
        if (playerData.ratingChange > 0) {
          player.wins += 1;
        } else if (playerData.ratingChange < 0) {
          player.losses += 1;
        }
        
        await player.save();
      }
    }

    // Create match record
    const match = new Match({
      userId: req.userId,
      season: seasonNumber,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      homeScore,
      awayScore,
      matchDate: matchDate || new Date(),
      calculationParams: {
        kFactor: 32,
        homeAdvantage: 100,
        goalDifferenceMultiplier: 0.5,
        teamSizeMultiplier: 0.9,
        maxRatingChange: 100
      }
    });

    await match.save();

    // Update season match count
    if (currentSeason) {
      currentSeason.totalMatches += 1;
      await currentSeason.save();
    }

    console.log('>>> Match created successfully\n');

    res.status(201).json({ 
      message: 'Match added successfully',
      match 
    });
  } catch (error) {
    console.error('Add match error:', error);
    res.status(500).json({ error: 'Server error adding match' });
  }
});

// Delete match
router.delete('/:id', auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Note: We don't recalculate player ratings on delete
    // This is intentional to avoid complex state management
    await Match.findByIdAndDelete(req.params.id);

    // Update season match count
    const season = await Season.findOne({
      userId: req.userId,
      seasonNumber: match.season
    });
    
    if (season && season.totalMatches > 0) {
      season.totalMatches -= 1;
      await season.save();
    }

    res.json({ message: 'Match deleted successfully' });
  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({ error: 'Server error deleting match' });
  }
});

// Get match statistics
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const { season } = req.query;
    
    let seasonNumber = season;
    if (!seasonNumber) {
      const currentSeason = await Season.findOne({ 
        userId: req.userId, 
        isActive: true 
      });
      seasonNumber = currentSeason?.seasonNumber || 1;
    }

    const totalMatches = await Match.countDocuments({
      userId: req.userId,
      season: seasonNumber
    });

    res.json({
      totalMatches,
      season: seasonNumber
    });
  } catch (error) {
    console.error('Get match stats error:', error);
    res.status(500).json({ error: 'Server error fetching match statistics' });
  }
});

module.exports = router;

