const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Group = require('../models/Group');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Создать новую группу (только админы)
router.post('/create', 
  auth,
  [
    body('name').trim().notEmpty().withMessage('Group name is required').isLength({ min: 3, max: 50 }).withMessage('Group name must be 3-50 characters'),
    body('description').optional().trim().isLength({ max: 200 }).withMessage('Description must be less than 200 characters')
  ],
  async (req, res) => {
    try {
      // Проверяем, что пользователь админ
      const user = await User.findById(req.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create groups' });
      }

      // Проверяем, что пользователь еще не в группе
      if (user.groupId) {
        return res.status(400).json({ error: 'User is already in a group' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description } = req.body;

      // Создаем группу
      const group = new Group({
        name: name.trim(),
        description: description?.trim() || '',
        adminId: req.userId,
        adminUsername: user.username
      });

      await group.save();

      // Обновляем пользователя
      user.groupId = group._id;
      user.groupName = group.name;
      await user.save();

      res.status(201).json({
        message: 'Group created successfully',
        group: {
          id: group._id,
          name: group.name,
          description: group.description,
          adminUsername: group.adminUsername,
          memberCount: group.memberCount
        }
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ error: 'Group name already exists' });
      }
      console.error('Create group error:', error);
      res.status(500).json({ error: 'Server error creating group' });
    }
  }
);

// Присоединиться к группе (обычные пользователи)
router.post('/join',
  auth,
  [
    body('groupName').trim().notEmpty().withMessage('Group name is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { groupName } = req.body;
      const user = await User.findById(req.userId);

      // Проверяем, что пользователь еще не в группе
      if (user.groupId) {
        return res.status(400).json({ error: 'User is already in a group' });
      }

      // Находим группу
      const group = await Group.findOne({ 
        name: groupName.trim(),
        isActive: true 
      });

      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Обновляем пользователя
      user.groupId = group._id;
      user.groupName = group.name;
      await user.save();

      // Увеличиваем счетчик участников
      group.memberCount += 1;
      await group.save();

      res.json({
        message: 'Successfully joined group',
        group: {
          id: group._id,
          name: group.name,
          description: group.description,
          adminUsername: group.adminUsername,
          memberCount: group.memberCount
        }
      });
    } catch (error) {
      console.error('Join group error:', error);
      res.status(500).json({ error: 'Server error joining group' });
    }
  }
);

// Покинуть группу
router.post('/leave', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.groupId) {
      return res.status(400).json({ error: 'User is not in any group' });
    }

    const group = await Group.findById(user.groupId);
    
    // Если это админ группы, удаляем группу
    if (group && group.adminId.toString() === req.userId) {
      await Group.findByIdAndDelete(user.groupId);
      // Обновляем всех участников группы
      await User.updateMany(
        { groupId: user.groupId },
        { $unset: { groupId: 1, groupName: 1 } }
      );
    } else {
      // Обычный пользователь покидает группу
      user.groupId = undefined;
      user.groupName = undefined;
      await user.save();
      
      if (group) {
        group.memberCount = Math.max(0, group.memberCount - 1);
        await group.save();
      }
    }

    res.json({ message: 'Successfully left group' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Server error leaving group' });
  }
});

// Получить информацию о текущей группе
router.get('/current', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user.groupId) {
      return res.json({ group: null });
    }

    const group = await Group.findById(user.groupId);
    
    if (!group) {
      // Группа была удалена, очищаем у пользователя
      user.groupId = undefined;
      user.groupName = undefined;
      await user.save();
      return res.json({ group: null });
    }

    res.json({
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
        adminUsername: group.adminUsername,
        memberCount: group.memberCount,
        isAdmin: group.adminId.toString() === req.userId
      }
    });
  } catch (error) {
    console.error('Get current group error:', error);
    res.status(500).json({ error: 'Server error fetching group' });
  }
});

// Получить список всех доступных групп (для присоединения - не требует auth)
router.get('/', async (req, res) => {
  try {
    console.log('📥 GET /api/groups - Fetching all groups');
    const groups = await Group.find({
      isActive: true
    })
    .select('_id name description adminUsername memberCount')
    .sort({ memberCount: -1, name: 1 })
    .limit(50);

    console.log(`✅ Found ${groups.length} groups`);

    // Динамически подсчитываем реальное количество участников для каждой группы
    const groupsWithRealCount = await Promise.all(groups.map(async (group) => {
      const realMemberCount = await User.countDocuments({ 
        groupId: group._id,
        // Исключаем пользователей без groupId
      });
      
      // Обновляем memberCount в базе, если он не совпадает с реальным
      if (group.memberCount !== realMemberCount) {
        console.log(`⚠️ Group "${group.name}": stored memberCount (${group.memberCount}) != real count (${realMemberCount}), updating...`);
        group.memberCount = realMemberCount;
        await group.save();
      }
      
      return {
        id: group._id.toString(),
        _id: group._id.toString(),
        name: group.name,
        description: group.description,
        adminUsername: group.adminUsername,
        memberCount: realMemberCount
      };
    }));

    console.log('✅ Returning groups:', groupsWithRealCount.length);
    res.json({ groups: groupsWithRealCount });
  } catch (error) {
    console.error('❌ Get groups error:', error);
    res.status(500).json({ error: 'Server error fetching groups' });
  }
});

// Поиск групп (для присоединения)
router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const groups = await Group.find({
      name: { $regex: query.trim(), $options: 'i' },
      isActive: true
    })
    .select('name description adminUsername memberCount')
    .limit(10);

    res.json({ groups });
  } catch (error) {
    console.error('Search groups error:', error);
    res.status(500).json({ error: 'Server error searching groups' });
  }
});

module.exports = router;
