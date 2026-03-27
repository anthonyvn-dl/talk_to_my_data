import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, BarChart2, Lock, LogIn, User, Bot, Loader2, AlertCircle, Table as TableIcon, LineChart as LineChartIcon, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, LabelList, PieChart, Pie, Cell } from 'recharts';
import { getChatResponse, runAnalyticsQuery } from '../services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  visualization?: {
    type: 'table' | 'lineChart' | 'barChart' | 'pieChart';
    title: string;
    data: any[];
    xAxis: string;
    yAxis: string;
    series: string[];
  };
}

const COLORS = ['#6454FB', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg shadow-brand/20", className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full p-2" xmlns="http://www.w3.org/2000/svg">
        <g fill="#141414">
          <path fillRule="evenodd" clipRule="evenodd" d="M30 80C16.1929 80 5 68.8071 5 55C5 41.1929 16.1929 30 30 30C43.8071 30 55 41.1929 55 55C55 68.8071 43.8071 80 30 80ZM30 65C35.5228 65 40 60.5228 40 55C40 49.4772 35.5228 45 30 45C24.4772 45 20 49.4772 20 55C20 60.5228 24.4772 65 30 65Z" />
          <rect x="40" y="20" width="15" height="60" />
          <polygon points="60,80 75,80 95,20 80,20" />
        </g>
      </svg>
    </div>
  );
}
function Visualization({ data }: { data: Message['visualization'] }) {
  if (!data) return null;

  const [currentType, setCurrentType] = useState(data.type || 'table');

  // Sanitize data: Ensure values are numbers for charts
  const sanitizedData = data.data?.map(item => {
    const newItem = { ...item };
    data.series?.forEach(key => {
      if (typeof newItem[key] === 'string') {
        const num = parseFloat(newItem[key].replace(/[^0-9.-]+/g, ""));
        if (!isNaN(num)) newItem[key] = num;
      }
    });
    return newItem;
  });

  const renderChart = () => {
    switch (currentType) {
      case 'lineChart':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sanitizedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={data.xAxis} fontSize={10} tickMargin={10} />
              <YAxis fontSize={10} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e5e5', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              {data.series?.map((s, i) => (
                <Line 
                  key={s} 
                  type="monotone" 
                  dataKey={s} 
                  stroke={COLORS[i % COLORS.length]} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList dataKey={s} position="top" offset={10} fontSize={10} fill="#666" />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'barChart':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sanitizedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={data.xAxis} fontSize={10} tickMargin={10} />
              <YAxis fontSize={10} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e5e5', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              {data.series?.map((s, i) => (
                <Bar 
                  key={s} 
                  dataKey={s} 
                  fill={COLORS[i % COLORS.length]} 
                  radius={[4, 4, 0, 0]}
                >
                  <LabelList dataKey={s} position="top" fontSize={10} fill="#666" />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pieChart':
        const pieData = sanitizedData.map(item => ({
          name: item[data.xAxis],
          value: item[data.series[0]]
        }));
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'table':
      default:
        const keys = (data.data && data.data.length > 0) ? Object.keys(data.data[0]) : [];
        return (
          <div className="overflow-x-auto border border-zinc-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  {keys.map(k => (
                    <th key={k} className="px-4 py-2 font-semibold text-zinc-500 uppercase tracking-wider">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.data?.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                    {keys.map(k => (
                      <td key={k} className="px-4 py-2 text-zinc-700">{row[k]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <div className="mt-4 p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
          {currentType === 'lineChart' && <LineChartIcon className="w-4 h-4 text-brand" />}
          {currentType === 'barChart' && <BarChart3 className="w-4 h-4 text-brand" />}
          {currentType === 'pieChart' && <PieChartIcon className="w-4 h-4 text-brand" />}
          {currentType === 'table' && <TableIcon className="w-4 h-4 text-brand" />}
          {data.title}
        </h3>
        <div className="flex items-center gap-1 bg-zinc-50 p-1 rounded-lg border border-zinc-100">
          <button 
            onClick={() => setCurrentType('table')}
            className={cn("p-1.5 rounded-md transition-all", currentType === 'table' ? "bg-white shadow-sm text-brand" : "text-zinc-400 hover:text-zinc-600")}
            title="Table"
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setCurrentType('lineChart')}
            className={cn("p-1.5 rounded-md transition-all", currentType === 'lineChart' ? "bg-white shadow-sm text-brand" : "text-zinc-400 hover:text-zinc-600")}
            title="Line Chart"
          >
            <LineChartIcon className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setCurrentType('barChart')}
            className={cn("p-1.5 rounded-md transition-all", currentType === 'barChart' ? "bg-white shadow-sm text-brand" : "text-zinc-400 hover:text-zinc-600")}
            title="Bar Chart"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setCurrentType('pieChart')}
            className={cn("p-1.5 rounded-md transition-all", currentType === 'pieChart' ? "bg-white shadow-sm text-brand" : "text-zinc-400 hover:text-zinc-600")}
            title="Pie Chart"
          >
            <PieChartIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {renderChart()}
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [propertyId, setPropertyId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/analytics/properties');
      if (res.ok) setIsAuthenticated(true);
    } catch (e) {
      console.error('Auth check failed');
    }
  };

  const handleLogin = async () => {
    const res = await fetch('/api/auth/url');
    const { url } = await res.json();
    const width = 600, height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(url, 'google_auth', `width=${width},height=${height},left=${left},top=${top}`);
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsAuthenticated(true);
        window.removeEventListener('message', handleMessage);
      }
    };
    window.addEventListener('message', handleMessage);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chatMessages = [
        ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        { role: 'user' as const, parts: [{ text: input + (propertyId ? ` (Using Property ID: ${propertyId})` : '') }] }
      ];

      let response = await getChatResponse(chatMessages);
      
      // Handle function calls
      if (response.functionCalls) {
        for (const call of response.functionCalls) {
          if (call.name === 'query_google_analytics') {
            const data = await runAnalyticsQuery(call.args);
            
            // Send tool response back to Gemini
            const toolResponseMessages = [
              ...chatMessages,
              { role: 'model' as const, parts: [{ text: response.text || 'Querying data...' }] },
              {
                role: 'user' as const, // In @google/genai, tool responses are often sent as a follow-up
                parts: [{ text: `Tool result for ${call.name}: ${JSON.stringify(data)}` }]
              }
            ];
            
            response = await getChatResponse(toolResponseMessages);
          }
        }
      }

      // Parse visualization data from response
      let content = response.text || 'I processed your request.';
      let visualization: Message['visualization'] | undefined;

      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          visualization = JSON.parse(jsonMatch[1]);
          // Remove the JSON block from the content to keep the chat clean
          content = content.replace(jsonMatch[0], '').trim();
        } catch (e) {
          console.error('Failed to parse visualization JSON', e);
        }
      }

      const modelMessage: Message = { 
        role: 'model', 
        content,
        visualization
      };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || 'An unexpected error occurred.';
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `**Error:** ${errorMessage}\n\n*Please verify your Property ID and ensure the Google Analytics Data API is enabled in your Google Cloud project.*` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 p-8">
        <Logo className="w-20 h-20" />
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900">Connect Google Analytics</h2>
          <p className="text-zinc-500 max-w-md">
            To start analyzing your data, you need to authorize access to your Google Analytics account.
          </p>
        </div>
        <button
          onClick={handleLogin}
          className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-xl hover:bg-brand-hover transition-all font-medium shadow-lg shadow-brand/20"
        >
          <LogIn className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-bottom border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="w-10 h-10" />
          <div>
            <h1 className="font-bold text-zinc-900">RoithAI</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-brand rounded-full animate-pulse" />
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Connected</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-tight">Property ID</label>
          <input
            type="text"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            placeholder="e.g. 123456789"
            className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all w-32"
          />
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
            <div className="p-4 bg-zinc-100 rounded-full">
              <Bot className="w-8 h-8 text-zinc-400" />
            </div>
            <p className="text-zinc-500 text-sm max-w-xs">
              Ask me anything about your analytics. Try "What was my traffic like last week?"
            </p>
          </div>
        )}
        
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4",
                m.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                m.role === 'user' ? "bg-zinc-100" : "bg-brand/10"
              )}>
                {m.role === 'user' ? <User className="w-5 h-5 text-zinc-600" /> : <Bot className="w-5 h-5 text-brand" />}
              </div>
              <div className={cn(
                "max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                m.role === 'user' 
                  ? "bg-zinc-900 text-white rounded-tr-none" 
                  : m.role === 'system'
                    ? "bg-red-50 text-red-600 border border-red-100"
                    : "bg-zinc-50 text-zinc-800 border border-zinc-100 rounded-tl-none"
              )}>
                <div className="prose prose-sm max-w-none prose-zinc dark:prose-invert prose-table:border prose-table:border-zinc-200 prose-th:bg-zinc-100 prose-th:px-2 prose-td:px-2 prose-td:border-t prose-td:border-zinc-100">
                  <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                </div>
                {m.visualization && <Visualization data={m.visualization} />}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-4"
          >
            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 text-brand animate-spin" />
            </div>
            <div className="bg-zinc-50 px-4 py-3 rounded-2xl rounded-tl-none border border-zinc-100">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 border-t border-zinc-100 bg-white">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isAuthenticated ? "Ask about your analytics..." : "Please sign in first"}
            disabled={!isAuthenticated || isLoading}
            className="w-full pl-4 pr-12 py-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !isAuthenticated}
            className="absolute right-2 top-2 bottom-2 px-4 bg-brand text-white rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50 disabled:hover:bg-brand"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="mt-3 text-[10px] text-center text-zinc-400 uppercase tracking-widest font-bold">
          Powered by Gemini 3 Flash & Google Analytics Data API
        </p>
      </div>
    </div>
  );
}
