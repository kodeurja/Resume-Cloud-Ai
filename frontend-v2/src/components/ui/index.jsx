import React from 'react'
import { motion } from 'framer-motion'

export const Card = ({ children, className = '', title, icon: Icon }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white border border-slate-200 rounded-2xl shadow-soft p-6 ${className}`}
  >
    {title && (
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-50">
        {Icon && <Icon className="text-primary" size={20} />}
        <h3 className="font-bold text-slate-800 tracking-tight">{title}</h3>
      </div>
    )}
    {children}
  </motion.div>
)

export const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20',
    secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
  }
  
  return (
    <motion.button 
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export const Input = ({ label, ...props }) => (
  <div className="space-y-2">
    {label && <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>}
    <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-300" {...props} />
  </div>
)

export const Badge = ({ children, variant = 'success' }) => {
  const variants = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    warning: 'bg-amber-50 text-amber-600 border-amber-100',
    error: 'bg-rose-50 text-rose-600 border-rose-100',
    neutral: 'bg-slate-50 text-slate-600 border-slate-100'
  }
  
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${variants[variant]}`}>
      {children}
    </span>
  )
}

export const Modal = ({ isOpen, onClose, title, description, variant = 'error' }) => {
  if (!isOpen) return null

  const icons = {
    error: <svg className="w-12 h-12 text-rose-500 bg-rose-100 p-2.5 rounded-full mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>,
    success: <svg className="w-12 h-12 text-emerald-500 bg-emerald-100 p-2.5 rounded-full mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>,
    info: <svg className="w-12 h-12 text-blue-500 bg-blue-100 p-2.5 rounded-full mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-sm bg-white rounded-2xl shadow-premium p-6 flex flex-col items-center text-center"
      >
        {icons[variant]}
        <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">{title}</h3>
        <p className="text-sm font-medium text-slate-500 mb-6 leading-relaxed">
          {description}
        </p>
        <Button onClick={onClose} className="w-full">Dismiss</Button>
      </motion.div>
    </div>
  )
}

