/**
 * Centralized API configuration and sanitization.
 * Prevents "Invalid URL" errors by ensuring API_BASE is always a valid string.
 */

const getApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE;
  
  // Defensive checks for 'undefined' or 'null' strings which can happen with some build setups
  if (!envBase || envBase === 'undefined' || envBase === 'null' || envBase.trim() === '') {
    return 'http://127.0.0.1:3000/';
  }
  
  // Ensure the base ends with a single slash
  const base = envBase.trim();
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  
  // If it's a relative path like /api/, make it absolute using the browser's current origin
  if (normalizedBase.startsWith('/')) {
    // Check if we are in a browser environment
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${normalizedBase}`;
    }
  }
  
  return normalizedBase;
};

export const API_BASE = getApiBase();

export const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
