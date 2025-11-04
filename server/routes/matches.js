const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Match = require('../models/Match');
const Player = require('../models/Player');
const Season = require('../models/Season');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { getSharedUserId, isAdmin, isGroupAdmin, getGroupId } = require('../utils/shared');

// Get all matches for current user and season and sportType
router.get('/', auth, async (req, res) => {
  try {
    const { season, limit = 50, sportType } = req.query;
    
    // Get current season if not specified
    let seasonNumber = season;
    const currentSportType = sportType || 'football';
    
    // Получаем groupId пользователя
    const user = await User.findById(req.userId);
    if (!user || !user.groupId) {
      // Пользователь без группы - возвращаем пустой список
      return res.json({ matches: [], season: seasonNumber || 1, sportType: currentSportType });
    }
    const groupId = user.groupId;
    
    if (!seasonNumber) {
      // Ищем сезон для группы пользователя
      const currentSeason = await Season.findOne({ 
        groupId: groupId, // Используем groupId вместо userId
        sportType: currentSportType,
        isActive: true 
      });
      seasonNumber = currentSeason?.seasonNumber || 1;
    }
    
    // Загружаем матчи ТОЛЬКО для группы пользователя (не shared данные)
    const matches = await Match.find({
      groupId: groupId, // Только матчи группы пользователя
      season: seasonNumber,
      sportType: currentSportType
    })
    .sort({ matchDate: -1 })
    .limit(parseInt(limit));

    res.json({ matches, season: seasonNumber, sportType: currentSportType });
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
    const { homeTeam, awayTeam, homeScore, awayScore, matchDate, sportType, ratingChanges } = req.body;
    const currentSportType = sportType || 'football';

    console.log('\n>>> Creating match (client-calculated ratings)');
    console.log('Sport:', currentSportType);
    console.log('Home team players:', homeTeam.length);
    console.log('Away team players:', awayTeam.length);
    console.log('Score:', homeScore, ':', awayScore);

    // Только админы группы могут создавать матчи
    const { isGroupAdmin, getGroupId } = require('../utils/shared');
    const userIsGroupAdmin = await isGroupAdmin(req.userId);
    if (!userIsGroupAdmin) {
      return res.status(403).json({ error: 'Only group admins can create matches' });
    }
    
    // Получаем groupId пользователя
    const groupId = await getGroupId(req.userId);
    
    // Get current season for this sport (используем сезон группы)
    const currentSeason = await Season.findOne({ 
      groupId: groupId, // Используем сезон группы
      sportType: currentSportType,
      isActive: true 
    });
    const seasonNumber = currentSeason?.seasonNumber || 1;

    // ✅ Сбрасываем ratingChange для всех игроков группы (чтобы показывать только изменения из последнего матча)
    await Player.updateMany(
      { groupId: groupId, sportType: currentSportType, currentSeason: seasonNumber },
      { $set: { ratingChange: 0 } }
    );

    // ✅ ПРОСТО ПРИМЕНЯЕМ ИЗМЕНЕНИЯ ОТ КЛИЕНТА
    // Обновляем рейтинги всех игроков из обеих команд
    const allPlayers = [...homeTeam, ...awayTeam];
    
    console.log('📊 Player data for match creation:', {
      homeTeamCount: homeTeam.length,
      awayTeamCount: awayTeam.length,
      firstPlayer: homeTeam[0] ? {
        playerId: homeTeam[0].playerId,
        ratingBefore: homeTeam[0].ratingBefore,
        ratingAfter: homeTeam[0].ratingAfter,
        ratingChange: homeTeam[0].ratingChange
      } : null
    });
    
    // ✅ Сначала сохраняем ratingBefore для всех игроков ДО обновления рейтингов
    // Это нужно для корректного отката при удалении матча
    const playersRatingsBefore = new Map();
    for (const playerData of allPlayers) {
      const player = await Player.findById(playerData.playerId);
      if (player) {
        // Сохраняем текущий рейтинг игрока ДО применения изменений
        playersRatingsBefore.set(playerData.playerId?.toString(), player.rating);
      }
    }
    
    // Теперь обновляем рейтинги игроков
    for (const playerData of allPlayers) {
      const player = await Player.findById(playerData.playerId);
      
      if (player) {
        const ratingBefore = playersRatingsBefore.get(playerData.playerId?.toString()) || player.rating;
        console.log(`Updating ${player.name}: ${ratingBefore} → ${playerData.ratingAfter} (${playerData.ratingChange > 0 ? '+' : ''}${playerData.ratingChange})`);
        console.log(`  - ratingBefore in data: ${playerData.ratingBefore}, ratingBefore from player: ${ratingBefore}`);
        
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
          // ✅ Важно: сохраняем ratingBefore для каждого игрока в матче
          // Используем сохраненные значения ratingBefore из базы данных
          const match = new Match({
            userId: req.userId, // Используем ID текущего пользователя
            groupId: groupId, // ✅ Добавляем groupId
            season: seasonNumber,
            sportType: currentSportType, // ✅ Сохраняем тип спорта
            homeTeam: homeTeam.map(playerData => {
              // Используем сохраненный ratingBefore из базы данных
              const ratingBefore = playersRatingsBefore.get(playerData.playerId?.toString()) || playerData.ratingBefore || (playerData.ratingAfter - playerData.ratingChange);
              return {
                ...playerData,
                ratingBefore: ratingBefore // ✅ Гарантируем, что ratingBefore сохранен
              };
            }),
            awayTeam: awayTeam.map(playerData => {
              // Используем сохраненный ratingBefore из базы данных
              const ratingBefore = playersRatingsBefore.get(playerData.playerId?.toString()) || playerData.ratingBefore || (playerData.ratingAfter - playerData.ratingChange);
              return {
                ...playerData,
                ratingBefore: ratingBefore // ✅ Гарантируем, что ratingBefore сохранен
              };
            }),
            homeScore,
            awayScore,
            matchDate: matchDate || new Date(),
            ratingChanges: ratingChanges || {}, // ✅ Сохраняем изменения рейтингов для отображения в истории
            calculationParams: {
              kFactor: 32,
              homeAdvantage: 100,
              goalDifferenceMultiplier: 0.5,
              teamSizeMultiplier: 0.9,
              maxRatingChange: 100
            }
          });

    await match.save();
    
    console.log('✅ Match saved with ratingBefore data:', {
      homeTeamFirst: match.homeTeam[0] ? {
        ratingBefore: match.homeTeam[0].ratingBefore,
        ratingAfter: match.homeTeam[0].ratingAfter,
        ratingChange: match.homeTeam[0].ratingChange
      } : null
    });

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
    const { getGroupId } = require('../utils/shared');
    const groupId = await getGroupId(req.userId);
    
    const match = await Match.findOne({
      _id: req.params.id,
      groupId: groupId
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    console.log('\n>>> Deleting match and rolling back rating changes');
    console.log('Match ID:', match._id);
    console.log('Sport:', match.sportType);

    // ✅ Откатываем изменения рейтингов для всех игроков
    // Используем ratingBefore из матча для точного отката
    const allPlayers = [...match.homeTeam, ...match.awayTeam];
    
    console.log('📊 Match data for rollback:', {
      homeTeamCount: match.homeTeam.length,
      awayTeamCount: match.awayTeam.length,
      firstPlayer: match.homeTeam[0] ? {
        playerId: match.homeTeam[0].playerId,
        ratingBefore: match.homeTeam[0].ratingBefore,
        ratingAfter: match.homeTeam[0].ratingAfter,
        ratingChange: match.homeTeam[0].ratingChange
      } : null
    });
    
    // Сначала собираем всех игроков, которые участвовали в матче
    const playerIds = allPlayers.map(p => p.playerId?.toString()).filter(Boolean);
    const playersInMatch = await Player.find({ _id: { $in: playerIds } });
    const playersMap = new Map(playersInMatch.map(p => [p._id.toString(), p]));
    
    for (const playerData of allPlayers) {
      const playerIdStr = playerData.playerId?.toString();
      const player = playersMap.get(playerIdStr);
      
      if (player) {
        // Используем ratingBefore, если он есть, иначе вычисляем из ratingChange или ratingAfter
        let newRating;
        if (playerData.ratingBefore !== undefined && playerData.ratingBefore !== null) {
          newRating = playerData.ratingBefore;
          console.log(`✅ Using ratingBefore for ${player.name}: ${playerData.ratingBefore}`);
        } else if (playerData.ratingAfter !== undefined && playerData.ratingAfter !== null && playerData.ratingChange !== undefined && playerData.ratingChange !== null) {
          // Вычисляем из ratingAfter - ratingChange
          newRating = playerData.ratingAfter - playerData.ratingChange;
          console.log(`⚠️ No ratingBefore, calculating from ratingAfter - ratingChange for ${player.name}: ${playerData.ratingAfter} - ${playerData.ratingChange} = ${newRating}`);
        } else {
          // Последний fallback: вычисляем из текущего рейтинга и ratingChange
          const ratingChange = playerData.ratingChange || 0;
          newRating = player.rating - ratingChange;
          console.log(`⚠️ No ratingBefore/ratingAfter, calculating from current rating - ratingChange for ${player.name}: ${player.rating} - ${ratingChange} = ${newRating}`);
        }
        
        const ratingChange = playerData.ratingChange !== undefined && playerData.ratingChange !== null 
          ? playerData.ratingChange 
          : (player.rating - newRating);
        
        console.log(`🔄 Rolling back ${player.name}: ${player.rating} → ${newRating} (change was: ${ratingChange})`);
        console.log(`  - Player data:`, {
          ratingBefore: playerData.ratingBefore,
          ratingAfter: playerData.ratingAfter,
          ratingChange: playerData.ratingChange,
          currentRating: player.rating
        });
        
        const oldRating = player.rating;
        player.rating = newRating;
        player.gamesPlayed = Math.max(0, player.gamesPlayed - 1);
        
        // Откатываем статистику (wins/losses) на основе знака изменения
        if (ratingChange > 0) {
          player.wins = Math.max(0, player.wins - 1);
        } else if (ratingChange < 0) {
          player.losses = Math.max(0, player.losses - 1);
        }
        
        // Сбрасываем ratingChange (он будет установлен при следующем матче)
        player.ratingChange = 0;
        
        await player.save();
        
        // Проверяем, что изменения действительно сохранились
        const savedPlayer = await Player.findById(playerData.playerId);
        console.log(`✅ Saved ${player.name}: rating ${oldRating} → ${player.rating}, gamesPlayed: ${player.gamesPlayed}`);
        console.log(`   Verified in DB: rating = ${savedPlayer?.rating}, gamesPlayed = ${savedPlayer?.gamesPlayed}`);
      } else {
        console.error(`❌ Player not found: ${playerIdStr}`);
      }
    }

    // Удаляем матч
    await Match.findByIdAndDelete(req.params.id);
    
    console.log('✅ Match deleted from database');

    // Update season match count
    const season = await Season.findOne({
      groupId: groupId,
      seasonNumber: match.season,
      sportType: match.sportType
    });
    
    if (season && season.totalMatches > 0) {
      season.totalMatches -= 1;
      await season.save();
    }

    console.log('>>> Match deleted successfully\n');

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

