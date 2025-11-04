const User = require('../models/User');

// Получить ID системного пользователя для общих данных
async function getSharedUserId() {
  try {
    const sharedUser = await User.findOne({ username: 'shared' });
    if (!sharedUser) {
      throw new Error('Shared user not found. Run: node create-shared-user.js');
    }
    return sharedUser._id;
  } catch (error) {
    console.error('Error getting shared user ID:', error);
    throw error;
  }
}

// Проверить, является ли пользователь админом
async function isAdmin(userId) {
  try {
    const user = await User.findById(userId);
    return user && user.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// Проверить, является ли пользователь админом группы
async function isGroupAdmin(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.groupId) {
      return false;
    }
    // Админ группы - это пользователь, который создал группу (adminId совпадает с userId)
    const Group = require('../models/Group');
    const group = await Group.findById(user.groupId);
    return group && group.adminId && group.adminId.toString() === userId.toString();
  } catch (error) {
    console.error('Error checking group admin status:', error);
    return false;
  }
}

// Получить groupId пользователя
async function getGroupId(userId) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.groupId) {
      throw new Error('User does not belong to a group');
    }
    return user.groupId;
  } catch (error) {
    console.error('Error getting group ID:', error);
    throw error;
  }
}

module.exports = {
  getSharedUserId,
  isAdmin,
  isGroupAdmin,
  getGroupId
};

