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
    // Получаем groupId пользователя
    let groupId;
    try {
      groupId = await getGroupId(req.userId);
    } catch (groupIdError) {
      return res.status(500).json({ error: 'User is not in a group' });
    }
    
    const player = await Player.findOne({
      _id: req.params.id,
      groupId: groupId,
      isActive: true
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
    console.log('📥 POST /api/players - Handler called');
    console.log('📥 Request userId from auth middleware:', req.userId);
    console.log('📥 Request body:', req.body);
    
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }
      
      console.log('✅ Validation passed');

      const { name, rating, sportType } = req.body;
      const initialRating = rating || 1500; // ✅ Используем рейтинг из запроса или 1500
      const currentSportType = sportType || 'football'; // ✅ Используем тип спорта из запроса

      console.log('📥 POST /api/players - Request body:', {
        name,
        rating,
        sportType,
        userId: req.userId
      });

      // Только админы группы могут создавать игроков
      let userIsGroupAdmin = false;
      try {
        userIsGroupAdmin = await isGroupAdmin(req.userId);
        console.log('📊 User is group admin?', userIsGroupAdmin);
      } catch (adminError) {
        console.error('❌ Error checking group admin status:', adminError);
        return res.status(500).json({ error: 'Error checking permissions' });
      }
      
      if (!userIsGroupAdmin) {
        console.log('⚠️ User is not group admin, access denied');
        return res.status(403).json({ error: 'Only group admins can create players' });
      }
      
      let groupId;
      try {
        groupId = await getGroupId(req.userId);
        console.log('📊 User groupId:', groupId);
      } catch (groupIdError) {
        console.error('❌ Error getting groupId:', groupIdError);
        return res.status(500).json({ error: 'User is not in a group' });
      }
      
      // Get current season for this sport (используем сезон группы)
      let currentSeason;
      try {
        currentSeason = await Season.findOne({ 
          groupId: groupId,
          sportType: currentSportType,
          isActive: true 
        });
        console.log('📊 Current season:', currentSeason ? `Season ${currentSeason.seasonNumber}` : 'None');
      } catch (seasonError) {
        console.error('❌ Error finding current season:', seasonError);
        // Продолжаем с seasonNumber = 1
      }
      
      const seasonNumber = currentSeason?.seasonNumber || 1;

      console.log('📝 Creating player:', {
        name: name.trim(),
        groupId: groupId?.toString(),
        seasonNumber: seasonNumber,
        sportType: currentSportType,
        currentSeasonId: currentSeason?._id?.toString()
      });

      // Check if player with same name exists in current season for this sport
      // Используем регистронезависимый поиск через toLowerCase
      const trimmedName = name.trim();
      
      let allPlayersInSeason = [];
      try {
        // Сначала проверяем точно по всем параметрам с регистронезависимым сравнением
        allPlayersInSeason = await Player.find({
          groupId: groupId,
          currentSeason: seasonNumber,
          sportType: currentSportType,
          isActive: true
        });
        
        console.log('🔍 Checking for duplicate player name:', {
          requestedName: trimmedName,
          playersInSeason: allPlayersInSeason.length,
          season: seasonNumber,
          sportType: currentSportType,
          groupId: groupId?.toString()
        });
        
        // Проверяем на дубликаты вручную (регистронезависимо)
        const existingPlayer = allPlayersInSeason.find(p => 
          p.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );

        if (existingPlayer) {
          console.log('⚠️ Player name conflict found:', {
            requestedName: trimmedName,
            existingPlayerName: existingPlayer.name,
            existingPlayerId: existingPlayer._id?.toString(),
            existingPlayerSeason: existingPlayer.currentSeason,
            existingPlayerSportType: existingPlayer.sportType,
            existingPlayerGroupId: existingPlayer.groupId?.toString(),
            checkingForSeason: seasonNumber,
            checkingForSportType: currentSportType,
            checkingForGroupId: groupId?.toString()
          });
          return res.status(400).json({ error: 'Player with this name already exists' });
        }
        
        console.log('✅ No duplicate found, creating player');
      } catch (checkError) {
        console.error('❌ Error checking for duplicate player:', checkError);
        console.error('❌ Error details:', {
          message: checkError.message,
          stack: checkError.stack
        });
        // Продолжаем создание, если проверка на дубликаты не удалась
      }

      // Create new player
      const playerData = {
        userId: req.userId, // Модель требует userId
        groupId: groupId, // Используем groupId
        name: trimmedName,
        currentSeason: seasonNumber,
        sportType: currentSportType,
        rating: initialRating,
        seasonStartRating: initialRating,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        ratingChange: 0
      };
      
      console.log('📝 Creating player object:', JSON.stringify(playerData, null, 2));
      
      let player;
      try {
        player = new Player(playerData);
        console.log('📝 Player object created, saving to database...');
        await player.save();
        console.log('✅ Player saved successfully:', player._id?.toString());
      } catch (saveError) {
        console.error('❌ Error saving player:', saveError);
        console.error('❌ Save error details:', {
          message: saveError.message,
          name: saveError.name,
          errors: saveError.errors
        });
        throw saveError; // Пробрасываем ошибку дальше для обработки в catch блоке
      }

      // Update season player count
      if (currentSeason) {
        currentSeason.totalPlayers += 1;
        await currentSeason.save();
      }

      console.log('✅ Player created successfully:', {
        playerId: player._id,
        name: player.name,
        groupId: player.groupId,
        season: player.currentSeason,
        sportType: player.sportType
      });

      res.status(201).json({ 
        message: 'Player added successfully',
        player 
      });
    } catch (error) {
      console.error('❌ Add player error:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        errors: error?.errors,
        code: error?.code,
        keyPattern: error?.keyPattern,
        keyValue: error?.keyValue
      });
      
      // Если это ошибка валидации Mongoose, показываем детали
      if (error?.name === 'ValidationError') {
        console.error('❌ Validation errors:', error.errors);
        const validationErrors = Object.values(error.errors).map((e) => e.message);
        return res.status(400).json({ 
          error: 'Validation error',
          details: validationErrors.join(', ')
        });
      }
      
      // Если это ошибка дубликата ключа
      if (error?.code === 11000) {
        console.error('❌ Duplicate key error:', error.keyValue);
        return res.status(400).json({ 
          error: 'Duplicate key error',
          details: `Player with this ${Object.keys(error.keyValue)[0]} already exists`
        });
      }
      
      res.status(500).json({ 
        error: 'Server error adding player',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
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
    console.log('📥 PUT /api/players/:id - Handler called');
    console.log('📥 Player ID:', req.params.id);
    console.log('📥 Request body:', req.body);
    console.log('📥 Request userId from auth middleware:', req.userId);
    
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      // Получаем groupId пользователя
      let groupId;
      try {
        groupId = await getGroupId(req.userId);
        console.log('📊 User groupId:', groupId);
      } catch (groupIdError) {
        console.error('❌ Error getting groupId:', groupIdError);
        return res.status(500).json({ error: 'User is not in a group' });
      }

      // Проверяем, является ли пользователь админом группы
      let userIsGroupAdmin = false;
      try {
        userIsGroupAdmin = await isGroupAdmin(req.userId);
        console.log('📊 User is group admin?', userIsGroupAdmin);
      } catch (adminError) {
        console.error('❌ Error checking group admin status:', adminError);
        return res.status(500).json({ error: 'Error checking permissions' });
      }

      // Находим игрока в группе пользователя
      const player = await Player.findOne({
        _id: req.params.id,
        groupId: groupId,
        isActive: true
      });

      if (!player) {
        console.log('❌ Player not found:', {
          playerId: req.params.id,
          groupId: groupId?.toString()
        });
        return res.status(404).json({ error: 'Player not found' });
      }

      console.log('✅ Player found:', {
        playerId: player._id?.toString(),
        currentName: player.name,
        currentRating: player.rating,
        groupId: player.groupId?.toString()
      });

      // Проверяем, что новое имя не конфликтует с существующими игроками (если имя изменяется)
      if (req.body.name && req.body.name.trim().toLowerCase() !== player.name.trim().toLowerCase()) {
        const newName = req.body.name.trim();
        const allPlayersInSeason = await Player.find({
          groupId: groupId,
          currentSeason: player.currentSeason,
          sportType: player.sportType,
          isActive: true,
          _id: { $ne: player._id } // Исключаем текущего игрока
        });

        const existingPlayer = allPlayersInSeason.find(p => 
          p.name.trim().toLowerCase() === newName.toLowerCase()
        );

        if (existingPlayer) {
          console.log('⚠️ Player name conflict found:', {
            requestedName: newName,
            existingPlayerName: existingPlayer.name,
            existingPlayerId: existingPlayer._id?.toString()
          });
          return res.status(400).json({ error: 'Player with this name already exists' });
        }
      }

      // Update fields
      if (req.body.name) {
        const oldName = player.name;
        player.name = req.body.name.trim();
        console.log('📝 Updating player name:', { oldName, newName: player.name });
      }
      if (req.body.rating !== undefined) {
        const oldRating = player.rating;
        player.rating = req.body.rating;
        console.log('📝 Updating player rating:', { oldRating, newRating: player.rating });
      }

      console.log('💾 Saving updated player...');
      await player.save();
      console.log('✅ Player updated successfully:', {
        playerId: player._id?.toString(),
        name: player.name,
        rating: player.rating
      });

      res.json({ 
        message: 'Player updated successfully',
        player 
      });
    } catch (error) {
      console.error('❌ Update player error:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      res.status(500).json({ error: 'Server error updating player' });
    }
  }
);

