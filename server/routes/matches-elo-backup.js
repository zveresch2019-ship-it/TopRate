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

// Add new match and update player ratings
router.post('/',
  auth,
  [
    body('homeTeam').isArray({ min: 1 }).withMessage('Home team must have at least 1 player'),
    body('awayTeam').isArray({ min: 1 }).withMessage('Away team must have at least 1 player'),
    body('homeScore').isNumeric().withMessage('Home score must be a number'),
    body('awayScore').isNumeric().withMessage('Away score must be a number'),
    body('calculationParams').optional().isObject()
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { homeTeam, awayTeam, homeScore, awayScore, matchDate, calculationParams } = req.body;
      
      console.log('Creating match with data from client:', { homeTeam: homeTeam.length, awayTeam: awayTeam.length, homeScore, awayScore });

      // Get current season
      const currentSeason = await Season.findOne({ 
        userId: req.userId, 
        isActive: true 
      });
      const seasonNumber = currentSeason?.seasonNumber || 1;

      // Get all players
      const allPlayerIds = [...homeTeam, ...awayTeam];
      const players = await Player.find({
        _id: { $in: allPlayerIds },
        userId: req.userId
      });

      if (players.length !== allPlayerIds.length) {
        return res.status(400).json({ error: 'One or more players not found' });
      }

      // Calculate ratings using the same algorithm as in the app
      const homeTeamPlayers = players.filter(p => homeTeam.includes(p._id.toString()));
      const awayTeamPlayers = players.filter(p => awayTeam.includes(p._id.toString()));

      const avgHomeRating = homeTeamPlayers.reduce((sum, p) => sum + p.rating, 0) / homeTeamPlayers.length;
      const avgAwayRating = awayTeamPlayers.reduce((sum, p) => sum + p.rating, 0) / awayTeamPlayers.length;

      // Default calculation parameters
      const params = calculationParams || {
        kFactor: 32,
        homeAdvantage: 100,
        goalDifferenceMultiplier: 0.5,
        teamSizeMultiplier: 0.9,
        maxRatingChange: 100
      };

      // Calculate rating changes
      const homeWin = homeScore > awayScore;
      const draw = homeScore === awayScore;
      const goalDiff = Math.abs(homeScore - awayScore);
      
      const expectedHome = 1 / (1 + Math.pow(10, ((avgAwayRating - avgHomeRating - params.homeAdvantage) / 400)));
      const actualHome = homeWin ? 1 : (draw ? 0.5 : 0);
      
      const baseChange = params.kFactor * (actualHome - expectedHome);
      const goalMultiplier = 1 + (goalDiff * params.goalDifferenceMultiplier);
      const teamSizeAdj = Math.pow(params.teamSizeMultiplier, Math.max(homeTeamPlayers.length, awayTeamPlayers.length) - 1);
      
      let homeChange = baseChange * goalMultiplier * teamSizeAdj;
      homeChange = Math.max(Math.min(homeChange, params.maxRatingChange), -params.maxRatingChange);
      
      const awayChange = -homeChange;

      // Prepare match data
      const homeTeamData = [];
      const awayTeamData = [];

      // Update home team players
      for (const player of homeTeamPlayers) {
        const ratingBefore = player.rating;
        const ratingAfter = Math.round(ratingBefore + homeChange);
        const change = ratingAfter - ratingBefore;

        homeTeamData.push({
          playerId: player._id,
          playerName: player.name,
          ratingBefore,
          ratingAfter,
          ratingChange: change
        });

        // Update player
        player.rating = ratingAfter;
        player.gamesPlayed += 1;
        player.ratingChange = change;
        if (homeWin) player.wins += 1;
        else if (!draw) player.losses += 1;
        
        await player.save();
      }

      // Update away team players
      for (const player of awayTeamPlayers) {
        const ratingBefore = player.rating;
        const ratingAfter = Math.round(ratingBefore + awayChange);
        const change = ratingAfter - ratingBefore;

        awayTeamData.push({
          playerId: player._id,
          playerName: player.name,
          ratingBefore,
          ratingAfter,
          ratingChange: change
        });

        // Update player
        player.rating = ratingAfter;
        player.gamesPlayed += 1;
        player.ratingChange = change;
        if (!homeWin && !draw) player.wins += 1;
        else if (!draw) player.losses += 1;
        
        await player.save();
      }

      // Create match record
      const match = new Match({
        userId: req.userId,
        season: seasonNumber,
        homeTeam: homeTeamData,
        awayTeam: awayTeamData,
        homeScore,
        awayScore,
        calculationParams: params
      });

      await match.save();

      // Update season match count
      if (currentSeason) {
        currentSeason.totalMatches += 1;
        await currentSeason.save();
      }

      res.status(201).json({ 
        message: 'Match added successfully',
        match 
      });
    } catch (error) {
      console.error('Add match error:', error);
      res.status(500).json({ error: 'Server error adding match' });
    }
  }
);

// Delete match (and revert ratings)
router.delete('/:id', auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Revert ratings for all players in the match
    const allPlayers = [...match.homeTeam, ...match.awayTeam];
    
    for (const playerData of allPlayers) {
      const player = await Player.findById(playerData.playerId);
      if (player) {
        // Revert rating
        player.rating = playerData.ratingBefore;
        player.gamesPlayed = Math.max(0, player.gamesPlayed - 1);
        
        // Revert wins/losses
        const wasWin = playerData.ratingChange > 0;
        const wasLoss = playerData.ratingChange < 0;
        
        if (wasWin) player.wins = Math.max(0, player.wins - 1);
        if (wasLoss) player.losses = Math.max(0, player.losses - 1);
        
        // Reset rating change
        player.ratingChange = 0;
        
        await player.save();
      }
    }

    // Update season match count
    const season = await Season.findOne({ 
      userId: req.userId, 
      seasonNumber: match.season 
    });
    if (season) {
      season.totalMatches = Math.max(0, season.totalMatches - 1);
      await season.save();
    }

    // Delete match
    await Match.findByIdAndDelete(match._id);

    res.json({ message: 'Match deleted and ratings reverted successfully' });
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

    const matches = await Match.find({
      userId: req.userId,
      season: seasonNumber
    });

    const totalMatches = matches.length;
    const totalGoals = matches.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0);
    const avgGoalsPerMatch = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : 0;

    res.json({
      stats: {
        totalMatches,
        totalGoals,
        avgGoalsPerMatch: parseFloat(avgGoalsPerMatch),
        season: seasonNumber
      }
    });
  } catch (error) {
    console.error('Get match stats error:', error);
    res.status(500).json({ error: 'Server error fetching match statistics' });
  }
});

module.exports = router;


