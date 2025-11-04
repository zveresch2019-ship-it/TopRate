const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Player = require('../models/Player');
const Season = require('../models/Season');
const auth = require('../middleware/auth');

// Get all players for current user and season
router.get('/', auth, async (req, res) => {
  try {
    const { season } = req.query;
    
    // Get current season if not specified
    let seasonNumber = season;
    if (!seasonNumber) {
      const currentSeason = await Season.findOne({ 
        userId: req.userId, 
        isActive: true 
      });
      seasonNumber = currentSeason?.seasonNumber || 1;
    }

    const players = await Player.find({
      userId: req.userId,
      currentSeason: seasonNumber,
      isActive: true
    }).sort({ rating: -1 });

    res.json({ players, season: seasonNumber });
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Server error fetching players' });
  }
});

// Get single player by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const player = await Player.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ player });
  } catch (error) {
    console.error('Get player error:', error);
    res.status(500).json({ error: 'Server error fetching player' });
  }
});

// Add new player
router.post('/',
  auth,
  [
    body('name').trim().notEmpty().withMessage('Player name is required')
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name } = req.body;

      // Get current season
      const currentSeason = await Season.findOne({ 
        userId: req.userId, 
        isActive: true 
      });
      const seasonNumber = currentSeason?.seasonNumber || 1;

      // Check if player with same name exists in current season
      const existingPlayer = await Player.findOne({
        userId: req.userId,
        name: name.trim(),
        currentSeason: seasonNumber,
        isActive: true
      });

      if (existingPlayer) {
        return res.status(400).json({ error: 'Player with this name already exists' });
      }

      // Create new player
      const player = new Player({
        userId: req.userId,
        name: name.trim(),
        currentSeason: seasonNumber,
        rating: 1500,
        seasonStartRating: 1500, // ✅ Устанавливаем стартовый рейтинг
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        ratingChange: 0
      });

      await player.save();

      // Update season player count
      if (currentSeason) {
        currentSeason.totalPlayers += 1;
        await currentSeason.save();
      }

      res.status(201).json({ 
        message: 'Player added successfully',
        player 
      });
    } catch (error) {
      console.error('Add player error:', error);
      res.status(500).json({ error: 'Server error adding player' });
    }
  }
);

// Update player
router.put('/:id',
  auth,
  [
    body('name').optional().trim().notEmpty().withMessage('Player name cannot be empty'),
    body('rating').optional().isNumeric().withMessage('Rating must be a number')
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const player = await Player.findOne({
        _id: req.params.id,
        userId: req.userId
      });

      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }

      // Update fields
      if (req.body.name) player.name = req.body.name.trim();
      if (req.body.rating !== undefined) player.rating = req.body.rating;

      await player.save();

      res.json({ 
        message: 'Player updated successfully',
        player 
      });
    } catch (error) {
      console.error('Update player error:', error);
      res.status(500).json({ error: 'Server error updating player' });
    }
  }
);

// Delete player
router.delete('/:id', auth, async (req, res) => {
  try {
    const player = await Player.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Soft delete - mark as inactive
    player.isActive = false;
    await player.save();

    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    console.error('Delete player error:', error);
    res.status(500).json({ error: 'Server error deleting player' });
  }
});

// Get player statistics
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const player = await Player.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const winRate = player.gamesPlayed > 0 
      ? ((player.wins / player.gamesPlayed) * 100).toFixed(1)
      : 0;

    res.json({
      stats: {
        name: player.name,
        rating: player.rating,
        gamesPlayed: player.gamesPlayed,
        wins: player.wins,
        losses: player.losses,
        winRate: parseFloat(winRate),
        ratingChange: player.ratingChange,
        season: player.currentSeason
      }
    });
  } catch (error) {
    console.error('Get player stats error:', error);
    res.status(500).json({ error: 'Server error fetching player statistics' });
  }
});

module.exports = router;


