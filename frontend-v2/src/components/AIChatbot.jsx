import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Send, Command, Sparkles, Bot } from 'lucide-react'
import { Button } from './ui'
import axios from 'axios'

import { API_BASE, getAuthHeader } from '../config/api'

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'Uplink established. I am your Talent Assistant. How can I assist your candidate search today?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = await axios.post(`${API_BASE}chat`, { query: input }, { headers: getAuthHeader() })
      setMessages(prev => [...prev, { role: 'bot', content: response.data.answer }])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: " Handshake failed. Please retry." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-10 right-10 z-[200]">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-[380px] h-[580px] mb-6 flex flex-col bg-white border border-slate-200 rounded-[2rem] shadow-premium overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <Command size={18} />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 tracking-tight">TALENT BOT</div>
                  <div className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((m, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i} 
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-medium leading-relaxed ${m.role === 'user' ? 'bg-primary text-white rounded-tr-none shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full bg-white border border-slate-200 rounded-xl pl-5 pr-14 py-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-300"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <button 
                  onClick={handleSend} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-primary hover:bg-primary-hover rounded-lg text-white transition-all shadow-md shadow-primary/20"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all text-white"
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
      </button>
    </div>
  )
}

export default AIChatbot
