const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  category: { type: String },
  barcode: { type: String, required: true, unique: true },
  salesCount: { type: Number, default: 0 }
}, { timestamps: true });

productSchema.index({ salesCount: -1 });

module.exports = mongoose.model('Product', productSchema);
