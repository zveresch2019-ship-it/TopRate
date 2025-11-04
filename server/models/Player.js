const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    trim: true
  },
  rating: {
    type: Number,
    default: 1500
  },
  seasonStartRating: {
    type: Number,
    default: 1500
  },
  gamesPlayed: {
    type: Number,
    default: 0
  },
  wins: {
    type: Number,
    default: 0
  },
  losses: {
    type: Number,
    default: 0
  },
  ratingChange: {
    type: Number,
    default: 0
  },
  currentSeason: {
    type: Number,
    default: 1
  },
  sportType: {
    type: String,
    enum: ['football', 'basketball'],
    default: 'football'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for group's players
playerSchema.index({ groupId: 1, currentSeason: 1, sportType: 1 });

module.exports = mongoose.model('Player', playerSchema);


