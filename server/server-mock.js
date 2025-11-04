const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// Функция для получения username из токена
const getUsernameFromToken = (req) => {
  const authHeader = req.headers.authorization;
  let username = null; // не устанавливаем значение по умолчанию
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token.startsWith('mock-jwt-token-')) {
      username = token.replace('mock-jwt-token-', '');
    }
  }
  
  console.log('🔍 getUsernameFromToken:', { authHeader, username });
  return username;
};

// Функция для получения groupId из токена
const getGroupIdFromToken = (req) => {
  const username = getUsernameFromToken(req);
  return `mock-group-${username}`;
};

// Хранилище данных по группам
const groupData = {}; // { groupId: { players: [], seasons: [], matches: [], adminId: string, name: string } }
const userGroups = {}; // { userId: groupId } - привязка пользователей к группам

// Инициализация данных для группы (+ сезоны для футбола и баскетбола)
const initGroupData = (groupId, adminId, groupName) => {
  if (!groupData[groupId]) {
    groupData[groupId] = {
      players: [],
      seasons: [
        {
          _id: `mock-season-${groupId}-football`,
          seasonNumber: 1,
          isActive: true,
          sportType: 'football',
          groupId: groupId
        },
        {
          _id: `mock-season-${groupId}-basketball`,
          seasonNumber: 1,
          isActive: true,
          sportType: 'basketball',
          groupId: groupId
        }
      ],
      matches: [],
      adminId: adminId,
      name: groupName
    };
  }
  return groupData[groupId];
};

