const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Player = require('../models/Player');
const Season = require('../models/Season');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { getGroupId, isGroupAdmin } = require('../utils/groups');

// Get all players for current user and season and sportType
router.get('/', auth, async (req, res) => {
  try {
    const { season, sportType } = req.query;
    
    // Get current season if not specified
    let seasonNumber = season;
    const currentSportType = sportType || 'football';
    
    if (!seasonNumber) {
      const currentSeason = await Season.findOne({ 
        userId: req.userId, 
        sportType: currentSportType,
        isActive: true 
      });
      seasonNumber = currentSeason?.seasonNumber || 1;
    }

    // Получаем groupId для общих данных группы
    let groupId;
    try {
      groupId = await getGroupId(req.userId);
    } catch (error) {
      // Пользователь еще не выбрал группу - возвращаем пустой список
      console.log('⚠️ User not in any group yet, returning empty players list');
      return res.json({ players: [], season: seasonNumber, sportType: currentSportType });
    }
    
    // Все участники группы видят общих игроков
    const players = await Player.find({
      groupId: groupId,
      currentSeason: seasonNumber,
      sportType: currentSportType,
      isActive: true
    }).sort({ rating: -1 });

    res.json({ players, season: seasonNumber, sportType: currentSportType });
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Server error fetching players' });
  }
});

// Get single player by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const sharedUserId = await getSharedUserId();
    
    const player = await Player.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.userId },
        { userId: sharedUserId } // Общие игроки
      ]
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

      const { name, rating, sportType } = req.body;
      const initialRating = rating || 1500; // ✅ Используем рейтинг из запроса или 1500
      const currentSportType = sportType || 'football'; // ✅ Используем тип спорта из запроса

      // Только админы группы могут создавать игроков
      const userIsGroupAdmin = await isGroupAdmin(req.userId);
      if (!userIsGroupAdmin) {
        return res.status(403).json({ error: 'Only group admins can create players' });
      }
      
      const groupId = await getGroupId(req.userId); // Всегда используем groupId
      
      // Get current season for this sport (используем сезон группы)
      const currentSeason = await Season.findOne({ 
        groupId: groupId,
        sportType: currentSportType,
        isActive: true 
      });
      const seasonNumber = currentSeason?.seasonNumber || 1;

      // Check if player with same name exists in current season for this sport
      // Используем регистронезависимый поиск
      const trimmedName = name.trim();
      const existingPlayer = await Player.findOne({
        groupId: groupId, // Проверяем только в данных группы
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, // Регистронезависимый поиск
        currentSeason: seasonNumber,
        sportType: currentSportType,
        isActive: true
      });

      if (existingPlayer) {
        console.log('⚠️ Player name conflict:', {
          requestedName: trimmedName,
          existingPlayerName: existingPlayer.name,
          existingPlayerId: existingPlayer._id,
          groupId: groupId,
          season: seasonNumber,
          sportType: currentSportType
        });
        return res.status(400).json({ error: 'Player with this name already exists' });
      }

      // Create new player
      const player = new Player({
        groupId: groupId, // Используем groupId вместо userId
        name: name.trim(),
        currentSeason: seasonNumber,
        sportType: currentSportType, // ✅ Сохраняем тип спорта
        rating: initialRating, // ✅ Используем переданный рейтинг
        seasonStartRating: initialRating, // ✅ Устанавливаем стартовый рейтинг
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

      const sharedUserId = await getSharedUserId();
      const userIsAdmin = await isAdmin(req.userId);
      
      // Проверяем доступ: админы могут редактировать общих игроков, обычные - только своих
      const player = await Player.findOne({
        _id: req.params.id,
        $or: userIsAdmin 
          ? [{ userId: req.userId }, { userId: sharedUserId }] // Админы могут редактировать общих
          : [{ userId: req.userId }] // Обычные пользователи - только своих
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
    const sharedUserId = await getSharedUserId();
    const userIsAdmin = await isAdmin(req.userId);
    
    // Проверяем доступ: админы могут удалять общих игроков, обычные - только своих
    const player = await Player.findOne({
      _id: req.params.id,
      $or: userIsAdmin 
        ? [{ userId: req.userId }, { userId: sharedUserId }] // Админы могут удалять общих
        : [{ userId: req.userId }] // Обычные пользователи - только своих
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


