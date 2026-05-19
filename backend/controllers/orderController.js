const Razorpay = require('razorpay');

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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  // Dummy verification for Stage 1
  if (razorpay_order_id && razorpay_payment_id) {
    res.json({ message: 'Payment verified successfully', status: 'Paid' });
  } else {
    res.status(400).json({ message: 'Payment verification failed' });
  }
};
