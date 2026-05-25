const mongoose = require('mongoose');
const neo4j = require('neo4j-driver');
require('dotenv').config({ path: '../../.env' });

// MongoDB Connection
const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/smarter-blinkit';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.log('Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectMongoDB, 5000);
  }
};

// Neo4j Connection
let neo4jDriver;
const connectNeo4j = async () => {
  try {
    const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const neo4jUser = process.env.NEO4J_USER || 'neo4j';
    const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';
    
    neo4jDriver = neo4j.driver(
      neo4jUri,
      neo4j.auth.basic(neo4jUser, neo4jPassword)
    );
    await neo4jDriver.verifyConnectivity();
    console.log('Neo4j connected successfully');
    await initializeNeo4jIndexes();
  } catch (error) {
    console.error('Neo4j connection error:', error.message);
    console.log('Continuing without Neo4j. Features relying on Neo4j will be disabled.');
  }
};

const initializeNeo4jIndexes = async () => {
  const session = neo4jDriver.session();
  try {
    await session.run(`
      CREATE VECTOR INDEX product_embedding IF NOT EXISTS
      FOR (p:Product) ON (p.embedding)
      OPTIONS { indexConfig: {
        \`vector.dimensions\`: 384,
        \`vector.similarity_function\`: 'cosine'
      }}
    `);
    console.log('Neo4j vector index initialized');
  } catch (error) {
    console.error('Failed to initialize Neo4j indexes:', error);
  } finally {
    await session.close();
  }
};

const getNeo4jSession = () => {
  try {
    if (!neo4jDriver) {
      throw new Error('Neo4j driver not initialized');
    }
    return neo4jDriver.session();
  } catch (error) {
    console.error('Error getting Neo4j session:', error.message);
    return null;
  }
};

module.exports = { connectMongoDB, connectNeo4j, getNeo4jSession };
