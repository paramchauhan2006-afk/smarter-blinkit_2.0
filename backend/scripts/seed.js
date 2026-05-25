const mongoose = require('mongoose');
const neo4j = require('neo4j-driver');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const User = require('../models/User');
const Product = require('../models/Product');
const Store = require('../models/Store');
const Order = require('../models/Order');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smarter-blinkit';
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

const productsToSeed = [
  { name: "Pizza Dough", description: "Fresh dough for baking pizzas at home", price: 60, category: "bakery", barcode: "BARCODE-DOUGH-101" },
  { name: "Mozzarella Cheese", description: "Creamy, melty mozzarella cheese block", price: 150, category: "dairy", barcode: "BARCODE-CHEESE-102" },
  { name: "Tomato Sauce", description: "Tangy rich marinara tomato sauce", price: 80, category: "pantry", barcode: "BARCODE-SAUCE-103" },
  { name: "Pepperoni", description: "Slices of seasoned spicy pepperoni meat", price: 200, category: "meat", barcode: "BARCODE-PEP-104" },
  { name: "Flour", description: "All-purpose wheat flour for baking", price: 45, category: "pantry", barcode: "BARCODE-FLOUR-105" },
  { name: "Onions", description: "Fresh red onions sourced locally", price: 30, category: "produce", barcode: "BARCODE-ONION-106" },
  { name: "Pasta", description: "Premium durum wheat pasta penne", price: 50, category: "pantry", barcode: "BARCODE-PASTA-107" },
  { name: "Pasta Sauce", description: "Rich garlic and herb pasta sauce jar", price: 90, category: "pantry", barcode: "BARCODE-PSTSAUCE-108" },
  { name: "Parmesan", description: "Grated hard parmesan cheese", price: 180, category: "dairy", barcode: "BARCODE-PARM-109" },
  { name: "Lettuce", description: "Crisp and fresh green lettuce head", price: 40, category: "produce", barcode: "BARCODE-LETTUCE-110" },
  { name: "Tomatoes", description: "Ripe red vine tomatoes", price: 35, category: "produce", barcode: "BARCODE-TOMATO-111" },
  { name: "Cucumber", description: "Fresh and cool organic cucumber", price: 25, category: "produce", barcode: "BARCODE-CUCUMBER-112" },
  { name: "Salad Dressing", description: "Creamy Caesar salad dressing bottle", price: 75, category: "pantry", barcode: "BARCODE-DRESSING-113" },
  { name: "Tea Leaves", description: "Aromatic black tea leaves blend", price: 120, category: "beverages", barcode: "BARCODE-TEA-114" },
  { name: "Coffee Beans", description: "Medium roast coffee beans", price: 250, category: "beverages", barcode: "BARCODE-COFFEE-115" },
  { name: "Milk", description: "Fresh whole pasteurized milk bottle", price: 60, category: "dairy", barcode: "BARCODE-MILK-116" },
  { name: "Sugar", description: "Fine granulated white sugar pack", price: 40, category: "pantry", barcode: "BARCODE-SUGAR-117" },
  { name: "Paracetamol (500mg)", description: "Effective pain reliever and fever reducer for cold, flu, and fever symptoms", price: 20, category: "Wellness", barcode: "BARCODE-PARA-201" },
  { name: "Cough Syrup", description: "Soothes throat irritation and relieves cough and congestion from cold or ill health", price: 65, category: "Wellness", barcode: "BARCODE-COUGH-202" },
  { name: "Vitamin C", description: "Chewable daily immune booster supplements to fight off cold and keep ill health at bay", price: 90, category: "Wellness", barcode: "BARCODE-VITC-203" },
  { name: "Potato Chips", description: "Crispy salted potato chips perfect for snacks and munchies cravings", price: 30, category: "Snacks", barcode: "BARCODE-CHIPS-204" },
  { name: "Cheddar Crackers", description: "Baked cheese biscuits for satisfying snacks and munchies hunger", price: 40, category: "Snacks", barcode: "BARCODE-CRACKER-205" },
  { name: "Chocolate Bar", description: "Rich dairy milk chocolate bar for sweet snacks and munchies lovers", price: 50, category: "Snacks", barcode: "BARCODE-CHOCO-206" },
  { name: "Fresh Milk", description: "Pure fresh pasteurized dairy milk bottle", price: 60, category: "Dairy", barcode: "BARCODE-MILK-207" },
  { name: "Salted Butter", description: "Creamy rich salted dairy butter spread", price: 75, category: "Dairy", barcode: "BARCODE-BUTTER-208" },
  { name: "Brown Bread", description: "Freshly baked high fiber wheat brown bread loaf", price: 45, category: "Dairy", barcode: "BARCODE-BREAD-209" }
];

