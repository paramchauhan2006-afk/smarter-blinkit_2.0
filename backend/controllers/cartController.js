const Store = require('../models/Store');
const Product = require('../models/Product');
const axios = require('axios');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

exports.buildRecipeCart = async (req, res) => {
  const { prompt, lat, lng } = req.body;
  if (!prompt || !lat || !lng) return res.status(400).json({ message: 'Prompt and location required' });

  try {
    const aiResponse = await axios.post(`${FASTAPI_URL}/api/ai/recipe`, { prompt });
    const { items } = aiResponse.data;

    let cartItems = [];

    for (const item of items) {
      // Find matching products by name (simple regex search)
      const products = await Product.find({ name: { $regex: item.name.split(' ')[0], $options: 'i' } });
      if (products.length === 0) continue;
      
      const productIds = products.map(p => p._id);

      // Find nearest store with stock
      const stores = await Store.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            distanceField: 'distance',
            spherical: true
          }
        },
        {
          $match: { 'inventory.productId': { $in: productIds } }
        },
        { $limit: 1 }
      ]);

      if (stores.length > 0) {
        const store = stores[0];
        // Find which product it was
        for (const invItem of store.inventory) {
          if (productIds.some(id => id.equals(invItem.productId)) && invItem.stock > 0) {
            const product = products.find(p => p._id.equals(invItem.productId));
            cartItems.push({
              product,
              store: { id: store._id, name: store.name, distance: store.distance },
              quantity: item.quantity
            });
            break;
          }
        }
      }
    }

    res.json({ message: 'Recipe parsed', cartItems });
  } catch (error) {
    console.error('Recipe Cart Error:', error.message);
    res.status(500).json({ message: 'Failed to build recipe cart' });
  }
};
