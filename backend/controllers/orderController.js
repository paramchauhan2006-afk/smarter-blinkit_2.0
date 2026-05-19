const Razorpay = require('razorpay');
const { getNeo4jSession } = require('../config/db');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'test_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_key_secret',
});

exports.createOrder = async (req, res) => {
  const { amount } = req.body;
  
  const options = {
    amount: amount * 100, // Amount in paise
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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, cartItems } = req.body;
  // Dummy verification for Stage 1 & 2
  if (razorpay_order_id && razorpay_payment_id) {
    if (cartItems && cartItems.length > 1) {
      const session = getNeo4jSession();
      try {
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
        await session.close();
      }
    }
    res.json({ message: 'Payment verified successfully', status: 'Paid' });
  } else {
    res.status(400).json({ message: 'Payment verification failed' });
  }
};
