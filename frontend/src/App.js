import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import BuyerDashboard from './pages/BuyerDashboard';
import SellerDashboard from './pages/SellerDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans">
        <header className="bg-primary text-black p-4 shadow-md sticky top-0 z-50">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold tracking-tight">Smarter Blinkit</h1>
          </div>
        </header>

        <main className="container mx-auto p-4">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/buyer-dashboard" element={<BuyerDashboard />} />
            <Route path="/seller-dashboard" element={<SellerDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
