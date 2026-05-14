import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, ChevronRight, Clock, FileText, User } from 'lucide-react'
import { Card, Button, Badge, Input } from './ui'
import axios from 'axios'

import { API_BASE, getAuthHeader } from '../config/api'

const HistoryDashboard = () => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE}history`, { headers: getAuthHeader() })
      setHistory(response.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const filteredHistory = history.filter(item => 
    item.ResumeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.Data.summary.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Intelligence Warehouse</h2>
          <p className="text-slate-500 font-medium mt-2">Manage and review historical candidate analysis</p>
        </div>
        
        <div className="flex gap-4">
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search Candidate ID..." 
              className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={fetchHistory}>
            <Clock size={16} />
          </Button>
        </div>
      </div>

      <Card className="!p-0 overflow-hidden border-slate-100">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/50">
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidate Reference</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Temporal Log</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ATS Score</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Summary Preview</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredHistory.length > 0 ? filteredHistory.map((item, index) => (
              <motion.tr 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                key={item.ResumeId} 
                className="group hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 border border-slate-200">
                      <User size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">ID #{item.ResumeId.slice(0, 8).toUpperCase()}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{item.UserId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6 text-sm text-slate-500 font-medium">
                  {new Date(item.Timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-8 py-6 text-center">
                  <Badge variant={item.Data.ats_score > 70 ? 'success' : item.Data.ats_score > 40 ? 'warning' : 'error'}>
                    {item.Data.ats_score}%
                  </Badge>
                </td>
                <td className="px-8 py-6 max-w-xs">
                  <p className="text-slate-500 text-xs font-medium leading-relaxed truncate group-hover:text-slate-800 transition-colors">
                    {item.Data.summary}
                  </p>
                </td>
                <td className="px-8 py-6 text-right">
                  <Button variant="ghost" className="p-2">
                    <ChevronRight size={20} />
                  </Button>
                </td>
              </motion.tr>
            )) : (
              <tr>
                <td colSpan="5" className="px-8 py-32 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
                  {loading ? 'Synthesizing Warehouse...' : 'No Intelligence Records Found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

export default HistoryDashboard
