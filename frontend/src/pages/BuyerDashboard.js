import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BuyerDashboard = () => {
  const [query, setQuery] = useState('');
  const [recipePrompt, setRecipePrompt] = useState('');
  const [products, setProducts] = useState([]);
  const [location, setLocation] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [recommendations, setRecommendations] = useState({ similar: [], boughtWith: [] });
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [recipeResults, setRecipeResults] = useState([]);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'Buyer', email: '' };

  useEffect(() => {
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

  const handleRecipeBuilder = async (e) => {
    e.preventDefault();
    if (!recipePrompt) return alert('Enter recipe!');
    if (!location) return alert('Please enable location to find nearest ingredients.');
    
    setRecipeLoading(true);
    setRecipeResults([]);
    try {
      const res = await axios.post('http://localhost:5000/api/cart/recipe', {
        prompt: recipePrompt,
        lat: location.lat,
        lng: location.lng
      });
      const newItems = res.data.cartItems || [];
      if (newItems.length === 0) {
        alert('No matching ingredients found for this recipe.');
      } else {
        setRecipeResults(newItems);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to build recipe. Please try "Make Pizza for 4 people".');
    }
    setRecipeLoading(false);
  };

  const addToCart = (productObj) => {
    setCart([...cart, productObj]);
  };

  const addRecipeItemToCart = (item) => {
    const itemsToAdd = Array(item.quantity).fill(null).map(() => ({
      product: item.product,
      store: item.store
    }));
    setCart(prev => [...prev, ...itemsToAdd]);
    alert(`Added ${item.quantity} x ${item.product.name} to cart!`);
  };

  const addAllRecipeItemsToCart = () => {
    let itemsToAdd = [];
    recipeResults.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        itemsToAdd.push({
          product: item.product,
          store: item.store
        });
      }
    });
    setCart(prev => [...prev, ...itemsToAdd]);
    alert(`Added all ${itemsToAdd.length} recipe items to cart!`);
    setRecipeResults([]);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Purge cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    navigate('/login');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('Cart is empty!');
    const amount = cart.reduce((total, item) => total + item.product.price, 0);

    setCheckoutLoading(true);
    try {
      const { data: order } = await axios.post('http://localhost:5000/api/orders/create', { amount, cartItems: cart });

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY || 'test_key_id',
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
              razorpay_signature: response.razorpay_signature,
              cartItems: cart,
              lat: location ? location.lat : null,
              lng: location ? location.lng : null
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
      rzp.on('payment.failed', function (response){
        alert('Payment failed');
      });
      rzp.open();
      setCheckoutLoading(false);
    } catch (err) {
      console.error(err);
      alert('Failed to initiate checkout.');
      setCheckoutLoading(false);
    }
  };

  const toggleExpand = async (item) => {
    if (expandedProduct === item.product._id) {
      setExpandedProduct(null);
      return;
    }
    setExpandedProduct(item.product._id);
    setRecommendations({ similar: [], boughtWith: [] });
    setRecommendationLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/products/${item.product._id}/recommendations`);
      setRecommendations(res.data);
    } catch (err) {
      console.error('Recommendations error', err);
    }
    setRecommendationLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Navigation Utility Bar */}
      <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-black shadow-sm">
            {user.name ? user.name.charAt(0).toUpperCase() : 'B'}
          </div>
          <div>
            <p className="text-sm font-semibold text-secondary">Logged in as</p>
            <p className="text-xs text-gray-500 font-bold">{user.name} ({user.email})</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-xs font-semibold text-gray-400">GEOLOCATION STATUS</p>
            <p className="text-xs font-bold text-green-600">
              {location ? `📍 MNIT Area Active (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})` : '🔍 Fetching location...'}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-rose-500 text-white rounded-lg font-bold text-sm shadow-md hover:bg-rose-600 active:scale-95 transition-all flex items-center gap-2"
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          {/* AI Recipe Builder Section */}
          <div className="bg-yellow-50 p-6 rounded-xl shadow-sm mb-6 border border-primary relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="text-8xl">🤖</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-secondary relative z-10">AI Recipe Builder</h2>
            <p className="text-sm text-gray-700 mb-4 font-medium relative z-10">Tell us what you're making, and we'll find the best ingredients nearby.</p>
            <form onSubmit={handleRecipeBuilder} className="flex gap-2 relative z-10 mb-4">
              <input 
                type="text" 
                placeholder="e.g. 'Make Pizza for 4 people'" 
                value={recipePrompt}
                onChange={(e) => setRecipePrompt(e.target.value)}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none shadow-inner"
              />
              <button type="submit" disabled={recipeLoading} className="bg-secondary text-white px-6 py-3 rounded-lg font-bold shadow-md hover:bg-accent transition-colors">
                {recipeLoading ? 'Analyzing...' : 'Build Recipe'}
              </button>
            </form>

            {/* Recipe Results Section */}
            {recipeResults.length > 0 && (
              <div className="mt-6 bg-white p-4 rounded-xl border border-yellow-200 shadow-inner relative z-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-secondary flex items-center gap-2">
                    🍳 Ingredients Found Near You
                  </h3>
                  <button 
                    onClick={addAllRecipeItemsToCart}
                    className="bg-primary text-black px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-yellow-400 transition-colors"
                  >
                    ✓ Add All to Cart
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recipeResults.map((item, idx) => (
                    <div key={idx} className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100 flex flex-col justify-between hover:shadow transition-shadow">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-secondary text-base">{item.product.name}</h4>
                          <span className="text-xs bg-yellow-100 text-yellow-800 font-bold px-2 py-0.5 rounded-full">
                            Qty: {item.quantity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2 font-bold">₹{item.product.price} each</p>
                        <p className="text-xs text-gray-400 mb-4 font-semibold uppercase tracking-wide">
                          Store: {item.store.name} 
                          {item.store.distance !== undefined && ` • ${Math.round(item.store.distance)}m away`}
                        </p>
                      </div>
                      <button 
                        onClick={() => addRecipeItemToCart(item)}
                        className="w-full bg-white border border-secondary text-secondary py-2 rounded-lg font-bold text-xs hover:bg-secondary hover:text-white transition-all shadow-sm"
                      >
                        + Add {item.quantity} to Cart (₹{item.product.price * item.quantity})
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Intent Search Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-4">What do you need today?</h2>
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
              <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
                <div 
                  className="h-40 bg-gray-50 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleExpand(item)}
                >
                   <span className="text-5xl">🛍️</span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg text-secondary mb-1 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleExpand(item)}>
                    {item.product.name}
                  </h3>
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
                
                {/* Recommendations Sub-panel */}
                {expandedProduct === item.product._id && (
                  <div className="bg-yellow-50 p-4 border-t border-yellow-200 shadow-inner">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 text-center">Smart Recommendations</h4>
                    
                    {recommendationLoading ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-secondary"></div>
                      </div>
                    ) : (
                      <>
                        {recommendations.boughtWith.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm font-bold text-secondary mb-2">Frequently Bought Together</p>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                              {recommendations.boughtWith.map(rec => (
                                <div key={rec._id} className="min-w-[130px] bg-white p-3 rounded-xl border border-gray-100 flex flex-col items-center text-center shadow-sm">
                                  <span className="text-3xl mb-2">📦</span>
                                  <p className="text-xs font-bold truncate w-full text-gray-800">{rec.name}</p>
                                  <p className="text-xs text-gray-500 mb-2 font-bold">₹{rec.price}</p>
                                  <button onClick={() => addToCart({product: rec, store: item.store})} className="text-xs bg-primary text-black px-3 py-1.5 rounded-lg font-bold w-full hover:bg-yellow-400 transition-colors">Add</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {recommendations.similar.length > 0 && (
                          <div>
                            <p className="text-sm font-bold text-secondary mb-2">Similar Items</p>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                              {recommendations.similar.map(rec => (
                                <div key={rec._id} className="min-w-[130px] bg-white p-3 rounded-xl border border-gray-100 flex flex-col items-center text-center shadow-sm">
                                  <span className="text-3xl mb-2">🏷️</span>
                                  <p className="text-xs font-bold truncate w-full text-gray-800">{rec.name}</p>
                                  <p className="text-xs text-gray-500 mb-2 font-bold">₹{rec.price}</p>
                                  <button onClick={() => addToCart({product: rec, store: item.store})} className="text-xs bg-secondary text-white px-3 py-1.5 rounded-lg font-bold w-full hover:bg-accent transition-colors">Add</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {recommendations.similar.length === 0 && recommendations.boughtWith.length === 0 && (
                          <p className="text-xs text-gray-500 text-center italic py-4">No specific recommendations yet. Add items to cart and checkout to train the AI!</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {products.length === 0 && !loading && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <span className="text-6xl mb-4 opacity-50">✨</span>
                <p className="text-lg font-medium text-gray-500">Search to see magical intent results!</p>
              </div>
            )}
          </div>
        </div>

        <div className="w-full md:w-80 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit sticky top-24">
          <h3 className="text-xl font-bold mb-4 border-b pb-2 flex justify-between items-center">
            Your Cart <span className="text-primary bg-yellow-100 px-2 py-1 rounded-md text-sm">{cart.length}</span>
          </h3>
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <span className="text-4xl mb-2 opacity-50">🛒</span>
              <p className="text-sm font-medium">Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-60 overflow-y-auto pr-2 space-y-3">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <span className="font-medium truncate mr-2">{item.product.name}</span>
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
                disabled={checkoutLoading}
                className={`w-full bg-secondary text-white py-3 rounded-lg font-bold mt-4 hover:bg-accent transition-colors shadow-md ${checkoutLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {checkoutLoading ? 'Processing...' : 'Proceed to Pay'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuyerDashboard;
