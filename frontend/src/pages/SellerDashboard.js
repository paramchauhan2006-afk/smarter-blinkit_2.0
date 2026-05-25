import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import io from 'socket.io-client';
import { API_BASE } from '../config';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#f8cb46', '#22c55e', '#ef4444', '#3b82f6', '#f97316'];

const SellerDashboard = () => {
  const [scanResult, setScanResult] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  
  const [activeUsers, setActiveUsers] = useState(0);
  const [leaderboard, setLeaderboard] = useState({ products: [], stores: [] });
  const [alerts, setAlerts] = useState([]);

  // Money Map & Predict
  const [moneyMapData, setMoneyMapData] = useState([]);
  const [aiPredictions, setAiPredictions] = useState([]);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [scannedProductName, setScannedProductName] = useState('');
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  
  // Custom Toast State
  const [toast, setToast] = useState(null);

  const [store, setStore] = useState(null);
  
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user')) || { name: 'Seller', email: '' };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSellerStore = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/inventory/store`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStore(res.data);
    } catch (err) {
      console.error('Failed to fetch seller store:', err);
      showToast('Could not load store details. Please verify your seller account.', 'error');
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    fetchMoneyMap();
    fetchSellerStore();
  }, []);

  useEffect(() => {
    if (!store) return;

    const socket = io(API_BASE);
    
    socket.on('connect', () => {
      socket.emit('join_store', store._id);
    });

    socket.on('global_metrics_update', (data) => {
      setActiveUsers(data.activeUsers);
    });

    socket.on('leaderboard_update', () => {
      fetchLeaderboard();
      fetchMoneyMap();
    });

    socket.on('new_order', (data) => {
      setAlerts(prev => [{ id: Date.now(), type: 'order', msg: `New sub-order received! (${data.items.length} items)` }, ...prev]);
    });

    socket.on('low_stock', (data) => {
      setAlerts(prev => [{ id: Date.now(), type: 'stock', msg: `Low stock alert for ${data.productIds.length} items!` }, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [store]);

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/products/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeaderboard(res.data);
    } catch (err) {
      console.error(err);
    }
    setLeaderboardLoading(false);
  };

  const fetchMoneyMap = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/orders/analytics/money-map`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMoneyMapData(res.data);
    } catch (err) {
      console.error('Money Map error:', err);
    }
  };

  useEffect(() => {
    let scanner = null;
    if (scannerActive) {
      scanner = new Html5QrcodeScanner('reader', {
        qrbox: { width: 250, height: 250 },
        fps: 5,
      });

      scanner.render(
        (text) => {
          scanner.clear();
          setScannerActive(false);
          updateInventory(text);
        },
        (err) => {}
      );
    }

    return () => {
      if (scanner) scanner.clear().catch(e => console.error(e));
    };
  }, [scannerActive]);

  const updateInventory = async (barcode) => {
    if (!barcode) return;
    setInventoryLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/inventory/barcode`, {
        barcode,
        storeId: store?._id,
        incrementBy: 1
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScanResult(barcode);
      showToast(`Added stock for barcode: ${barcode}`, 'success');
      
      if (res.data.product) {
        setScannedProductName(res.data.product.name);
        fetchPairings(res.data.product._id);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update inventory.', 'error');
    }
    setInventoryLoading(false);
  };

  const fetchPairings = async (productId) => {
    setPredictionLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/products/${productId}/predict-pairing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAiPredictions(res.data.predictions);
    } catch(err) {
      console.error(err);
    }
    setPredictionLoading(false);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    updateInventory(manualBarcode);
    setManualBarcode('');
  };

  const removeAlert = (id) => {
    setAlerts(alerts.filter(a => a.id !== id));
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

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6 relative animate-fade-in">
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
      <div className="w-full bg-white border border-gray-100 p-4 rounded-xl shadow-sm flex justify-between items-center transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-white shadow-sm">
            {user.name ? user.name.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <p className="text-sm font-semibold text-secondary">Logged in as Seller</p>
            <p className="text-xs text-gray-500 font-bold">{user.name} ({user.email})</p>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="px-4 py-2 bg-rose-500 text-white rounded-lg font-bold text-sm shadow-md hover:bg-rose-600 active:scale-95 transition-all flex items-center gap-2"
        >
          <span>🚪</span> Logout
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-6">
          
          <div className="bg-white p-6 rounded-xl shadow-sm flex justify-between items-center border border-gray-100 transition-all hover:shadow-md">
            <div>
              <h2 className="text-2xl font-bold text-secondary mb-1">
                {store ? `${store.name} - Inventory` : 'Seller Inventory Management'}
              </h2>
              <p className="text-gray-500 text-sm">Scan items as they arrive to instantly update your store's stock.</p>
            </div>
            <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-bold border border-green-200 animate-pulse">
              🟢 {store ? `${store.name} Active` : 'Store Active'}
            </span>
          </div>

          {/* Money Map Analytics */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-4 text-secondary flex items-center gap-2">
              <span>🗺️</span> Geospatial Money Map
            </h3>
            <p className="text-sm text-gray-500 mb-6">Visualizing highest revenue clusters across the city based on delivery density.</p>
            <div className="h-64 w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
              {moneyMapData.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-400 italic">No delivery cluster data available yet.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" dataKey="location.lng" name="Longitude" domain={['auto', 'auto']} tickFormatter={(v)=>v.toFixed(2)}/>
                    <YAxis type="number" dataKey="location.lat" name="Latitude" domain={['auto', 'auto']} tickFormatter={(v)=>v.toFixed(2)}/>
                    <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name, props) => {
                      if (name === 'Longitude' || name === 'Latitude') return value;
                      return `₹${props.payload.totalRevenue} (${props.payload.ordersCount} orders)`;
                    }} />
                    <Scatter name="Revenue Clusters" data={moneyMapData} fill="#f8cb46">
                      {moneyMapData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <h3 className="text-xl font-bold mb-4">Quick Add via Barcode</h3>
              
              {!scannerActive ? (
                <button 
                  onClick={() => setScannerActive(true)}
                  className="w-full bg-secondary text-white py-4 rounded-xl font-bold shadow-md hover:bg-accent transition-colors flex items-center justify-center gap-3 mb-6 text-lg"
                >
                  <span className="text-2xl">📷</span> Start Camera Scanner
                </button>
              ) : (
                <div className="mb-6 animate-fade-in">
                  <div id="reader" className="w-full bg-black rounded-xl overflow-hidden border-4 border-gray-200 shadow-inner"></div>
                  <button 
                    onClick={() => setScannerActive(false)}
                    className="mt-3 w-full text-red-600 bg-red-50 font-bold py-3 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    Cancel Scanner
                  </button>
                </div>
              )}

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs font-bold tracking-widest text-gray-400 uppercase">Or Enter Manually</span>
                </div>
              </div>

              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter Barcode / UPC" 
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                />
                <button type="submit" disabled={inventoryLoading} className={`bg-primary px-6 py-3 rounded-lg font-bold shadow-sm hover:bg-yellow-400 transition-colors ${inventoryLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {inventoryLoading ? 'Adding...' : 'Add Stock'}
                </button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md flex flex-col">
              <h3 className="text-xl font-bold mb-4">Recent Scan Log</h3>
              {scanResult ? (
                <div className="flex-1 flex flex-col gap-4 animate-slide-up">
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200 flex flex-col items-center justify-center text-center">
                    <span className="text-4xl mb-1">✅</span>
                    <p className="font-bold text-green-800 text-sm">Item Scanned: {scannedProductName || 'Success'}</p>
                    <p className="text-xs font-mono text-green-600 mt-1 bg-green-100 px-2 py-1 rounded border border-green-200">
                      {scanResult}
                    </p>
                  </div>
                  
                  {/* AI Predicts Pairing Panel */}
                  <div className="bg-yellow-50 p-4 rounded-xl border border-primary flex-1 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10 text-6xl">🤖</div>
                    <h4 className="font-bold text-sm text-secondary mb-2 relative z-10 flex items-center gap-1">
                      <span className="text-lg">✨</span> AI Predicts Pairing
                    </h4>
                    {predictionLoading ? (
                       <div className="flex-1 flex items-center justify-center">
                         <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-secondary"></div>
                       </div>
                    ) : aiPredictions.length > 0 ? (
                      <div className="flex flex-wrap gap-2 relative z-10">
                        {aiPredictions.map((pred, i) => (
                          <span key={i} className="bg-white px-3 py-1.5 rounded-lg text-sm font-bold border border-yellow-200 shadow-sm text-secondary">
                            + {pred.charAt(0).toUpperCase() + pred.slice(1)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 relative z-10">No specific pairings found.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 flex-col gap-3 bg-gray-50">
                  <span className="text-4xl grayscale opacity-50">📦</span>
                  <p className="font-medium text-gray-500">Waiting for first scan...</p>
                </div>
              )}
            </div>
          </div>

        </div>
        
        {/* Real-Time Storeboard Panel */}
        <div className="w-full md:w-80 space-y-6">
          
          {/* Live Office Counter */}
          <div className="bg-secondary text-white p-6 rounded-xl shadow-md border border-gray-800 relative overflow-hidden transition-all hover:shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="text-8xl">👥</span>
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2 relative z-10">Live Office Counter</h3>
            <div className="flex items-center gap-4 relative z-10">
              <span className="relative flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-primary"></span>
              </span>
              <p className="text-4xl font-black text-primary">{activeUsers}</p>
            </div>
            <p className="text-xs text-gray-400 mt-2 relative z-10">Active buyers currently online</p>
          </div>

          {/* Real-time Alerts */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Store Alerts</h3>
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No new alerts.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {alerts.map(alert => (
                  <div key={alert.id} className={`p-3 rounded-lg border flex justify-between items-start animate-slide-up ${alert.type === 'order' ? 'bg-yellow-50 border-primary text-secondary' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <p className="text-sm font-bold">{alert.msg}</p>
                    <button onClick={() => removeAlert(alert.id)} className="text-lg opacity-50 hover:opacity-100 transition-opacity">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard Widget */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-4 border-b pb-2">Global Leaderboard</h3>
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Fastest Selling Items</p>
              {leaderboardLoading ? (
                <div className="flex justify-center p-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div></div>
              ) : leaderboard.products.length === 0 ? (
                <p className="text-sm text-gray-500 italic p-2">No product data available.</p>
              ) : (
                <ul className="space-y-2">
                  {leaderboard.products.map((p, i) => (
                    <li key={p._id} className="flex justify-between text-sm bg-gray-50 p-2 rounded transition-colors hover:bg-gray-100">
                      <span className="font-medium"><span className="text-primary mr-1">#{i+1}</span> <span className="truncate w-32 inline-block align-bottom">{p.name}</span></span>
                      <span className="font-bold">{p.salesCount} sold</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Top Rated Shops</p>
              {leaderboardLoading ? (
                <div className="flex justify-center p-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div></div>
              ) : leaderboard.stores.length === 0 ? (
                <p className="text-sm text-gray-500 italic p-2">No store data available.</p>
              ) : (
                <ul className="space-y-2">
                  {leaderboard.stores.map((s, i) => (
                    <li key={s._id} className="flex justify-between text-sm bg-gray-50 p-2 rounded transition-colors hover:bg-gray-100">
                      <span className="font-medium"><span className="text-primary mr-1">#{i+1}</span> <span className="truncate w-32 inline-block align-bottom">{s.name}</span></span>
                      <span className="font-bold text-green-600">★ {s.rating}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
