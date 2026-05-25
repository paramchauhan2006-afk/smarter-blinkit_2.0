import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config';

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
  
  // Production Upgrades State
  const [activeTab, setActiveTab] = useState('shop'); // 'shop', 'history', 'searches', 'addresses'
  const [toast, setToast] = useState(null);
  const [recentSearches, setRecentSearches] = useState(['Pizza ingredients', 'Beverages', 'Fresh Tomatoes', 'Milk and Sugar']);
  const [orderHistory, setOrderHistory] = useState([
    {
      _id: 'ord_mock101',
      createdAt: '2026-05-24T14:22:10.000Z',
      totalAmount: 290,
      status: 'Paid',
      items: [
        { name: 'Pizza Dough', price: 60, quantity: 1 },
        { name: 'Tomato Sauce', price: 80, quantity: 1 },
        { name: 'Mozzarella Cheese', price: 150, quantity: 1 }
      ]
    },
    {
      _id: 'ord_mock102',
      createdAt: '2026-05-23T09:15:30.000Z',
      totalAmount: 100,
      status: 'Paid',
      items: [
        { name: 'Milk', price: 60, quantity: 1 },
        { name: 'Sugar', price: 40, quantity: 1 }
      ]
    }
  ]);
  const initialAddresses = [
    { id: 'addr_1', name: 'Home (MNIT Campus)', address: 'JLN Marg, Malviya Nagar, Jaipur', lat: 26.8631, lng: 75.8105, active: true },
    { id: 'addr_2', name: 'Office (WTP Mall)', address: 'Malviya Nagar Sector 8, Jaipur', lat: 26.8530, lng: 75.8050, active: false },
    { id: 'addr_3', name: 'GT Galleria Storefront', address: 'Gaurav Tower, Malviya Nagar, Jaipur', lat: 26.8480, lng: 75.8220, active: false }
  ];

  const [savedAddresses, setSavedAddresses] = useState(() => {
    const local = localStorage.getItem('saved_addresses');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        return initialAddresses;
      }
    }
    return initialAddresses;
  });

  // Add Address Modal & Form States
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrDetails, setNewAddrDetails] = useState('');
  const [newAddrLat, setNewAddrLat] = useState('26.8631');
  const [newAddrLng, setNewAddrLng] = useState('75.8105');
  const [fetchingGeo, setFetchingGeo] = useState(false);

  // Shop categories & reverse-geocode locality states
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [geoLocality, setGeoLocality] = useState(() => {
    return localStorage.getItem('geo_locality') || 'MNIT Area, Jaipur';
  });

  // Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' or 'razorpay'
  const [checkoutStep, setCheckoutStep] = useState('summary'); // 'summary', 'processing', 'success'
  const [placedOrderId, setPlacedOrderId] = useState('');

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'Buyer', email: '' };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const reverseGeocode = async (lat, lng, label = null) => {
    try {
      const res = await axios.get(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
      const locality = res.data.locality || res.data.city || res.data.principalSubdivision || 'Jaipur';
      const city = res.data.city || 'Jaipur';
      const formatted = label ? `${label} (${locality}, ${city})` : `${locality}, ${city}`;
      setGeoLocality(formatted);
      localStorage.setItem('geo_locality', formatted);
    } catch (err) {
      console.error('Reverse geocoding error:', err);
      if (label) {
        setGeoLocality(label);
        localStorage.setItem('geo_locality', label);
      }
    }
  };

  const fetchDeviceLocation = () => {
    if (!navigator.geolocation) {
      return showToast('Geolocation is not supported by your browser.', 'error');
    }
    setFetchingGeo(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setNewAddrLat(lat.toFixed(6));
        setNewAddrLng(lng.toFixed(6));
        
        try {
          const res = await axios.get(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
          const locality = res.data.locality || res.data.city || res.data.principalSubdivision || 'Unknown Area';
          const city = res.data.city || '';
          const nameStr = city ? `${locality}, ${city}` : locality;
          setNewAddrDetails(res.data.locality || 'Current Location');
          setNewAddrLabel(nameStr);
          showToast('Device location fetched and reverse geocoded!', 'success');
        } catch (err) {
          showToast('Fetched coordinates, but reverse geocode failed.', 'warning');
        }
        setFetchingGeo(false);
      },
      (error) => {
        console.error(error);
        showToast('Failed to retrieve device location.', 'error');
        setFetchingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    // Default to the active saved address location coordinates
    const activeAddr = savedAddresses.find(a => a.active);
    if (activeAddr) {
      setLocation({ lat: activeAddr.lat, lng: activeAddr.lng });
      reverseGeocode(activeAddr.lat, activeAddr.lng, activeAddr.name);
    }
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleSearch = async (e, searchQuery = null) => {
    if (e) e.preventDefault();
    const activeQuery = searchQuery || query;
    if (!activeQuery) return;
    
    setLoading(true);
    try {
      let url = `${API_BASE}/api/products/search?query=${encodeURIComponent(activeQuery)}`;
      if (location) {
        url += `&lat=${location.lat}&lng=${location.lng}`;
      }
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(res.data);
      setSelectedCategory('All');
      
      // Update recent searches
      if (!recentSearches.includes(activeQuery)) {
        setRecentSearches(prev => [activeQuery, ...prev.slice(0, 4)]);
      }
      
      setActiveTab('shop');
    } catch (err) {
      console.error(err);
      showToast('Search request failed. Please check backend connection.', 'error');
    }
    setLoading(false);
  };

  const handleRecipeBuilder = async (e) => {
    e.preventDefault();
    if (!recipePrompt) return showToast('Enter a recipe prompt first!', 'error');
    if (!location) return showToast('Please enable location to find nearest ingredients.', 'error');
    
    setRecipeLoading(true);
    setRecipeResults([]);
    try {
      const res = await axios.post(`${API_BASE}/api/cart/recipe`, {
        prompt: recipePrompt,
        lat: location.lat,
        lng: location.lng
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newItems = res.data.cartItems || [];
      if (newItems.length === 0) {
        showToast('No matching ingredients found for this recipe.', 'error');
      } else {
        setRecipeResults(newItems);
        showToast('Recipe built! Inspect nearby matching ingredients below.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to build recipe. Try "Make Pizza for 4 people".', 'error');
    }
    setRecipeLoading(false);
  };

  const addToCart = (productObj) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product._id === productObj.product._id && item.store.id === productObj.store.id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: (copy[idx].quantity || 1) + 1 };
        return copy;
      }
      return [...prev, { ...productObj, quantity: 1 }];
    });
    showToast(`Added ${productObj.product.name} to cart!`, 'success');
  };

  const addRecipeItemToCart = (item) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.product._id === item.product._id && c.store.id === item.store.id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: (copy[idx].quantity || 0) + item.quantity };
        return copy;
      }
      return [...prev, { product: item.product, store: item.store, quantity: item.quantity }];
    });
    showToast(`Added ${item.quantity} x ${item.product.name} to cart!`, 'success');
  };

  const addAllRecipeItemsToCart = () => {
    setCart(prev => {
      let copy = [...prev];
      recipeResults.forEach(item => {
        const idx = copy.findIndex(c => c.product._id === item.product._id && c.store.id === item.store.id);
        if (idx > -1) {
          copy[idx] = { ...copy[idx], quantity: (copy[idx].quantity || 0) + item.quantity };
        } else {
          copy.push({ product: item.product, store: item.store, quantity: item.quantity });
        }
      });
      return copy;
    });
    showToast(`Added all ${recipeResults.length} recipe items to cart!`, 'success');
    setRecipeResults([]);
  };

  const updateCartItemQuantity = (productId, storeId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product._id === productId && item.store.id === storeId) {
          const newQty = (item.quantity || 1) + delta;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    showToast('Logged out successfully.', 'success');
    setTimeout(() => navigate('/login'), 800);
  };

  const handleAddressSelect = (addrId) => {
    const updated = savedAddresses.map(a => {
      if (a.id === addrId) {
        setLocation({ lat: a.lat, lng: a.lng });
        reverseGeocode(a.lat, a.lng, a.name);
        showToast(`Delivery location updated to: ${a.name}`, 'success');
        return { ...a, active: true };
      }
      return { ...a, active: false };
    });
    setSavedAddresses(updated);
    localStorage.setItem('saved_addresses', JSON.stringify(updated));
  };

  const getFilteredProducts = () => {
    if (selectedCategory === 'All') return products;
    return products.filter(item => {
      const cat = (item.product.category || '').toLowerCase();
      if (selectedCategory === 'Dairy') {
        return cat === 'dairy';
      }
      if (selectedCategory === 'Snacks') {
        return cat === 'snacks';
      }
      if (selectedCategory === 'Wellness') {
        return cat === 'wellness';
      }
      if (selectedCategory === 'Recipes') {
        return !['dairy', 'snacks', 'wellness'].includes(cat);
      }
      return true;
    });
  };

  const handleAddAddress = (e) => {
    e.preventDefault();
    if (!newAddrLabel || !newAddrDetails || !newAddrLat || !newAddrLng) {
      return showToast('Please fill in all address fields.', 'error');
    }

    const latVal = parseFloat(newAddrLat);
    const lngVal = parseFloat(newAddrLng);

    if (isNaN(latVal) || isNaN(lngVal)) {
      return showToast('Latitude and Longitude must be valid numbers.', 'error');
    }

    const newAddress = {
      id: `addr_${Date.now()}`,
      name: newAddrLabel,
      address: newAddrDetails,
      lat: latVal,
      lng: lngVal,
      active: false
    };

    const updated = [...savedAddresses, newAddress];
    setSavedAddresses(updated);
    localStorage.setItem('saved_addresses', JSON.stringify(updated));
    showToast(`New address "${newAddrLabel}" added successfully!`, 'success');
    
    // Reset form
    setNewAddrLabel('');
    setNewAddrDetails('');
    setNewAddrLat('26.8631');
    setNewAddrLng('75.8105');
    setShowAddressModal(false);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return showToast('Cart is empty!', 'error');
    const amount = cart.reduce((total, item) => total + (item.product.price * (item.quantity || 1)), 0);

    setCheckoutStep('processing');
    
    if (paymentMethod === 'cod') {
      try {
        // Dynamic order creation with dummy payment variables to decrement stocks in DB
        const { data: order } = await axios.post(`${API_BASE}/api/orders/create`, { 
          amount, 
          cartItems: cart 
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Simulate delivery connector delay
        setTimeout(async () => {
          try {
            await axios.post(`${API_BASE}/api/orders/verify`, {
              razorpay_order_id: order.id || `dummy_cod_${Date.now()}`,
              razorpay_payment_id: `pay_dummy_${Math.floor(Math.random() * 100000)}`,
              razorpay_signature: 'dummy_signature',
              cartItems: cart,
              lat: location ? location.lat : null,
              lng: location ? location.lng : null
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });

            const newOrderObj = {
              _id: order.id || `ord_${Date.now()}`,
              createdAt: new Date().toISOString(),
              totalAmount: amount,
              status: 'Paid',
              items: cart.map(item => ({
                name: item.product.name,
                price: item.product.price,
                quantity: item.quantity || 1
              }))
            };

            setOrderHistory(prev => [newOrderObj, ...prev]);
            setPlacedOrderId(newOrderObj._id);
            setCheckoutStep('success');
            setCart([]);
            showToast('Order placed successfully!', 'success');
          } catch (verifyErr) {
            console.error(verifyErr);
            setCheckoutStep('summary');
            showToast('Order completion failed. Please retry.', 'error');
          }
        }, 2200);

      } catch (err) {
        console.error(err);
        setCheckoutStep('summary');
        showToast('Failed to connect to gateway.', 'error');
      }
    } else {
      // Razorpay checkout
      try {
        const { data: order } = await axios.post(`${API_BASE}/api/orders/create`, { 
          amount, 
          cartItems: cart 
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const options = {
          key: process.env.REACT_APP_RAZORPAY_KEY || 'test_key_id',
          amount: order.amount,
          currency: order.currency,
          name: 'Smarter Blinkit',
          description: 'Payment Gateway',
          order_id: order.id,
          handler: async function (response) {
            try {
              await axios.post(`${API_BASE}/api/orders/verify`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                cartItems: cart,
                lat: location ? location.lat : null,
                lng: location ? location.lng : null
              }, {
                headers: { Authorization: `Bearer ${token}` }
              });

              const newOrderObj = {
                _id: order.id,
                createdAt: new Date().toISOString(),
                totalAmount: amount,
                status: 'Paid',
                items: cart.map(item => ({
                  name: item.product.name,
                  price: item.product.price,
                  quantity: item.quantity || 1
                }))
              };

              setOrderHistory(prev => [newOrderObj, ...prev]);
              setPlacedOrderId(order.id);
              setCheckoutStep('success');
              setCart([]);
              showToast('Payment successful!', 'success');
            } catch (err) {
              setCheckoutStep('summary');
              showToast('Payment verification failed', 'error');
            }
          },
          theme: { color: '#f8cb46' }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response){
          setCheckoutStep('summary');
          showToast('Payment failed', 'error');
        });
        rzp.open();
        setShowCheckoutModal(false);
      } catch (err) {
        console.error(err);
        setCheckoutStep('summary');
        showToast('Failed to trigger Razorpay checkout.', 'error');
      }
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
      const res = await axios.get(`${API_BASE}/api/products/${item.product._id}/recommendations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecommendations(res.data);
    } catch (err) {
      console.error('Recommendations error', err);
    }
    setRecommendationLoading(false);
  };

  // Helper to display distances in human readable kilometers
  const formatDistance = (meters) => {
    if (meters === undefined || meters === null) return '';
    if (meters < 1000) {
      return `${Math.round(meters)}m away`;
    }
    return `${(meters / 1000).toFixed(1)} km away`;
  };

  return (
    <div className="flex flex-col gap-6 w-full relative">
      {/* Custom Toast Notification Banner */}
      {toast && (
        <div className={`fixed top-24 right-5 z-50 flex items-center gap-3 text-white px-5 py-4 rounded-xl shadow-xl transition-all duration-300 transform translate-y-0 ${
          toast.type === 'error' ? 'bg-rose-500' : 'bg-green-500'
        }`}>
          <span className="text-xl">{toast.type === 'error' ? '❌' : '✨'}</span>
          <p className="text-sm font-black">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 font-bold opacity-75 hover:opacity-100">×</button>
        </div>
      )}

      {/* Top Navigation Utility Bar */}
      <div className="bg-white border border-gray-100 p-4 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-black shadow-sm">
            {user.name ? user.name.charAt(0).toUpperCase() : 'B'}
          </div>
          <div>
            <p className="text-sm font-semibold text-secondary">Logged in as</p>
            <p className="text-xs text-gray-500 font-bold">{user.name} ({user.email})</p>
          </div>
        </div>

        {/* Tab Selection Switch */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('shop')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'shop' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            🏪 Shop
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            📜 Order History
          </button>
          <button 
            onClick={() => setActiveTab('searches')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'searches' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            🔍 Searches
          </button>
          <button 
            onClick={() => setActiveTab('addresses')}
            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'addresses' ? 'bg-white text-secondary shadow-sm' : 'text-gray-500 hover:text-secondary'}`}
          >
            📍 Addresses
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden xl:block">
            <p className="text-xs font-semibold text-gray-400">DELIVERING TO</p>
            <p className="text-xs font-bold text-green-600">
              📍 {geoLocality}
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

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Main Content Area */}
        <div className="flex-1">
          {activeTab === 'shop' && (
            <>
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
                  <div className="mt-6 bg-white p-4 rounded-xl border border-yellow-200 shadow-inner relative z-10 animate-fade-in">
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
                              {item.store.distance !== undefined && ` • ${formatDistance(item.store.distance)}`}
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
                <form onSubmit={(e) => handleSearch(e)} className="flex gap-2">
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

              {/* Category Badges Grid */}
              {products.length > 0 && (
                <div className="mb-6 flex gap-3 flex-wrap items-center bg-gray-50/50 p-3 rounded-xl border border-gray-100 animate-fade-in">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-1">Categories:</span>
                  <button 
                    onClick={() => setSelectedCategory('All')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 flex items-center gap-1 ${selectedCategory === 'All' ? 'bg-secondary text-white border-none' : 'bg-white border border-gray-200 text-secondary hover:bg-gray-100'}`}
                  >
                    ⚡ All Products
                  </button>
                  <button 
                    onClick={() => setSelectedCategory('Dairy')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 flex items-center gap-1 ${selectedCategory === 'Dairy' ? 'bg-secondary text-white border-none' : 'bg-white border border-gray-200 text-secondary hover:bg-gray-100'}`}
                  >
                    🥛 Dairy
                  </button>
                  <button 
                    onClick={() => setSelectedCategory('Snacks')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 flex items-center gap-1 ${selectedCategory === 'Snacks' ? 'bg-secondary text-white border-none' : 'bg-white border border-gray-200 text-secondary hover:bg-gray-100'}`}
                  >
                    🍿 Snacks
                  </button>
                  <button 
                    onClick={() => setSelectedCategory('Wellness')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 flex items-center gap-1 ${selectedCategory === 'Wellness' ? 'bg-secondary text-white border-none' : 'bg-white border border-gray-200 text-secondary hover:bg-gray-100'}`}
                  >
                    💊 Wellness
                  </button>
                  <button 
                    onClick={() => setSelectedCategory('Recipes')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 flex items-center gap-1 ${selectedCategory === 'Recipes' ? 'bg-secondary text-white border-none' : 'bg-white border border-gray-200 text-secondary hover:bg-gray-100'}`}
                  >
                    🍕 Recipes
                  </button>
                </div>
              )}

              {/* Products Display Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {getFilteredProducts().map((item, idx) => (
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
                            {item.store.distance !== undefined && ` • ${formatDistance(item.store.distance)}`}
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
            </>
          )}

          {activeTab === 'history' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-fade-in">
              <h2 className="text-xl font-bold mb-4 text-secondary flex items-center gap-2">
                <span>📜</span> Your Past Orders
              </h2>
              {orderHistory.length === 0 ? (
                <p className="text-gray-400 italic text-center py-8">No order history available yet.</p>
              ) : (
                <div className="space-y-4">
                  {orderHistory.map((ord, i) => (
                    <div key={i} className="border border-gray-100 p-4 rounded-xl hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-center border-b pb-2 mb-3">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase">ORDER ID</p>
                          <p className="text-sm font-mono font-bold text-secondary">{ord._id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">{new Date(ord.createdAt).toLocaleString()}</p>
                          <span className="inline-block mt-1 text-xs font-extrabold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                            {ord.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {ord.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm text-gray-700 font-medium">
                            <span>{item.name} <span className="text-gray-400">x{item.quantity || 1}</span></span>
                            <span>₹{item.price * (item.quantity || 1)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t pt-2 mt-3 flex justify-between font-black text-secondary">
                        <span>Total Paid</span>
                        <span>₹{ord.totalAmount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'searches' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-fade-in">
              <h2 className="text-xl font-bold mb-4 text-secondary flex items-center gap-2">
                <span>🔍</span> Recent Search Queries
              </h2>
              <p className="text-sm text-gray-400 mb-6">Click any search query below to instantly query local stores again.</p>
              <div className="flex flex-col gap-3">
                {recentSearches.map((s, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleSearch(null, s)}
                    className="p-4 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-all font-bold text-secondary flex justify-between items-center"
                  >
                    <span>🔎 "{s}"</span>
                    <span className="text-xs text-gray-400 uppercase font-semibold">Search Again</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-fade-in">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 className="text-xl font-bold text-secondary flex items-center gap-2">
                  <span>📍</span> Manage Saved Addresses
                </h2>
                <button 
                  onClick={() => setShowAddressModal(true)}
                  className="bg-primary text-black px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-yellow-400 active:scale-95 transition-all flex items-center gap-1"
                >
                  ➕ Add New Address
                </button>
              </div>
              <p className="text-sm text-gray-400 mb-6">Select your current active delivery address. Nearby store coordinates will shift to cluster around your active address.</p>
              <div className="space-y-4">
                {savedAddresses.map(addr => (
                  <div 
                    key={addr.id}
                    className={`p-4 rounded-xl border flex justify-between items-center transition-all ${addr.active ? 'border-primary bg-yellow-50/50 shadow-sm' : 'border-gray-200'}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-secondary">{addr.name}</span>
                        {addr.active && <span className="bg-primary text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Active</span>}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{addr.address}</p>
                      <p className="text-xs text-gray-400 font-mono mt-1">Coordinates: [{addr.lng.toFixed(4)}, {addr.lat.toFixed(4)}]</p>
                    </div>
                    
                    {!addr.active && (
                      <button 
                        onClick={() => handleAddressSelect(addr.id)}
                        className="bg-secondary text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-accent transition-colors shadow-sm"
                      >
                        Set Active
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Cart Sidebar */}
        <div className="w-full lg:w-80 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit sticky top-24">
          <h3 className="text-xl font-bold mb-4 border-b pb-2 flex justify-between items-center">
            Your Cart <span className="text-primary bg-yellow-100 px-2 py-1 rounded-md text-sm">{cart.reduce((t, i) => t + (i.quantity || 1), 0)}</span>
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
                  <div key={idx} className="flex justify-between text-sm items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100 gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-secondary truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-500 font-semibold">₹{item.product.price} each</p>
                    </div>
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      <button 
                        onClick={() => updateCartItemQuantity(item.product._id, item.store.id, -1)}
                        className="px-2.5 py-0.5 text-rose-500 font-black hover:bg-rose-50 active:bg-rose-100 transition-colors"
                      >-</button>
                      <span className="px-2 text-xs font-black text-secondary">{item.quantity || 1}</span>
                      <button 
                        onClick={() => updateCartItemQuantity(item.product._id, item.store.id, 1)}
                        className="px-2.5 py-0.5 text-green-600 font-black hover:bg-green-50 active:bg-green-100 transition-colors"
                      >+</button>
                    </div>
                    <div className="text-right font-black text-secondary min-w-[50px]">
                      ₹{item.product.price * (item.quantity || 1)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 flex justify-between font-bold text-lg">
                <span>Total Amount</span>
                <span className="text-secondary">₹{cart.reduce((t, i) => t + (i.product.price * (i.quantity || 1)), 0)}</span>
              </div>
              <button 
                onClick={() => {
                  setCheckoutStep('summary');
                  setShowCheckoutModal(true);
                }}
                className="w-full bg-secondary text-white py-3 rounded-lg font-bold mt-4 hover:bg-accent transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <span>💳</span> Proceed to Pay
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Checkout breakdown modal & Processing overlay */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden animate-slide-up">
            
            {/* Step 1: Summary */}
            {checkoutStep === 'summary' && (
              <>
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                  <h3 className="font-black text-xl text-secondary">Checkout Summary</h3>
                  <button onClick={() => setShowCheckoutModal(false)} className="text-2xl font-bold text-gray-400 hover:text-secondary">×</button>
                </div>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1 mb-4">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm text-gray-600 font-medium">
                      <span>{item.product.name} <span className="text-gray-400 font-bold">x{item.quantity || 1}</span></span>
                      <span className="font-bold text-secondary">₹{item.product.price * (item.quantity || 1)}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-200 mb-4 flex justify-between items-center text-sm font-semibold">
                  <span className="text-yellow-800">🛵 Estimated Delivery:</span>
                  <span className="text-secondary font-extrabold">12-15 Mins</span>
                </div>

                <div className="border-t border-b py-3 mb-6 flex justify-between font-black text-lg text-secondary">
                  <span>Grand Total</span>
                  <span>₹{cart.reduce((t, i) => t + (i.product.price * (i.quantity || 1)), 0)}</span>
                </div>

                <div className="mb-6">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Select Payment Method</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setPaymentMethod('cod')}
                      className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1 transition-all ${paymentMethod === 'cod' ? 'border-primary bg-yellow-50/30 shadow-inner' : 'border-gray-200'}`}
                    >
                      <span className="text-lg">💵</span> Cash on Delivery
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('razorpay')}
                      className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1 transition-all ${paymentMethod === 'razorpay' ? 'border-primary bg-yellow-50/30 shadow-inner' : 'border-gray-200'}`}
                    >
                      <span className="text-lg">💳</span> Online Gateway
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handlePlaceOrder}
                  className="w-full bg-secondary text-white py-3 rounded-xl font-bold hover:bg-accent transition-colors shadow-md"
                >
                  Place Order (₹{cart.reduce((t, i) => t + (i.product.price * (i.quantity || 1)), 0)})
                </button>
              </>
            )}

            {/* Step 2: Processing */}
            {checkoutStep === 'processing' && (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <span className="text-6xl animate-bounce mb-4">🛵</span>
                <h3 className="font-extrabold text-lg text-secondary mb-2 animate-pulse">Connecting with Delivery Partner...</h3>
                <p className="text-sm text-gray-500 max-w-xs">Connecting to nearest grocery store inventory dispatchers...</p>
                
                <div className="w-16 h-1 mt-6 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse w-full"></div>
                </div>
              </div>
            )}

            {/* Step 3: Success */}
            {checkoutStep === 'success' && (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <span className="text-6xl mb-4">🎉</span>
                <h3 className="font-black text-2xl text-secondary mb-1">Order Confirmed!</h3>
                <p className="text-sm text-green-600 font-extrabold mb-4">Payment Successful via Cash / Dummy Gateway</p>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 w-full mb-6 font-mono text-xs text-left space-y-1">
                  <p><span className="font-bold text-gray-400">ORDER REF:</span> {placedOrderId}</p>
                  <p><span className="font-bold text-gray-400">DELIVERY TO:</span> {savedAddresses.find(a=>a.active)?.name || 'Jaipur Active Cluster'}</p>
                  <p><span className="font-bold text-gray-400">EST TIME:</span> 12 Mins</p>
                </div>
                <button 
                  onClick={() => setShowCheckoutModal(false)}
                  className="w-full bg-primary text-black py-3 rounded-xl font-bold hover:bg-yellow-400 transition-colors shadow-md"
                >
                  Return to Dashboard
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Add Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden animate-slide-up">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="font-black text-xl text-secondary">Add New Address</h3>
              <button onClick={() => setShowAddressModal(false)} className="text-2xl font-bold text-gray-400 hover:text-secondary">×</button>
            </div>
            
            <form onSubmit={handleAddAddress} className="space-y-4">
              <button 
                type="button"
                onClick={fetchDeviceLocation}
                disabled={fetchingGeo}
                className="w-full bg-gray-50 hover:bg-gray-100 text-secondary border border-gray-200 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
              >
                {fetchingGeo ? '⏳ Fetching coordinates...' : '📍 Fetch Current Location'}
              </button>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Address Label</label>
                <input 
                  type="text" 
                  placeholder="e.g. Hostel 4, Gym, Office" 
                  required 
                  value={newAddrLabel} 
                  onChange={e => setNewAddrLabel(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Address Details</label>
                <input 
                  type="text" 
                  placeholder="e.g. Street/Building, Area, Landmark" 
                  required 
                  value={newAddrDetails} 
                  onChange={e => setNewAddrDetails(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Latitude</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 26.8631" 
                    required 
                    value={newAddrLat} 
                    onChange={e => setNewAddrLat(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Longitude</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 75.8105" 
                    required 
                    value={newAddrLng} 
                    onChange={e => setNewAddrLng(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-secondary text-white py-3 rounded-xl font-bold hover:bg-accent transition-colors shadow-md mt-2"
              >
                Save Address
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerDashboard;