// Сидим 10 тестовых игроков-художников для указанного спорта
const seedArtistsForSport = (data, groupId, sportType) => {
  const names = [
    'Da Vinci',
    'Michelangelo',
    'Raphael',
    'Donatello',
    'Caravaggio',
    'Rembrandt',
    'Vermeer',
    'Picasso',
    'VanGogh',
    'Monet'
  ];
  names.forEach(name => {
    data.players.push({
      _id: `mock-player-${groupId}-${sportType}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      name,
      rating: 1500,
      seasonStartRating: 1500,
      currentSeason: 1,
      sportType,
      groupId,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      lastRatingChange: 0
    });
  });
};

// Получение списка доступных групп
const getAvailableGroups = () => {
  return Object.keys(groupData).map(groupId => ({
    id: groupId,
    name: groupData[groupId].name,
    adminId: groupData[groupId].adminId,
    memberCount: groupData[groupId].players.length + 1 // +1 для админа
  }));
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mock server is running' });
});

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('🔐 Login attempt:', { username, password, body: req.body });
  
  // Принимаем любой логин с любым паролем для тестирования
  if (username && password) {
    const userId = `mock-user-${username}`;
    const userGroupId = userGroups[userId];
    
    let user;
    
    if (!userGroupId) {
      // Пользователь не зарегистрирован - нужно зарегистрироваться
      console.log('❌ User not registered:', username);
      res.status(404).json({ error: 'User not found. Please register first.' });
      return;
    }
    
    // Пользователь зарегистрирован и имеет группу
    const group = groupData[userGroupId];
    const isAdmin = group.adminId === userId;
    
    user = {
      _id: userId,
      username: username,
      role: isAdmin ? 'admin' : 'user',
      groupId: userGroupId,
      groupName: group.name,
      createdAt: new Date()
    };
    
    console.log('✅ Login successful for:', username, 'group:', userGroupId);
    
    res.json({
      message: 'Login successful',
      token: `mock-jwt-token-${username}`,
      user: user
    });
  } else {
    console.log('❌ Login failed - missing credentials');
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, groupName, groupId } = req.body;
  
  console.log('📝 Register attempt:', { username, password, groupName, groupId, body: req.body });
  
  if (username && password) {
    const userId = `mock-user-${username}`;
    let user;
    
    // Проверяем, существует ли пользователь уже
    const existingUserGroupId = userGroups[userId];
    
    if (groupId) {
      // Присоединяемся к существующей группе
      if (!groupData[groupId]) {
        return res.status(404).json({ error: 'Group not found' });
      }
      
      userGroups[userId] = groupId;
      const group = groupData[groupId];
      
      user = {
        _id: userId,
        username: username,
        role: 'user', // Обычный пользователь
        groupId: groupId,
        groupName: group.name,
        createdAt: new Date()
      };
      
      console.log('✅ Registration successful for:', username, 'joined group:', groupId);
    } else if (groupName) {
      // Создаем новую группу
      const newGroupId = `mock-group-${Date.now()}`;
      initGroupData(newGroupId, userId, groupName);
      userGroups[userId] = newGroupId;
      // Подготавливаем ссылку на данные группы
      const data = groupData[newGroupId];
      // Сидим 10 игроков для football и basketball
      seedArtistsForSport(data, newGroupId, 'football');
      seedArtistsForSport(data, newGroupId, 'basketball');
      
      user = {
        _id: userId,
        username: username,
        role: 'admin', // Админ новой группы
        groupId: newGroupId,
        groupName: groupName,
        createdAt: new Date()
      };
      
      console.log('✅ Registration successful for:', username, 'created group:', newGroupId);
    } else {
      return res.status(400).json({ error: 'Either groupName or groupId is required' });
    }
    
    res.status(201).json({
      message: 'User registered successfully',
      token: `mock-jwt-token-${username}`,
      user: user
    });
  } else {
    console.log('❌ Registration failed - missing credentials');
    res.status(400).json({ error: 'Username and password required' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const username = getUsernameFromToken(req);
  
  if (!username) {
    console.log('❌ No username in token');
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  
  const userId = `mock-user-${username}`;
  const userGroupId = userGroups[userId];
  
  console.log('🔍 /auth/me:', { username, userId, userGroupId });
  
  if (!userGroupId) {
    // Пользователь не зарегистрирован
    console.log('❌ User not found in groups:', username);
    res.status(404).json({ error: 'User not found' });
    return;
  }
  
  // Пользователь зарегистрирован и имеет группу
  const group = groupData[userGroupId];
  const isAdmin = group.adminId === userId;
  
  const user = {
    _id: userId,
    username: username,
    role: isAdmin ? 'admin' : 'user',
    groupId: userGroupId,
    groupName: group.name,
    createdAt: new Date()
  };
  
  console.log('✅ /auth/me success:', user);
  res.json({
    user: user
  });
});

// Groups routes
app.get('/api/groups', (req, res) => {
  const groups = getAvailableGroups();
  res.json({ groups: groups });
});

app.post('/api/groups/join', (req, res) => {
  const { groupId } = req.body;
  const username = getUsernameFromToken(req);
  const userId = `mock-user-${username}`;
  
  console.log('👥 Join group attempt:', { username, groupId });
  
  if (userGroups[userId]) {
    return res.status(400).json({ error: 'User already in a group' });
  }
  
  if (!groupData[groupId]) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  // Привязываем пользователя к группе
  userGroups[userId] = groupId;
  
  const group = groupData[groupId];
  const user = {
    _id: userId,
    username: username,
    role: 'user',
    groupId: groupId,
    groupName: group.name,
    createdAt: new Date()
  };
  
  console.log('✅ User joined group:', username, '->', groupId);
  
  res.json({
    message: 'Successfully joined group',
    user: user
  });
});

// Seasons routes
app.get('/api/seasons', (req, res) => {
  const username = getUsernameFromToken(req);
  const userId = `mock-user-${username}`;
  const userGroupId = userGroups[userId];
  
  if (!userGroupId) {
    return res.status(400).json({ error: 'User not in any group' });
  }
  
  const data = groupData[userGroupId];
  const sportType = req.query.sportType || 'football';
  const seasons = data.seasons.filter(s => s.sportType === sportType);
  
  res.json({ seasons: seasons });
});

app.get('/api/seasons/current', (req, res) => {
  const username = getUsernameFromToken(req);
  const userId = `mock-user-${username}`;
  const userGroupId = userGroups[userId];
  
  if (!userGroupId) {
    return res.status(400).json({ error: 'User not in any group' });
  }
  
  const data = groupData[userGroupId];
  const sportType = req.query.sportType || 'football';
  const activeSeason = data.seasons.find(s => s.isActive && s.sportType === sportType);
  
  if (activeSeason) {
    res.json({ season: activeSeason });
  } else {
    // Создаем активный сезон, если его нет
    const newSeason = {
      _id: `mock-season-${userGroupId}-${Date.now()}`,
      seasonNumber: 1,
      isActive: true,
      sportType: sportType,
      groupId: userGroupId
    };
    data.seasons.push(newSeason);
    res.json({ season: newSeason });
  }
});

app.post('/api/seasons/new', (req, res) => {
  const username = getUsernameFromToken(req);
  const userId = `mock-user-${username}`;
  const userGroupId = userGroups[userId];
  
  if (!userGroupId) {
    return res.status(400).json({ error: 'User not in any group' });
  }
  
  const data = groupData[userGroupId];
  const sportType = req.body.sportType || 'football';
  const maxSeasonNumber = Math.max(...data.seasons.map(s => s.seasonNumber), 0);
  
  const newSeason = {
    _id: `mock-season-${userGroupId}-${Date.now()}`,
    seasonNumber: maxSeasonNumber + 1,
    isActive: true,
    sportType: sportType,
    groupId: userGroupId
  };
  
  // Деактивируем все предыдущие сезоны этого спорта
  data.seasons.forEach(s => {
    if (s.sportType === sportType) {
      s.isActive = false;
    }
  });
  
  data.seasons.push(newSeason);
  res.status(201).json({ season: newSeason });
});

// Players routes
app.get('/api/players', (req, res) => {
  const username = getUsernameFromToken(req);
  const userId = `mock-user-${username}`;
  const userGroupId = userGroups[userId];
  
  if (!userGroupId) {
    return res.status(400).json({ error: 'User not in any group' });
  }
  
  const data = groupData[userGroupId];
  const sportType = req.query.sportType || 'football';
  const players = data.players.filter(p => p.sportType === sportType);
  
  console.log('📥 GET /api/players: Returning players:', players.map(p => ({
    id: p.id,
    name: p.name,
    rating: p.rating,
    lastRatingChange: p.lastRatingChange
  })));
  
  res.json({ players: players });
});

app.post('/api/players', (req, res) => {
  const username = getUsernameFromToken(req);
  const userId = `mock-user-${username}`;
  const userGroupId = userGroups[userId];
  
  if (!userGroupId) {
    return res.status(400).json({ error: 'User not in any group' });
  }
  
  const data = groupData[userGroupId];
  const { name, initialRating, sportType } = req.body;
  const rating = initialRating || 1500;
  
  const newPlayer = {
    _id: `mock-player-${userGroupId}-${Date.now()}`,
    name,
    rating: rating,
    seasonStartRating: rating,
    currentSeason: 1,
    sportType: sportType || 'football',
    groupId: userGroupId,
    gamesPlayed: 0,
    wins: 0,
    losses: 0
  };
  
  data.players.push(newPlayer);
  
  res.status(201).json({ player: newPlayer });
});

// Matches routes
app.get('/api/matches', (req, res) => {
  const username = getUsernameFromToken(req);
  const userId = `mock-user-${username}`;
  const userGroupId = userGroups[userId];
  
  if (!userGroupId) {
    return res.status(400).json({ error: 'User not in any group' });
  }
  
  const data = groupData[userGroupId];
  const sportType = req.query.sportType || 'football';
  const matches = data.matches.filter(m => m.sportType === sportType);
  
  res.json({ matches: matches });
});

app.post('/api/matches', (req, res) => {
  const username = getUsernameFromToken(req);
  const userId = `mock-user-${username}`;
  const userGroupId = userGroups[userId];
  
  if (!userGroupId) {
    return res.status(400).json({ error: 'User not in any group' });
  }
  
  const data = groupData[userGroupId];
  const sportType = req.body.sportType || 'football';
  const newMatch = {
    _id: `mock-match-${userGroupId}-${Date.now()}`,
    ...req.body,
    sportType: sportType,
    groupId: userGroupId,
    createdAt: new Date()
  };
  
  // Обновляем рейтинги игроков на основе изменений из матча
  if (req.body.ratingChanges) {
    console.log('🔄 Updating player ratings:', req.body.ratingChanges);
    console.log('📋 Available players in group:', data.players.map(p => ({ _id: p._id, name: p.name, rating: p.rating })));
    
    let updatedCount = 0;
    data.players.forEach(player => {
      if (req.body.ratingChanges[player._id] !== undefined) {
        const oldRating = player.rating;
        player.rating += req.body.ratingChanges[player._id];
        player.lastRatingChange = req.body.ratingChanges[player._id];
        // gamesPlayed используется клиентом (adaptPlayerFromServer -> matchesPlayed)
        player.gamesPlayed = (player.gamesPlayed || 0) + 1;
        
        // Определяем победителя/проигравшего
        const isWinner = req.body.ratingChanges[player._id] > 0;
        if (isWinner) {
          player.wins = (player.wins || 0) + 1;
        } else {
          player.losses = (player.losses || 0) + 1;
        }
        
        updatedCount++;
        console.log(`📊 Player ${player.name} (${player._id}): ${oldRating} → ${player.rating} (${req.body.ratingChanges[player._id] > 0 ? '+' : ''}${req.body.ratingChanges[player._id]})`);
      }
    });
    
    console.log(`✅ Updated ${updatedCount} players out of ${Object.keys(req.body.ratingChanges).length} expected`);
    
    // Логируем игроков, которые должны были обновиться, но не были найдены
    Object.keys(req.body.ratingChanges).forEach(playerId => {
      if (!data.players.find(p => p._id === playerId)) {
        console.log(`⚠️ Player ID ${playerId} not found in group data!`);
      }
    });

    // Сбрасываем lastRatingChange для всех, кто не участвовал в матче
    const changedIds = new Set(Object.keys(req.body.ratingChanges));
    data.players.forEach(p => {
      if (!changedIds.has(p._id)) {
        p.lastRatingChange = 0;
      }
    });
  }
  
  data.matches.push(newMatch);
  
  console.log('✅ Match created and player ratings updated');
  res.status(201).json({ match: newMatch });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mock server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});