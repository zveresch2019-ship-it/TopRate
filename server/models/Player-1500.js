const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for user's players
playerSchema.index({ userId: 1, currentSeason: 1 });

module.exports = mongoose.model('Player', playerSchema);


