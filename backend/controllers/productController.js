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

exports.seedSimilarProducts = async () => {
  try {
    const products = await Product.find({});
    const session = getNeo4jSession();
    
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
    
    await session.close();
    console.log('Neo4j SIMILAR_TO relationships seeded.');
  } catch (err) {
    console.error('Error seeding Neo4j:', err);
  }
};

exports.getRecommendations = async (req, res) => {
  const { id } = req.params;
  try {
    const session = getNeo4jSession();
    
    const similarRes = await session.run(`
      MATCH (p:Product {id: $id})-[:SIMILAR_TO]-(rec:Product)
      RETURN rec.id AS recId LIMIT 3
    `, { id });
    
    const boughtRes = await session.run(`
      MATCH (p:Product {id: $id})-[r:BOUGHT_WITH]-(rec:Product)
      RETURN rec.id AS recId, r.weight AS weight
      ORDER BY weight DESC LIMIT 3
    `, { id });
    
    await session.close();
    
    const similarIds = similarRes.records.map(r => r.get('recId'));
    const boughtIds = boughtRes.records.map(r => r.get('recId'));
    
    const similarProducts = await Product.find({ _id: { $in: similarIds } });
    const boughtProducts = await Product.find({ _id: { $in: boughtIds } });
    
    res.json({ similar: similarProducts, boughtWith: boughtProducts });
  } catch (error) {
    console.error('Recommendation Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
