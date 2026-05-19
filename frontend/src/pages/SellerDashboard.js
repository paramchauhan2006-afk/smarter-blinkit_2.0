import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import axios from 'axios';
import io from 'socket.io-client';

const SellerDashboard = () => {
  const [scanResult, setScanResult] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  
  const [activeUsers, setActiveUsers] = useState(0);
  const [leaderboard, setLeaderboard] = useState({ products: [], stores: [] });
  const [alerts, setAlerts] = useState([]);

  // Note: For a real app, storeId should come from the logged-in user context
  const mockStoreId = "60d5ecb8b487343568912345"; // placeholder

  useEffect(() => {
    fetchLeaderboard();

    const socket = io('http://localhost:5000');
    
    socket.on('connect', () => {
      socket.emit('join_store', mockStoreId);
    });

    socket.on('global_metrics_update', (data) => {
      setActiveUsers(data.activeUsers);
    });

    socket.on('leaderboard_update', () => {
      fetchLeaderboard();
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
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/products/leaderboard');
      setLeaderboard(res.data);
    } catch (err) {
      console.error(err);
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
          setScanResult(text);
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
    try {
      await axios.post('http://localhost:5000/api/inventory/barcode', {
        barcode,
        storeId: mockStoreId,
        incrementBy: 1
      });
      alert(`Successfully added stock for barcode: ${barcode}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update inventory. Is the product registered?');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    updateInventory(manualBarcode);
    setManualBarcode('');
    setScanResult(manualBarcode);
  };

  const removeAlert = (id) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6">
      <div className="flex-1">
        <div className="bg-white p-6 rounded-xl shadow-sm mb-6 flex justify-between items-center border border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-secondary mb-1">Seller Inventory Management</h2>
            <p className="text-gray-500 text-sm">Scan items as they arrive to instantly update your store's stock.</p>
          </div>
          <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-bold border border-green-200">
            🟢 Store Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Quick Add via Barcode</h3>
            
            {!scannerActive ? (
              <button 
                onClick={() => setScannerActive(true)}
                className="w-full bg-secondary text-white py-4 rounded-xl font-bold shadow-md hover:bg-accent transition-colors flex items-center justify-center gap-3 mb-6 text-lg"
              >
                <span className="text-2xl">📷</span> Start Camera Scanner
              </button>
            ) : (
              <div className="mb-6">
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
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <button type="submit" className="bg-primary px-6 py-3 rounded-lg font-bold shadow-sm hover:bg-yellow-400 transition-colors">
                Add Stock
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-4">Recent Scan Log</h3>
            {scanResult ? (
              <div className="bg-green-50 p-6 rounded-xl border border-green-200 flex flex-col items-center justify-center text-center h-48">
                <span className="text-5xl mb-2">✅</span>
                <p className="font-bold text-green-800 text-lg">Item Scanned Successfully!</p>
                <p className="text-sm font-mono text-green-600 mt-1 bg-green-100 px-3 py-1 rounded border border-green-200">
                  Barcode: {scanResult}
                </p>
              </div>
            ) : (
              <div className="h-48 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 flex-col gap-3 bg-gray-50">
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
        <div className="bg-secondary text-white p-6 rounded-xl shadow-md border border-gray-800 relative overflow-hidden">
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
                <div key={alert.id} className={`p-3 rounded-lg border flex justify-between items-start ${alert.type === 'order' ? 'bg-yellow-50 border-primary text-secondary' : 'bg-red-50 border-red-200 text-red-800'}`}>
                  <p className="text-sm font-bold">{alert.msg}</p>
                  <button onClick={() => removeAlert(alert.id)} className="text-lg opacity-50 hover:opacity-100">×</button>
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
            {leaderboard.products.length === 0 ? <p className="text-sm text-gray-400">Loading...</p> : (
              <ul className="space-y-2">
                {leaderboard.products.map((p, i) => (
                  <li key={p._id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                    <span className="font-medium"><span className="text-primary mr-1">#{i+1}</span> <span className="truncate w-32 inline-block align-bottom">{p.name}</span></span>
                    <span className="font-bold">{p.salesCount} sold</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Top Rated Shops</p>
            {leaderboard.stores.length === 0 ? <p className="text-sm text-gray-400">Loading...</p> : (
              <ul className="space-y-2">
                {leaderboard.stores.map((s, i) => (
                  <li key={s._id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
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
  );
};

export default SellerDashboard;
