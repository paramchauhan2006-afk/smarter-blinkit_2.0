const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config({ path: '../.env' });
const { connectMongoDB, connectNeo4j } = require('./config/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set('io', io);

const PORT = process.env.PORT || 5000;

// Socket metrics
let activeUsers = 0;

io.on('connection', (socket) => {
  activeUsers++;
  io.emit('global_metrics_update', { activeUsers });
  
  socket.on('join_store', (storeId) => {
    socket.join(`room_${storeId}`);
    console.log(`Socket joined store room: ${storeId}`);
  });

  socket.on('disconnect', () => {
    activeUsers--;
    io.emit('global_metrics_update', { activeUsers });
  });
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
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
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();
