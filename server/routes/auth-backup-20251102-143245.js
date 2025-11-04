const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Season = require('../models/Season');
const Group = require('../models/Group');
const auth = require('../middleware/auth');

// Register new user
router.post('/register',
  [
    body('username').trim().isLength({ min: 3, max: 8 }).withMessage('Username must be 3-8 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password, groupName } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      // Create new user WITHOUT group (user will choose group later)
      const user = new User({
        username: username.toLowerCase(),
        password
      });

      await user.save();

      console.log(`✅ Created new user "${username}" - waiting for group selection`);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        message: 'User registered successfully - please select a group',
        token,
        user: {
          _id: user._id,
          username: user.username,
          role: 'user', // Default role until group is selected
          groupId: null,
          groupName: null,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Server error during registration' });
    }
  }
);

// Login
router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      console.log('📥 POST /api/auth/login from', req.ip);
      console.log('📥 Login request body:', { username: req.body.username, password: req.body.password ? '***' : 'missing' });
      
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Login validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;
      console.log('✅ Login validation passed for:', username);

      // Find user
      const user = await User.findOne({ username: username.toLowerCase() });
      if (!user) {
        console.log('❌ User not found:', username);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      console.log('✅ User found:', user.username);

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        console.log('❌ Password mismatch for user:', username);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      console.log('✅ Password match for user:', username);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      console.log('✅ Login successful for user:', username);

      res.json({
        message: 'Login successful',
        token,
        user: {
          _id: user._id,
          username: user.username,
          role: user.role || 'user',
          groupId: user.groupId,
          groupName: user.groupName,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error during login' });
    }
  }
);

// Get current user info
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('🔍 GET /me - User found:', {
      id: user._id,
      username: user.username,
      role: user.role,
      groupId: user.groupId,
      groupName: user.groupName
    });
    
    const responseData = {
      user: {
        id: user._id,
        username: user.username,
        role: user.role || 'user',
        groupId: user.groupId,
        groupName: user.groupName,
        createdAt: user.createdAt
      }
    };
    
    console.log('🔍 GET /me - Response data:', responseData);
    
    res.json(responseData);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create group for user
router.post('/create-group', auth, async (req, res) => {
  try {
    const { groupName } = req.body;
    const userId = req.userId;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has a group
    if (user.groupId) {
      return res.status(400).json({ error: 'User already has a group' });
    }

    // Create a group with unique name
    let finalGroupName = groupName || `${user.username}'s Group`;
    
    // Check if group name already exists and add suffix if needed
    let counter = 1;
    let originalName = finalGroupName;
    while (await Group.findOne({ name: finalGroupName })) {
      finalGroupName = `${originalName} (${counter})`;
      counter++;
    }
    
    const group = new Group({
      name: finalGroupName,
      description: `Group created by ${user.username}`,
      adminId: user._id,
      adminUsername: user.username.toLowerCase()
    });
    await group.save();

    // Update user with group info and set as admin
    user.groupId = group._id;
    user.groupName = group.name;
    user.role = 'admin'; // Создатель группы становится администратором
    await user.save();

    // Create initial seasons for both sports
    const footballSeason = new Season({
      userId: user._id,
      groupId: group._id,
      seasonNumber: 1,
      sportType: 'football',
      isActive: true
    });
    await footballSeason.save();

    const basketballSeason = new Season({
      userId: user._id,
      groupId: group._id,
      seasonNumber: 1,
      sportType: 'basketball',
      isActive: true
    });
    await basketballSeason.save();

    // Create 10 test players for Football
    const footballPlayers = [
      'Ronaldo', 'Messi', 'Neymar', 'Mbappé', 'Haaland',
      'Benzema', 'Lewandowski', 'Salah', 'De Bruyne', 'Modrić'
    ];
    
    for (const playerName of footballPlayers) {
      const player = new Player({
        userId: user._id,
        groupId: group._id,
        name: playerName,
        rating: 1500,
        seasonStartRating: 1500,
        currentSeason: 1,
        sportType: 'football',
        gamesPlayed: 0,
        wins: 0,
        losses: 0
      });
      await player.save();
    }

    // Create 10 test players for Basketball
    const basketballPlayers = [
      'LeBron', 'Jordan', 'Curry', 'Durant', 'Giannis',
      'Jokić', 'Embiid', 'Tatum', 'Dončić', 'Davis'
    ];
    
    for (const playerName of basketballPlayers) {
      const player = new Player({
        userId: user._id,
        groupId: group._id,
        name: playerName,
        rating: 1500,
        seasonStartRating: 1500,
        currentSeason: 1,
        sportType: 'basketball',
        gamesPlayed: 0,
        wins: 0,
        losses: 0
      });
      await player.save();
    }

    console.log(`✅ Created group "${finalGroupName}" for user "${user.username}" with 10 football and 10 basketball players`);

    res.status(201).json({
      message: 'Group created successfully',
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        groupId: user.groupId,
        groupName: user.groupName,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Server error during group creation' });
  }
});

// Join existing group
router.post('/join-group', auth, async (req, res) => {
  try {
    const { groupName } = req.body;
    const userId = req.userId;

    console.log(`📥 POST /join-group - User ID: ${userId}, Group name: ${groupName}`);

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`🔍 User "${user.username}" current groupId: ${user.groupId}`);

    // Check if user already has a group
    if (user.groupId) {
      console.log(`⚠️ User "${user.username}" already has group: ${user.groupId}`);
      // Проверяем, это та же группа или другая
      const currentGroup = await Group.findById(user.groupId);
      if (currentGroup && currentGroup.name === groupName) {
        // Пользователь уже в этой группе - возвращаем успех с новым токеном
        console.log(`✅ User already in group "${groupName}", returning success`);
        const payload = {
          userId: user._id,
          role: user.role,
          groupId: user.groupId
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' });
        return res.json({
          message: 'Already a member of this group',
          token,
          user: {
            _id: user._id,
            username: user.username,
            role: user.role,
            groupId: user.groupId,
            groupName: user.groupName,
            createdAt: user.createdAt
          }
        });
      } else {
        return res.status(400).json({ error: 'User already has a group' });
      }
    }

    // Find group by name
    const group = await Group.findOne({ name: groupName });
    if (!group) {
      console.log(`❌ Group not found: ${groupName}`);
      return res.status(404).json({ error: 'Group not found' });
    }

    console.log(`✅ Found group: ${group.name}, current memberCount: ${group.memberCount}`);

    // Update user with group info
    user.groupId = group._id;
    user.groupName = group.name;
    user.role = 'user'; // New member is regular user
    await user.save();

    // Update group member count
    group.memberCount = (group.memberCount || 0) + 1;
    await group.save();

    console.log(`✅ User "${user.username}" joined group "${group.name}", new memberCount: ${group.memberCount}`);

    // Generate new JWT token with updated groupId
    const payload = {
      userId: user._id,
      role: user.role,
      groupId: user.groupId
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' });

    res.json({
      message: 'Successfully joined group',
      token, // ✅ Возвращаем новый токен с обновленным groupId
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        groupId: user.groupId,
        groupName: user.groupName,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Join group error:', error);
    res.status(500).json({ error: 'Server error during joining group' });
  }
});

// Delete account
router.delete('/account', auth, async (req, res) => {
  try {
    const userId = req.userId;

    // Delete all user data
    await Promise.all([
      Player.deleteMany({ userId }),
      Match.deleteMany({ userId }),
      Season.deleteMany({ userId }),
      User.findByIdAndDelete(userId)
    ]);

    res.json({ message: 'Account and all data deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Server error during account deletion' });
  }
});

module.exports = router;


