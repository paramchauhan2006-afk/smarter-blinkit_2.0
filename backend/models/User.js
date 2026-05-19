const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
  faceEncoding: { type: [Number] } // 128-d Array of Numbers
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
