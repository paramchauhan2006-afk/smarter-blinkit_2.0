const Store = require('../models/Store');
const Product = require('../models/Product');
const axios = require('axios');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

exports.buildRecipeCart = async (req, res) => {
  let { prompt, lat, lng } = req.body;
  if (!prompt) return res.status(400).json({ message: 'Prompt is required' });

  // Fallback to default coordinates (e.g., Jaipur/MNIT area) if missing
  if (!lat || !lng) {
    lat = 26.8631;
    lng = 75.8105;
  }

  try {
    // Dynamic Geolocation Shift: Cluster stores around the user if they are far away
    const store1 = await Store.findOne({ name: "SuperMart Groceries" });
    if (store1) {
      const storeLng = store1.location.coordinates[0];
      const storeLat = store1.location.coordinates[1];
      const distance = Math.sqrt(Math.pow(storeLng - parseFloat(lng), 2) + Math.pow(storeLat - parseFloat(lat), 2));
      // If distance is greater than ~0.1 degrees (about 11km), shift stores to center near user
      if (distance > 0.1) {
        const allStores = await Store.find({});
        const offsets = [
          [0.012, 0.008],  // ~1.5 km North-East
          [-0.009, -0.011] // ~1.2 km South-West
        ];
        for (let i = 0; i < allStores.length; i++) {
          const offset = offsets[i % offsets.length];
          allStores[i].location = {
            type: 'Point',
            coordinates: [parseFloat(lng) + offset[0], parseFloat(lat) + offset[1]]
          };
          await allStores[i].save();
        }
        console.log(`Dynamic Store Relocation (Recipe): Shifted stores to center near user's reported location (${lat}, ${lng}).`);
      }
    }

    let items = [];
    try {
      const aiResponse = await axios.post(`${FASTAPI_URL}/api/ai/recipe`, { prompt });
      items = aiResponse.data.items;
    } catch (err) {
      console.warn('FastAPI recipe builder failed or offline. Using local regex/keyword parser fallback. Error:', err.message);
      
      const promptLower = prompt.toLowerCase();
      // Match number of people
      const peopleMatch = promptLower.match(/for (\d+)/);
      const people = peopleMatch ? parseInt(peopleMatch[1], 10) : 2;
      const scaleFactor = Math.max(1, Math.floor(people / 2));

      // Simple keyword matching for blueprint
      const blueprints = {
        pizza: [{ name: "Pizza Dough", qty: 1 }, { name: "Tomato Sauce", qty: 1 }, { name: "Mozzarella Cheese", qty: 2 }],
        pasta: [{ name: "Pasta", qty: 1 }, { name: "Pasta Sauce", qty: 1 }, { name: "Parmesan", qty: 1 }],
        salad: [{ name: "Lettuce", qty: 1 }, { name: "Tomatoes", qty: 2 }, { name: "Cucumber", qty: 1 }, { name: "Salad Dressing", qty: 1 }],
        tea: [{ name: "Tea Leaves", qty: 1 }, { name: "Milk", qty: 1 }, { name: "Sugar", qty: 1 }],
        coffee: [{ name: "Coffee Beans", qty: 1 }, { name: "Milk", qty: 1 }, { name: "Sugar", qty: 1 }]
      };

      // Find best match based on simple keyword search
      let bestMatch = null;
      for (const key of Object.keys(blueprints)) {
        if (promptLower.includes(key)) {
          bestMatch = key;
          break;
        }
      }

      if (bestMatch) {
        items = blueprints[bestMatch].map(item => ({
          name: item.name,
          quantity: item.qty * scaleFactor
        }));
      } else {
        // Fallback: search database for products matching the words in the prompt
        const words = promptLower.split(' ').filter(w => w.length > 3);
        if (words.length > 0) {
          const matchedDbProducts = await Product.find({
            $or: words.map(w => ({ name: { $regex: w, $options: 'i' } }))
          }).limit(4);
          
          if (matchedDbProducts.length > 0) {
            items = matchedDbProducts.map(p => ({
              name: p.name,
              quantity: 1
            }));
          }
        }
      }

      // If still no items matched, fall back to default pizza blueprint
      if (items.length === 0) {
        items = blueprints.pizza.map(item => ({
          name: item.name,
          quantity: item.qty * scaleFactor
        }));
      }
    }

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
