import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold text-primary mb-4 shadow-sm">Smarter Blinkit</h1>
      <p className="text-xl text-gray-700 font-medium">The Next-Generation Smart Marketplace</p>
      <div className="mt-8 flex gap-4">
        <button className="px-6 py-2 bg-primary text-black font-semibold rounded-lg shadow hover:bg-yellow-400 transition-colors">
          Explore Market
        </button>
        <button className="px-6 py-2 bg-secondary text-white font-semibold rounded-lg shadow hover:bg-accent transition-colors">
          Seller Dashboard
        </button>
      </div>
    </div>
  );
}

export default App;
