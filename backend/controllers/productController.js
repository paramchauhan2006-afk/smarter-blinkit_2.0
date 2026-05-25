const Product = require('../models/Product');
const Store = require('../models/Store');
const axios = require('axios');
const mongoose = require('mongoose');
const { getNeo4jSession } = require('../config/db');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

exports.searchProducts = async (req, res) => {
  let { query, lat, lng } = req.query;
  if (!query) return res.status(400).json({ message: 'Query is required' });

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
        console.log(`Dynamic Store Relocation: Shifted stores to center near user's reported location (${lat}, ${lng}).`);
      }
    }

    // 1. Get embedding (FastAPI fallback friendly)
    let queryEmbedding = null;
    try {
      const aiResponse = await axios.post(`${FASTAPI_URL}/api/embeddings/encode`, { text: query });
      queryEmbedding = aiResponse.data.embedding;
    } catch (err) {
      console.warn('FastAPI embedding generation failed or offline. Falling back to MongoDB text search.');
    }

    // 2. Query Neo4j vector index with MongoDB text fallback if Neo4j is offline/fails
    let matchedProductIds = [];
    let neo4jSuccess = false;

    if (queryEmbedding) {
      try {
        const session = getNeo4jSession();
        if (session) {
          const result = await session.run(`
            CALL db.index.vector.queryNodes('product_embedding', 10, $embedding)
            YIELD node, score
            RETURN node.productId AS productId, score
          `, { embedding: queryEmbedding });
          
          await session.close();
          matchedProductIds = result.records.map(record => record.get('productId')).filter(id => id);
          neo4jSuccess = true;
        }
      } catch (error) {
        console.warn('Neo4j connection or query failed. Falling back to MongoDB text search. Error:', error.message);
      }
    }

    // Fallback: If Neo4j was unsuccessful or returned no matches, query MongoDB directly
    if (!neo4jSuccess || matchedProductIds.length === 0) {
      const keywords = query.split(' ').filter(k => k.length > 2);
      const regexQueries = keywords.length > 0 
        ? keywords.map(k => new RegExp(k, 'i')) 
        : [new RegExp(query, 'i')];
      
      const fallbackProducts = await Product.find({
        $or: [
          { name: { $in: regexQueries } },
          { category: { $in: regexQueries } },
          { description: { $in: regexQueries } }
        ]
      });
      matchedProductIds = fallbackProducts.map(p => p._id.toString());
    }

    if (matchedProductIds.length === 0) {
      return res.json([]);
    }

    // 3. Query MongoDB with GeoNear using provided or fallback coordinates
    let stores = await Store.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          distanceField: 'distance',
          spherical: true
        }
      },
      {
        $match: { 'inventory.productId': { $in: matchedProductIds.map(id => new mongoose.Types.ObjectId(id)) } }
      }
    ]);

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

exports.seedSimilarProducts = async () => {
  let session;
  try {
    const products = await Product.find({});
    session = getNeo4jSession();
    
    // Ensure nodes exist
    for (const p of products) {
      await session.run(`
        MERGE (n:Product {id: $id})
        SET n.category = $category, n.name = $name
      `, { id: p._id.toString(), category: p.category || 'general', name: p.name });
    }
    
    // Link similar
    await session.run(`
      MATCH (p1:Product), (p2:Product)
      WHERE p1.id <> p2.id AND p1.category = p2.category
      MERGE (p1)-[:SIMILAR_TO]-(p2)
    `);
    
    console.log('Neo4j SIMILAR_TO relationships seeded.');
  } catch (err) {
    console.error('Error seeding Neo4j:', err);
  } finally {
    if (session) await session.close();
  }
};

exports.getRecommendations = async (req, res) => {
  const { id } = req.params;
  let session;
  try {
    session = getNeo4jSession();
    
    const similarRes = await session.run(`
      MATCH (p:Product {id: $id})-[:SIMILAR_TO]-(rec:Product)
      RETURN rec.id AS recId LIMIT 3
    `, { id });
    
    const boughtRes = await session.run(`
      MATCH (p:Product {id: $id})-[r:BOUGHT_WITH]-(rec:Product)
      RETURN rec.id AS recId, r.weight AS weight
      ORDER BY weight DESC LIMIT 3
    `, { id });
    
    const similarIds = similarRes.records.map(r => r.get('recId'));
    const boughtIds = boughtRes.records.map(r => r.get('recId'));
    
    const similarProducts = await Product.find({ _id: { $in: similarIds } });
    const boughtProducts = await Product.find({ _id: { $in: boughtIds } });
    
    res.json({ similar: similarProducts, boughtWith: boughtProducts });
  } catch (error) {
    console.error('Recommendation Error:', error);
    res.status(500).json({ message: 'Server Error' });
  } finally {
    if (session) await session.close();
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const topProducts = await Product.find().sort({ salesCount: -1 }).limit(3);
    const topStores = await Store.find().sort({ rating: -1 }).limit(3);
    res.json({ products: topProducts, stores: topStores });
  } catch (error) {
    console.error('Leaderboard Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.getPairingPrediction = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    
    let predictions = [];
    try {
      const aiRes = await axios.post(`${process.env.FASTAPI_URL || 'http://localhost:8000'}/api/ai/predict-pairing`, {
        target_item: product.name
      });
      predictions = aiRes.data.predictions;
    } catch (err) {
      console.warn('FastAPI predict-pairing failed or offline. Using local pairing rules fallback. Error:', err.message);
      
      const associationRules = {
        chips: ["soda", "dip", "salsa", "cookies"],
        bread: ["butter", "eggs", "milk", "jam"],
        milk: ["bread", "eggs", "cereal", "coffee"],
        pizza: ["soda", "ice cream", "garlic bread"],
        pasta: ["cheese", "wine", "tomato sauce"]
      };

      const target = product.name.toLowerCase();
      for (const [key, pairs] of Object.entries(associationRules)) {
        if (target.includes(key)) {
          predictions.push(...pairs);
        }
      }

      if (predictions.length === 0) {
        predictions = ["chips", "soda", "chocolate"];
      }
      predictions = [...new Set(predictions)].slice(0, 3);
    }
    
    res.json({ predictions });
  } catch (error) {
    console.error('AI Pairing general error:', error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};
