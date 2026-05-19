const Product = require('../models/Product');
const Store = require('../models/Store');
const axios = require('axios');
const { getNeo4jSession } = require('../config/db');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

exports.searchProducts = async (req, res) => {
  const { query, lat, lng } = req.query;
  if (!query) return res.status(400).json({ message: 'Query is required' });

  try {
    // 1. Get embedding
    const aiResponse = await axios.post(`${FASTAPI_URL}/api/embeddings/encode`, { text: query });
    const queryEmbedding = aiResponse.data.embedding;

    // 2. Query Neo4j vector index
    const session = getNeo4jSession();
    const result = await session.run(`
      CALL db.index.vector.queryNodes('product_embedding', 10, $embedding)
      YIELD node, score
      RETURN node.productId AS productId, score
    `, { embedding: queryEmbedding });
    
    await session.close();

    const matchedProductIds = result.records.map(record => record.get('productId'));

    if (matchedProductIds.length === 0) {
      return res.json([]);
    }

    // 3. Query MongoDB with GeoNear if lat/lng are provided
    let stores = [];
    if (lat && lng) {
      stores = await Store.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            distanceField: 'distance',
            spherical: true
          }
        },
        {
          $match: { 'inventory.productId': { $in: matchedProductIds } }
        }
      ]);
    } else {
      stores = await Store.find({ 'inventory.productId': { $in: matchedProductIds } });
    }

    // Combine store distance info with product info
    const finalProducts = [];
    for (const store of stores) {
      for (const item of store.inventory) {
        if (matchedProductIds.includes(item.productId.toString()) && item.stock > 0) {
          const product = await Product.findById(item.productId);
          finalProducts.push({
            store: { id: store._id, name: store.name, distance: store.distance },
            product,
            stock: item.stock
          });
        }
      }
    }

    res.json(finalProducts);
  } catch (error) {
    console.error('Search Error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};
