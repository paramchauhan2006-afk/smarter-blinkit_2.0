import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BuyerDashboard = () => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [location, setLocation] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => console.error('Geolocation Error:', err)
      );
    }
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query) return;
    setLoading(true);
    try {
      let url = `http://localhost:5000/api/products/search?query=${encodeURIComponent(query)}`;
      if (location) {
        url += `&lat=${location.lat}&lng=${location.lng}`;
      }
      const res = await axios.get(url);
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const addToCart = (product) => {
    setCart([...cart, product]);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty!');
    const amount = cart.reduce((total, item) => total + item.product.price, 0);

    try {
      const { data: order } = await axios.post('http://localhost:5000/api/orders/create', { amount });

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY || 'test_key_id', // Replace with valid test key if needed
        amount: order.amount,
        currency: order.currency,
        name: 'Smarter Blinkit',
        description: 'Test Transaction',
        order_id: order.id,
        handler: async function (response) {
          try {
            await axios.post('http://localhost:5000/api/orders/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            alert('Payment Successful!');
            setCart([]);
          } catch (err) {
            alert('Payment verification failed');
          }
        },
        theme: { color: '#f8cb46' }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert('Failed to initiate checkout. Please ensure you have configured Razorpay test keys properly or the backend is running.');
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-1">
        <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
          <h2 className="text-2xl font-bold mb-4">What do you need today?</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g. 'I have a cold' or 'Snacks for a movie'" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <button type="submit" disabled={loading} className="bg-primary px-6 py-3 rounded-lg font-bold shadow-sm hover:bg-yellow-400 transition-colors">
              {loading ? 'Thinking...' : 'Search Intents'}
            </button>
          </form>
          {location && <p className="text-sm text-green-600 mt-2 font-medium">✓ Location active for nearest delivery optimization</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all relative">
              <div className="h-40 bg-yellow-50 flex items-center justify-center">
                 <span className="text-5xl">🛍️</span>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-secondary mb-1">{item.product.name}</h3>
                <p className="text-sm text-gray-500 mb-4 h-10 overflow-hidden line-clamp-2">{item.product.description}</p>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-black text-secondary">₹{item.product.price}</p>
                    <p className="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-wide">
                      {item.store.name} 
                      {item.store.distance !== undefined && ` • ${Math.round(item.store.distance)}m away`}
                    </p>
                  </div>
                  <button 
                    onClick={() => addToCart(item)}
                    className="bg-primary text-black w-12 h-12 rounded-full font-black text-2xl flex items-center justify-center shadow-sm hover:bg-yellow-400 hover:scale-105 transition-transform"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
          {products.length === 0 && !loading && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
              <span className="text-6xl mb-4">✨</span>
              <p className="text-lg font-medium text-gray-500">Search to see magical intent results!</p>
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-80 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit sticky top-24">
        <h3 className="text-xl font-bold mb-4 border-b pb-2 flex justify-between items-center">
          Your Cart <span className="text-primary bg-yellow-50 px-2 py-1 rounded-md text-sm">{cart.length}</span>
        </h3>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <span className="text-4xl mb-2">🛒</span>
            <p className="text-sm">Cart is empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-60 overflow-y-auto pr-2 space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm items-center bg-gray-50 p-2 rounded-lg">
                  <span className="font-medium">{item.product.name}</span>
                  <span className="font-bold text-secondary">₹{item.product.price}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 flex justify-between font-bold text-lg">
              <span>Total Amount</span>
              <span className="text-secondary">₹{cart.reduce((t, i) => t + i.product.price, 0)}</span>
            </div>
            <button 
              onClick={handleCheckout}
              className="w-full bg-secondary text-white py-3 rounded-lg font-bold mt-4 hover:bg-accent transition-colors shadow-md"
            >
              Proceed to Pay
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerDashboard;
