import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Search, FileText, CheckCircle2, TrendingUp, AlertCircle, ArrowRight, Lightbulb, Sparkles, Download, Copy, Wrench } from 'lucide-react'
import { Card, Button, Input, Badge, Modal } from './ui'
import axios from 'axios'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker
import { API_BASE, getAuthHeader } from '../config/api'

const ResumeAnalyzer = () => {
  const [file, setFile] = useState(null)
  const [jd, setJd] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', description: '' })

  const extractTextFromPdf = async (file) => {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      fullText += textContent.items.map(item => item.str).join(' ') + '\n'
    }
    return fullText
  }

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });

  const uploadToS3 = async (file) => {
    // Step 1: Get a pre-signed URL from our backend
    const urlRes = await axios.post(`${API_BASE}get-upload-url`, 
      { fileName: file.name },
      { headers: getAuthHeader() }
    );
    const { uploadUrl, s3Key } = urlRes.data;

    // Step 2: Upload the raw PDF directly to S3 (bypasses API Gateway size limit)
    await axios.put(uploadUrl, file, {
      headers: { 'Content-Type': 'application/pdf' }
    });

    return s3Key;
  };

  const handleAnalyze = async () => {
    if (!file) return
    
    if (!jd.trim()) {
      setErrorModal({
        isOpen: true,
        title: 'Job Description Required',
        description: 'Please paste the target job description to generate an accurate alignment report.'
      })
      return
    }
    
    setLoading(true)
    try {
      const text = await extractTextFromPdf(file)
      if (!text || text.trim().length === 0) {
        throw new Error("Could not extract text from PDF. Is the file encrypted or empty?")
      }
      
      // Upload raw PDF directly to S3 via pre-signed URL
      let s3Key = null;
      try {
        s3Key = await uploadToS3(file);
      } catch (s3Err) {
        console.warn('S3 upload failed, continuing without storage:', s3Err);
      }

      const response = await axios.post(`${API_BASE}analyze`, { 
        text: text, 
        jobDescription: jd,
        s3Key: s3Key
      }, { headers: getAuthHeader() })
      setResult(response.data)
    } catch (error) {
      console.error("ANALYSIS_ERROR:", error)
      const errorMsg = error.response?.data?.error || error.message || "Unknown Connection Error"
      
      if (error.response?.status === 401) {
        // Token is invalid/expired. Clear it and force re-login.
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
        return;
      }

      if (errorMsg.includes("Resume not found")) {
        setErrorModal({
          isOpen: true,
          title: 'Resume Not Found',
          description: 'The uploaded file does not appear to be a professional resume. Please try a different file.'
        })
      } else {
        setErrorModal({
          isOpen: true,
          title: 'Analysis Failed',
          description: errorMsg
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    // Optionally trigger a toast here
  };

  const generateResumeHTML = (resume) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${resume.name || 'Optimized Resume'}</title>
<style>
  body { font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 850px; margin: 0 auto; padding: 40px; background: #fff; }
  h1 { text-align: center; color: #0f172a; margin-bottom: 8px; font-size: 36px; font-weight: 900; letter-spacing: -0.5px; }
  .summary { text-align: center; color: #64748b; margin-bottom: 40px; font-size: 15px; max-width: 700px; margin-left: auto; margin-right: auto; }
  h2 { border-bottom: 2px solid #3b82f6; color: #0f172a; padding-bottom: 8px; margin-top: 35px; text-transform: uppercase; font-size: 14px; font-weight: 800; letter-spacing: 1.5px; }
  .skills-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
  .skill-badge { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  .experience-item { margin-bottom: 24px; margin-top: 15px; }
  .experience-role { font-weight: 700; font-size: 16px; color: #0f172a; margin-bottom: 6px; }
  .experience-desc { margin-top: 4px; color: #475569; font-size: 14px; }
  ul { padding-left: 20px; margin-top: 10px; }
  li { margin-bottom: 6px; font-size: 14px; color: #475569; }
</style>
</head>
<body>
  <h1>${resume.name || 'Candidate Name'}</h1>
  <p class="summary">${resume.summary || ''}</p>
  
  <h2>Skills & Expertise</h2>
  <div class="skills-list">
    ${(resume.skills || []).map(s => `<span class="skill-badge">${s}</span>`).join('')}
  </div>

  <h2>Professional Experience</h2>
  ${(resume.experience || []).map(e => `
    <div class="experience-item">
      <div class="experience-role">${e.role || ''}</div>
      <div class="experience-desc">${e.description || ''}</div>
    </div>
  `).join('')}

  <h2>Projects</h2>
  <ul>
    ${(resume.projects || []).map(p => `<li>${p}</li>`).join('')}
  </ul>

  <h2>Education</h2>
  <p style="font-size: 14px; color: #475569;">${resume.education || ''}</p>
</body>
</html>`;
  };

  const handleDownload = (resume) => {
    const htmlContent = generateResumeHTML(resume);
    const element = document.createElement("a");
    const file = new Blob([htmlContent], {type: 'text/html'});
    element.href = URL.createObjectURL(file);
    element.download = "Optimized_Resume.html";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const formatOptimizedResume = (resume) => {
    if (!resume) return '';
    return `${resume.name || 'Candidate Name'}\n\nSUMMARY:\n${resume.summary || ''}\n\nSKILLS:\n${(resume.skills || []).join(' | ')}\n\nEXPERIENCE:\n${(resume.experience || []).map(e => `${e.role || ''}\n- ${e.description || ''}`).join('\n\n')}\n\nPROJECTS:\n${(resume.projects || []).join('\n')}\n\nEDUCATION:\n${resume.education || ''}`;
  };

  return (
    <div className="space-y-16">
      <AnimatePresence>
        <Modal 
          isOpen={errorModal.isOpen} 
          onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
          title={errorModal.title}
          description={errorModal.description}
          variant="error"
        />
      </AnimatePresence>

      {/* Hero Section */}
      {!result && (
        <section className="grid lg:grid-cols-2 gap-12 items-center min-h-[60vh]">
          <div className="space-y-8">
            <Badge variant="neutral">AI-Powered Intelligence</Badge>
            <h1 className="text-6xl font-black text-slate-900 leading-[1.1] tracking-tight">
              Analyze, Match, and <span className="text-primary">Optimize</span> Resumes.
            </h1>
            <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-lg">
              Upload your resume and match it against any job description with high-precision AI analysis.
            </p>
            <div className="flex flex-col gap-4">
              <label className="relative block group">
                <input type="file" className="hidden" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} />
                <div className={`w-full max-w-sm h-16 border-2 border-dashed rounded-2xl flex items-center justify-center gap-3 transition-all cursor-pointer ${file ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-400'}`}>
                   <Upload className={file ? 'text-primary' : 'text-slate-400'} size={20} />
                   <span className={`text-sm font-bold ${file ? 'text-primary' : 'text-slate-500'}`}>
                     {file ? file.name : 'Upload Resume (PDF)'}
                   </span>
                </div>
              </label>
              <Button onClick={handleAnalyze} disabled={!file || loading} className="max-w-sm py-4 h-16">
                {loading ? 'Analyzing Intelligence...' : 'Generate Analysis Report'}
              </Button>
            </div>
          </div>

          <Card className="h-full min-h-[400px] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Search className="text-slate-400" size={18} />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Job Description Context</span>
            </div>
            <textarea 
              className="flex-1 w-full bg-slate-50 rounded-xl p-6 text-sm font-medium border-none focus:ring-0 resize-none placeholder:text-slate-300"
              placeholder="Paste the target job description here for semantic alignment..."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
          </Card>
        </section>
      )}

      {/* Result Dashboard */}
      {result && (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Analysis Report</h2>
              <p className="text-slate-500 font-medium">Detailed breakdown of candidate-role alignment</p>
            </div>
            <Button variant="secondary" onClick={() => setResult(null)}>Reset Analysis</Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* ATS Score Card */}
            <Card title="ATS Compliance Score" icon={TrendingUp} className="flex flex-col items-center justify-center py-10">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="absolute w-full h-full -rotate-90">
                  <circle cx="80" cy="80" r="72" fill="transparent" stroke="#E2E8F0" strokeWidth="12" />
                  <motion.circle 
                    cx="80" cy="80" r="72" fill="transparent" 
                    stroke={result.ats_score > 70 ? '#10B981' : result.ats_score > 40 ? '#F59E0B' : '#EF4444'} 
                    strokeWidth="12"
                    strokeDasharray={452}
                    initial={{ strokeDashoffset: 452 }}
                    animate={{ strokeDashoffset: 452 - (452 * result.ats_score) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <span className="text-5xl font-black text-slate-900">{result.ats_score}%</span>
              </div>
              <p className="mt-8 text-xs font-black text-slate-400 uppercase tracking-widest">Optimized Match Rating</p>
            </Card>

            {/* Summary Card */}
            <Card title="Executive Summary" icon={Sparkles} className="lg:col-span-2">
              <p className="text-xl font-medium text-slate-600 leading-relaxed italic">"{result.summary}"</p>
            </Card>

            {/* Skills Card */}
            <Card title="Skills Matrix" icon={CheckCircle2} className="lg:col-span-2">
              <div className="grid sm:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Matching Proficiencies</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.skills.map(s => <Badge key={s} variant="success">{s}</Badge>)}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identified Gaps</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.missing_skills.map(s => <Badge key={s} variant="warning">{s}</Badge>)}
                  </div>
                </div>
              </div>
            </Card>

            </div>
          
          {/* Improve Your Resume Section (Only if ATS < 100) */}
          {result.ats_score < 100 && (
            <div className="mt-12 space-y-8">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <Wrench className="text-primary" size={28} />
                <h3 className="text-2xl font-black text-slate-900">Improve Your Resume</h3>
              </div>

              {/* Option 1: Manual Suggestions */}
              <Card title="Option 1: Manual Improvement Suggestions" icon={Lightbulb}>
                <div className="grid md:grid-cols-2 gap-8">
                  {Object.entries(result.suggestions || {}).map(([category, items]) => {
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={category} className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{category}</h4>
                        <ul className="space-y-2">
                          {items.map((item, idx) => (
                            <li key={idx} className="flex gap-3 text-sm text-slate-600 font-medium">
                              <span className="text-primary mt-0.5">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Option 2: AI Generated Optimized Resume */}
              {result.optimized_resume && (
                <Card title="Option 2: AI Generated Optimized Resume" icon={Sparkles}>
                  <div className="flex justify-end gap-3 mb-4">
                    <Button variant="secondary" className="!py-2 !px-4 text-xs" onClick={() => handleCopy(formatOptimizedResume(result.optimized_resume))}>
                      <Copy size={14} /> Copy Content
                    </Button>
                    <Button className="!py-2 !px-4 text-xs" onClick={() => handleDownload(result.optimized_resume)}>
                      <Download size={14} /> Download Resume
                    </Button>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 overflow-auto max-h-96">
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                      {formatOptimizedResume(result.optimized_resume)}
                    </pre>
                  </div>
                </Card>
              )}
            </div>
          )}
        </motion.section>
      )}
    </div>
  )
}

export default ResumeAnalyzer