// Delete player
router.delete('/:id', auth, async (req, res) => {
  console.log('📥 DELETE /api/players/:id - Handler called');
  console.log('📥 Player ID:', req.params.id);
  console.log('📥 Request userId from auth middleware:', req.userId);
  
  try {
    // Получаем groupId пользователя
    let groupId;
    try {
      groupId = await getGroupId(req.userId);
      console.log('📊 User groupId:', groupId);
    } catch (groupIdError) {
      console.error('❌ Error getting groupId:', groupIdError);
      return res.status(500).json({ error: 'User is not in a group' });
    }

    // Проверяем, является ли пользователь админом группы
    let userIsGroupAdmin = false;
    try {
      userIsGroupAdmin = await isGroupAdmin(req.userId);
      console.log('📊 User is group admin?', userIsGroupAdmin);
    } catch (adminError) {
      console.error('❌ Error checking group admin status:', adminError);
      return res.status(500).json({ error: 'Error checking permissions' });
    }

    if (!userIsGroupAdmin) {
      console.log('⚠️ User is not group admin, access denied');
      return res.status(403).json({ error: 'Only group admins can delete players' });
    }

    // Находим игрока в группе пользователя
    const player = await Player.findOne({
      _id: req.params.id,
      groupId: groupId,
      isActive: true
    });

    if (!player) {
      console.log('❌ Player not found:', {
        playerId: req.params.id,
        groupId: groupId?.toString()
      });
      return res.status(404).json({ error: 'Player not found' });
    }

    console.log('✅ Player found, soft deleting:', {
      playerId: player._id?.toString(),
      name: player.name
    });

    // Soft delete - mark as inactive
    player.isActive = false;
    await player.save();

    console.log('✅ Player deleted successfully');
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    console.error('❌ Delete player error:', error);
    console.error('❌ Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    res.status(500).json({ error: 'Server error deleting player' });
  }
});

// Get player statistics
router.get('/:id/stats', auth, async (req, res) => {
  try {
    // Получаем groupId пользователя
    let groupId;
    try {
      groupId = await getGroupId(req.userId);
    } catch (groupIdError) {
      return res.status(500).json({ error: 'User is not in a group' });
    }
    
    const player = await Player.findOne({
      _id: req.params.id,
      groupId: groupId,
      isActive: true
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


