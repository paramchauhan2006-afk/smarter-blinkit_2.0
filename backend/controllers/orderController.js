const Razorpay = require('razorpay');
const { getNeo4jSession } = require('../config/db');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Store = require('../models/Store');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'test_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_key_secret',
});

exports.createOrder = async (req, res) => {
  const { amount, cartItems } = req.body;
  
  const options = {
    amount: Math.round(amount * 100), // Amount in paise
    currency: 'INR',
    receipt: 'receipt_order_' + Math.floor(Math.random() * 1000)
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('Razorpay Error:', error);
    res.status(500).json({ message: 'Payment initiation failed' });
  }
};

exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, cartItems, lat, lng } = req.body;
  
  if (razorpay_order_id && razorpay_payment_id) {
    
    // Stage 3: Cart Splitting and Logistics
    if (cartItems && cartItems.length > 0) {
      try {
        const storeGroups = {};
        let totalAmount = 0;

        // Group by store
        cartItems.forEach(item => {
          const storeId = item.store.id;
          if (!storeGroups[storeId]) {
            storeGroups[storeId] = { storeId, items: [] };
          }
          const price = item.product.price;
          const qty = item.quantity || 1;
          totalAmount += (price * qty);
          storeGroups[storeId].items.push({
            productId: item.product._id,
            quantity: qty,
            price: price
          });
        });

        const subOrders = Object.values(storeGroups);

        let deliveryLocation = undefined;
        if (lat && lng) {
          deliveryLocation = {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          };
        }

        // Save Order
        const newOrder = await Order.create({
          buyerId: req.user ? req.user.id : null,
          totalAmount,
          status: 'Paid',
          subOrders,
          deliveryLocation
        });

        // Update Inventory & Sales Count
        const io = req.app.get('io');
        
        for (const sub of subOrders) {
          const store = await Store.findById(sub.storeId);
          if (store) {
            let lowStockItems = [];
            for (const subItem of sub.items) {
              // Increment sales count
              await Product.findByIdAndUpdate(subItem.productId, { $inc: { salesCount: subItem.quantity } });
              
              // Decrement stock
              const invIndex = store.inventory.findIndex(inv => inv.productId.toString() === subItem.productId.toString());
              if (invIndex > -1) {
                store.inventory[invIndex].stock -= subItem.quantity;
                if (store.inventory[invIndex].stock < 5) {
                  lowStockItems.push(subItem.productId);
                }
              }
            }
            await store.save();

            // Emit WebSockets
            if (io) {
              io.to(`room_${sub.storeId}`).emit('new_order', {
                orderId: newOrder._id,
                items: sub.items
              });

              if (lowStockItems.length > 0) {
                io.to(`room_${sub.storeId}`).emit('low_stock', {
                  productIds: lowStockItems,
                  message: 'Some items are running low on stock!'
                });
              }
            }
          }
        }
        
        // Notify all clients to update leaderboard
        if (io) io.emit('leaderboard_update');

      } catch (err) {
        console.error('Order processing error:', err);
      }

      // Stage 2: Neo4j BOUGHT_WITH Relationships
      if (cartItems.length > 1) {
        let session;
        try {
          session = getNeo4jSession();
          const productIds = cartItems.map(item => item.product._id.toString());
          for (let i = 0; i < productIds.length; i++) {
            for (let j = i + 1; j < productIds.length; j++) {
              if (productIds[i] !== productIds[j]) {
                await session.run(`
                  MERGE (p1:Product {id: $id1})
                  MERGE (p2:Product {id: $id2})
                  MERGE (p1)-[r:BOUGHT_WITH]-(p2)
                  ON CREATE SET r.weight = 1
                  ON MATCH SET r.weight = r.weight + 1
                `, { id1: productIds[i], id2: productIds[j] });
              }
            }
          }
        } catch (err) {
          console.error('Neo4j order hook error:', err);
        } finally {
          if (session) await session.close();
        }
      }
    }

    res.json({ message: 'Payment verified successfully', status: 'Paid' });
  } else {
    res.status(400).json({ message: 'Payment verification failed' });
  }
};

exports.getMoneyMap = async (req, res) => {
  try {
    const orders = await Order.aggregate([
      { $match: { status: 'Paid', 'deliveryLocation.coordinates': { $exists: true, $ne: [] } } },
      {
        $group: {
          _id: {
            lat: { $round: [{ $arrayElemAt: ['$deliveryLocation.coordinates', 1] }, 2] },
            lng: { $round: [{ $arrayElemAt: ['$deliveryLocation.coordinates', 0] }, 2] }
          },
          totalRevenue: { $sum: '$totalAmount' },
          ordersCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          location: '$_id',
          totalRevenue: 1,
          ordersCount: 1
        }
      }
    ]);
    res.json(orders);
  } catch (error) {
    console.error('Money Map Error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
};
