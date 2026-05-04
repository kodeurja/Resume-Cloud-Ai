import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ResumeAnalyzer from './components/ResumeAnalyzer'
import HistoryDashboard from './components/HistoryDashboard'
import AIChatbot from './components/AIChatbot'
import Login from './components/auth/Login'
import SignUp from './components/auth/SignUp'
import { Button } from './components/ui'
import { Command, Layout, FileText, Activity, MessageSquare } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState('analyze')
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'))
  const [userName, setUserName] = useState(localStorage.getItem('name') || '')
  const [authView, setAuthView] = useState('login')

  const handleLogout = async () => {
    try {
      await fetch('http://127.0.0.1:3000/auth/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    localStorage.removeItem('name');
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-app-bg">
      {/* SaaS Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 h-16">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Command className="text-white" size={18} />
            </div>
            <span className="font-extrabold text-slate-900 tracking-tight">RESUME<span className="text-primary">.AI</span></span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <NavBtn label="Analyze" icon={<FileText size={16} />} active={activeTab === 'analyze'} onClick={() => setActiveTab('analyze')} />
            <NavBtn label="History" icon={<Layout size={16} />} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          </div>

          <div className="flex items-center gap-4">
            {!isLoggedIn ? (
              <Button variant="secondary" className="!py-2 !px-4 text-xs" onClick={() => setAuthView(authView === 'login' ? 'signup' : 'login')}>
                {authView === 'login' ? 'Create Account' : 'Sign In'}
              </Button>
            ) : (
              <Button variant="ghost" className="!py-2 !px-4 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={handleLogout}>Sign Out</Button>
            )}
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs ${isLoggedIn ? 'bg-primary text-white border-primary shadow-sm' : 'bg-slate-200 border-slate-300 text-slate-400'}`}>
              {isLoggedIn ? (userName ? userName.charAt(0).toUpperCase() : 'U') : '?'}
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-6 max-w-6xl mx-auto">

        <AnimatePresence mode="wait">
          {!isLoggedIn ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex justify-center items-center py-10"
            >
              {authView === 'login' ? (
                <Login 
                  onSwitchToSignUp={() => setAuthView('signup')} 
                  onLoginSuccess={(token, email, name) => {
                    localStorage.setItem('token', token);
                    localStorage.setItem('email', email);
                    if (name) localStorage.setItem('name', name);
                    setUserName(name || '');
                    setIsLoggedIn(true);
                  }} 
                />
              ) : (
                <SignUp 
                  onSwitchToLogin={() => setAuthView('login')} 
                  onSignUpSuccess={(email) => {
                    setAuthView('login');
                  }} 
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'analyze' ? <ResumeAnalyzer /> : <HistoryDashboard />}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isLoggedIn && <AIChatbot />}
    </div>
  )
}

const NavBtn = ({ label, icon, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
  >
    {icon}
    {label}
  </button>
)

export default App
