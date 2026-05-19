const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  inventory: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    barcode: { type: String },
    stock: { type: Number, default: 0 }
  }]
}, { timestamps: true });

storeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Store', storeSchema);
