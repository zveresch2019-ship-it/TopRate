const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminUsername: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  memberCount: {
    type: Number,
    default: 1 // Админ считается первым участником
  }
}, {
  timestamps: true
});

// Индексы
groupSchema.index({ name: 1 }, { unique: true }); // Уникальное имя группы

module.exports = mongoose.model('Group', groupSchema);
