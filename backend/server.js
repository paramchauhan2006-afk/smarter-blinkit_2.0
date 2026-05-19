const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });
const { connectMongoDB, connectNeo4j } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Route Imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
const { seedSimilarProducts } = require('./controllers/productController');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('Smarter Blinkit Backend is running...');
});

// Start Server
const startServer = async () => {
  try {
    await connectMongoDB();
    await connectNeo4j();
    await seedSimilarProducts();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();
