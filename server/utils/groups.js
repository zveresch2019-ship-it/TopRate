const User = require('../models/User');
const Group = require('../models/Group');

// Получить ID группы пользователя
async function getGroupId(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.groupId) {
      throw new Error('User not in any group');
    }
    return user.groupId;
  } catch (error) {
    console.error('Error getting group ID:', error);
    throw error;
  }
}

// Проверить, является ли пользователь админом группы
async function isGroupAdmin(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.groupId) {
      return false;
    }
    
    const group = await Group.findById(user.groupId);
    return group && group.adminId.toString() === userId;
  } catch (error) {
    console.error('Error checking group admin status:', error);
    return false;
  }
}

// Проверить, является ли пользователь админом (роль admin)
async function isAdmin(userId) {
  try {
    const user = await User.findById(userId);
    return user && user.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

module.exports = {
  getGroupId,
  isGroupAdmin,
  isAdmin
};
