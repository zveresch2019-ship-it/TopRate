const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
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
  season: {
    type: Number,
    required: true,
    default: 1
  },
  sportType: {
    type: String,
    enum: ['football', 'basketball'],
    default: 'football'
  },
  homeTeam: [{
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    playerName: String,
    ratingBefore: Number,
    ratingAfter: Number,
    ratingChange: Number
  }],
  awayTeam: [{
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    playerName: String,
    ratingBefore: Number,
    ratingAfter: Number,
    ratingChange: Number
  }],
  homeScore: {
    type: Number,
    required: true
  },
  awayScore: {
    type: Number,
    required: true
  },
  calculationParams: {
    kFactor: Number,
    homeAdvantage: Number,
    goalDifferenceMultiplier: Number,
    teamSizeMultiplier: Number,
    maxRatingChange: Number
  },
  matchDate: {
    type: Date,
    default: Date.now
  },
  ratingChanges: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound index for group's matches
matchSchema.index({ groupId: 1, season: 1, sportType: 1, matchDate: -1 });

module.exports = mongoose.model('Match', matchSchema);


