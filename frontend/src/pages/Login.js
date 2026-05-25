import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import axios from 'axios';
import { API_BASE } from '../config';

const Login = () => {
  const [role, setRole] = useState('buyer');
  const [isFaceLogin, setIsFaceLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  
  const webcamRef = useRef(null);
  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleFaceLogin = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return showToast('Camera not ready!', 'error');
    
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login/face`, {
        imageBase64: imageSrc,
        role: role
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data));
      showToast(`Welcome back, ${res.data.name}!`, 'success');
      setTimeout(() => {
        navigate(res.data.role === 'buyer' ? '/buyer-dashboard' : '/seller-dashboard');
      }, 1000);
    } catch (err) {
      showToast(err.response?.data?.message || 'Face login failed', 'error');
    }
    setIsLoading(false);
  }, [webcamRef, navigate, role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isRegister) {
        let imageBase64 = null;
        if (isFaceLogin && webcamRef.current) {
          imageBase64 = webcamRef.current.getScreenshot();
        }
        const res = await axios.post(`${API_BASE}/api/auth/register`, {
          name, email, password, role, imageBase64
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data));
        showToast('Registration successful!', 'success');
        setTimeout(() => {
          navigate(role === 'buyer' ? '/buyer-dashboard' : '/seller-dashboard');
        }, 1000);
      } else {
        const res = await axios.post(`${API_BASE}/api/auth/login`, {
          email, password, role
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data));
        showToast(`Login successful! Welcome ${res.data.name}`, 'success');
        setTimeout(() => {
          navigate(res.data.role === 'buyer' ? '/buyer-dashboard' : '/seller-dashboard');
        }, 1000);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Authentication failed', 'error');
    }
    setIsLoading(false);
  };

  return (
    <div className="relative">
      {/* Dynamic Toast Element */}
      {toast && (
        <div className={`fixed top-24 right-5 z-50 flex items-center gap-3 text-white px-5 py-4 rounded-xl shadow-xl transition-all duration-300 transform translate-y-0 ${
          toast.type === 'error' ? 'bg-rose-500' : 'bg-green-500'
        }`}>
          <span className="text-xl">{toast.type === 'error' ? '❌' : '✨'}</span>
          <p className="text-sm font-black">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-2 font-bold opacity-75 hover:opacity-100">×</button>
        </div>
      )}

      <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <h2 className="text-3xl font-bold text-center text-secondary mb-6">
          {isRegister ? 'Create Account' : 'Welcome Back'}
        </h2>

        <div className="flex justify-center mb-6 space-x-4">
          <button 
            className={`px-4 py-2 rounded-full font-medium transition-colors ${role === 'buyer' ? 'bg-primary text-black' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setRole('buyer')}
          >Buyer</button>
          <button 
            className={`px-4 py-2 rounded-full font-medium transition-colors ${role === 'seller' ? 'bg-primary text-black' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setRole('seller')}
          >Seller</button>
        </div>

        <div className="mb-6 flex items-center justify-between bg-yellow-50 p-3 rounded-lg border border-primary">
          <span className="text-sm font-semibold text-gray-800">Use Face ID</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={isFaceLogin} onChange={() => setIsFaceLogin(!isFaceLogin)} />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {isFaceLogin && (
          <div className="mb-6 flex flex-col items-center">
            <div className="rounded-xl overflow-hidden shadow-inner border-4 border-gray-100 w-full flex justify-center bg-black">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                width={320}
                height={240}
                videoConstraints={{ facingMode: "user" }}
              />
            </div>
            {!isRegister && (
              <button 
                onClick={handleFaceLogin}
                disabled={isLoading}
                className={`mt-4 w-full bg-secondary text-white py-3 rounded-lg font-bold shadow-md transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'}`}
              >
                {isLoading ? 'Scanning Face...' : 'Login with Face ID'}
              </button>
            )}
          </div>
        )}

        {(!isFaceLogin || isRegister) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <input 
                type="text" placeholder="Full Name" required value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none"
              />
            )}
            <input 
              type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <input 
              type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <button type="submit" disabled={isLoading} className={`w-full bg-primary text-black py-3 rounded-lg font-bold text-lg shadow-md transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-400'}`}>
              {isLoading ? 'Processing...' : (isRegister ? 'Sign Up' : 'Login')}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => setIsRegister(!isRegister)} className="font-bold text-primary hover:underline">
            {isRegister ? 'Login here' : 'Sign up here'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
