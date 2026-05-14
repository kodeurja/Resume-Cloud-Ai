import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import axios from 'axios';
import { Button } from '../ui';

import { API_BASE } from '../config/api';

const Login = ({ onSwitchToSignUp, onLoginSuccess }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE}auth/login`, formData);
      onLoginSuccess(response.data.token, response.data.email, response.data.name);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md mx-auto bg-white p-8 rounded-3xl shadow-premium border border-slate-100"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Welcome Back</h2>
        <p className="text-slate-500 text-sm mt-2">Sign in to continue to your dashboard.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium border border-rose-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="email" 
              required
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="password" 
              required
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>
        </div>

        <Button type="submit" disabled={loading} className="w-full justify-center !py-3.5 mt-2">
          {loading ? <Loader2 className="animate-spin" size={18} /> : (
            <>
              Sign In <ArrowRight size={18} />
            </>
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm font-medium text-slate-500">
        Don't have an account?{' '}
        <button onClick={onSwitchToSignUp} className="text-primary hover:text-primary-hover font-bold">
          Create one
        </button>
      </p>
    </motion.div>
  );
};

export default Login;