async function seed() {
  let driver;
  let neo4jConnected = false;
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected.');

    console.log('Connecting to Neo4j...');
    try {
      driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
      await driver.verifyConnectivity();
      neo4jConnected = true;
      console.log('Neo4j connected successfully.');
    } catch (err) {
      console.warn(`\n⚠ WARNING: Could not connect to Neo4j at ${NEO4J_URI}. Neo4j seeding will be skipped. Error: ${err.message}`);
      console.warn(`Please ensure your database instance "Movie DBMS" is actively running in Neo4j Desktop.\n`);
    }

    // 1. Clear existing data
    console.log('Clearing MongoDB collections...');
    await User.deleteMany({});
    await Product.deleteMany({});
    await Store.deleteMany({});
    await Order.deleteMany({});
    console.log('MongoDB collections cleared.');

    if (neo4jConnected) {
      console.log('Clearing Neo4j nodes...');
      const clearSession = driver.session();
      try {
        await clearSession.run('MATCH (n) DETACH DELETE n');
        console.log('Neo4j database cleared.');
      } finally {
        await clearSession.close();
      }
    }

    // Ensure Mongo Indexes (specifically 2dsphere index for geolocation)
    await Store.createIndexes();
    await Order.createIndexes();
    console.log('MongoDB Indexes ensured.');

    // 2. Hash passwords and create users
    console.log('Creating users...');
    const passwordHash = await bcrypt.hash('password', 10);
    
    const buyer = await User.create({
      name: "John Buyer",
      email: "buyer@example.com",
      password: passwordHash,
      role: "buyer"
    });

    const seller1 = await User.create({
      name: "SuperMart Owner",
      email: "seller1@example.com",
      password: passwordHash,
      role: "seller"
    });

    const seller2 = await User.create({
      name: "CornerGrocer Owner",
      email: "seller2@example.com",
      password: passwordHash,
      role: "seller"
    });
    console.log(`Users created: ${buyer.email}, ${seller1.email}, ${seller2.email}`);

    // 3. Create products in Mongo and Neo4j (fetching embeddings)
    console.log('Creating products and embeddings...');
    const seededProducts = [];
    
    for (const p of productsToSeed) {
      // Create product in MongoDB
      const mongoProduct = await Product.create(p);
      seededProducts.push(mongoProduct);

      // Fetch embedding from FastAPI
      let embedding = Array(384).fill(0).map(() => Math.random() - 0.5); // Fallback
      try {
        const aiResponse = await axios.post(`${FASTAPI_URL}/api/embeddings/encode`, { text: p.name });
        if (aiResponse.data && aiResponse.data.embedding) {
          embedding = aiResponse.data.embedding;
          console.log(`✓ Fetched embedding for: "${p.name}"`);
        }
      } catch (err) {
        console.warn(`⚠ Could not fetch embedding for "${p.name}", using fallback random vector. Error: ${err.message}`);
      }

      // Create product node in Neo4j (storing both id and productId to maintain compatibility)
      if (neo4jConnected) {
        const neoSession = driver.session();
        try {
          await neoSession.run(`
            MERGE (n:Product {id: $id})
            SET n.productId = $id,
                n.name = $name,
                n.category = $category,
                n.embedding = $embedding
          `, {
            id: mongoProduct._id.toString(),
            name: p.name,
            category: p.category,
            embedding: embedding
          });
        } catch (err) {
          console.warn(`⚠ Neo4j product insert failed for "${p.name}": ${err.message}`);
        } finally {
          await neoSession.close();
        }
      }
    }
    console.log(`Successfully seeded ${seededProducts.length} products in MongoDB.`);

    // 4. Create Stores and Inventories near MNIT Jaipur (coordinates: [lng, lat])
    // MNIT Jaipur center: lat = 26.8631, lng = 75.8105
    console.log('Creating stores and inventory...');
    
    // Store 1: carries all products with high stock
    const store1Inventory = seededProducts.map((p, idx) => ({
      productId: p._id,
      barcode: p.barcode,
      stock: 50 + idx
    }));

    const store1 = await Store.create({
      name: "SuperMart Groceries",
      sellerId: seller1._id,
      location: {
        type: 'Point',
        coordinates: [75.8120, 26.8640] // ~300m North-East
      },
      inventory: store1Inventory,
      rating: 4.8
    });

    // Store 2: carries only a subset (dairy, produce, beverages, Wellness, Snacks, Dairy) with lower stock
    const store2Inventory = seededProducts
      .filter(p => ["dairy", "produce", "beverages", "Wellness", "Snacks", "Dairy"].includes(p.category))
      .map((p, idx) => ({
        productId: p._id,
        barcode: p.barcode,
        stock: 15 + idx
      }));

    const store2 = await Store.create({
      name: "Corner Grocer",
      sellerId: seller2._id,
      location: {
        type: 'Point',
        coordinates: [75.8080, 26.8615] // ~400m South-West
      },
      inventory: store2Inventory,
      rating: 4.3
    });
    console.log(`Stores created: "${store1.name}" and "${store2.name}"`);

    // 5. Create Neo4j Relationships
    if (neo4jConnected) {
      console.log('Creating Neo4j recommendation relationships...');
      const relSession = driver.session();
      try {
        // Create SIMILAR_TO links for products in the same category
        await relSession.run(`
          MATCH (p1:Product), (p2:Product)
          WHERE p1.id <> p2.id AND p1.category = p2.category
          MERGE (p1)-[:SIMILAR_TO]-(p2)
        `);
        console.log('✓ Linked SIMILAR_TO relationships.');

        // Helper function to link BOUGHT_WITH
        const linkBoughtWith = async (name1, name2, weight) => {
          const p1 = seededProducts.find(p => p.name === name1);
          const p2 = seededProducts.find(p => p.name === name2);
          if (p1 && p2) {
            await relSession.run(`
              MATCH (prod1:Product {id: $id1})
              MATCH (prod2:Product {id: $id2})
              MERGE (prod1)-[r:BOUGHT_WITH]-(prod2)
              SET r.weight = $weight
            `, {
              id1: p1._id.toString(),
              id2: p2._id.toString(),
              weight: weight
            });
          }
        };

        // Seed BOUGHT_WITH connections
        await linkBoughtWith("Pizza Dough", "Tomato Sauce", 5);
        await linkBoughtWith("Tomato Sauce", "Mozzarella Cheese", 4);
        await linkBoughtWith("Mozzarella Cheese", "Pepperoni", 3);
        await linkBoughtWith("Coffee Beans", "Sugar", 5);
        await linkBoughtWith("Coffee Beans", "Milk", 4);
        await linkBoughtWith("Tea Leaves", "Sugar", 5);
        await linkBoughtWith("Tea Leaves", "Milk", 4);
        await linkBoughtWith("Pasta", "Pasta Sauce", 5);
        await linkBoughtWith("Pasta Sauce", "Parmesan", 3);
        await linkBoughtWith("Lettuce", "Tomatoes", 4);
        await linkBoughtWith("Lettuce", "Cucumber", 3);
        await linkBoughtWith("Lettuce", "Salad Dressing", 4);
        console.log('✓ Linked BOUGHT_WITH relationships.');
      } catch (err) {
        console.warn(`⚠ Neo4j relationship creation failed: ${err.message}`);
      } finally {
        await relSession.close();
      }
    }

    console.log('Database seeding process completed successfully!');
  } catch (error) {
    console.error('Seeding failed with error:', error);
  } finally {
    if (mongoose.connection) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
    }
    if (driver) {
      await driver.close();
      console.log('Neo4j driver connection closed.');
    }
    process.exit(0);
  }
}

seed();
