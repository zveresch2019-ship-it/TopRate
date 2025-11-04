const mongoose = require('mongoose');

const seasonSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true
  },
  seasonNumber: {
    type: Number,
    required: true
  },
  sportType: {
    type: String,
    enum: ['football', 'basketball'],
    default: 'football'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  totalMatches: {
    type: Number,
    default: 0
  },
  totalPlayers: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index for group's seasons by sport
seasonSchema.index({ groupId: 1, seasonNumber: 1, sportType: 1 }, { unique: true });

module.exports = mongoose.model('Season', seasonSchema);


