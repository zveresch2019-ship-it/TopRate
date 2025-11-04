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

      const { username, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      // Create new user
      const user = new User({
        username: username.toLowerCase(),
        password
      });

      await user.save();

      // Create a group for the user
      const group = new Group({
        name: `${username}'s Group`,
        description: `Group created by ${username}`,
        adminId: user._id,
        adminUsername: username.toLowerCase()
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

      console.log(`✅ Created new user "${username}" with 10 football and 10 basketball players`);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        message: 'User registered successfully',
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
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      // Find user
      const user = await User.findOne({ username: username.toLowerCase() });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

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


