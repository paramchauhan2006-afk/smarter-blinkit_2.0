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
    console.error('MongoDB connection error:', error);
    process.exit(1);
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
  } catch (error) {
    console.error('Neo4j connection error:', error);
    // process.exit(1); // Optional: don't exit if Neo4j is not strictly required initially
  }
};

const getNeo4jSession = () => {
  if (!neo4jDriver) {
    throw new Error('Neo4j driver not initialized');
  }
  return neo4jDriver.session();
};

module.exports = { connectMongoDB, connectNeo4j, getNeo4jSession };
