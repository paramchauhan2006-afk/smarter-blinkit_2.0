const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  category: { type: String },
  barcode: { type: String, required: true, unique: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
