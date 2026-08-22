import React, { useMemo } from 'react';
import { Lead } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import { TrendingUp, Users, Target, Activity } from 'lucide-react';
import { motion } from 'motion/react';

interface CRMAnalyticsProps {
  leads: Lead[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const CRMAnalytics: React.FC<CRMAnalyticsProps> = ({ leads }) => {
  const stats = useMemo(() => {
    const totalLeads = leads.length;
    const avgScore = totalLeads ? Math.round(leads.reduce((acc, l) => acc + (l.leadScore || 0), 0) / totalLeads) : 0;
    const contacted = leads.filter(l => l.leadStatus !== 'New' && l.leadStatus !== 'Needs Review').length;
    const won = leads.filter(l => l.leadStatus === 'Won').length;

    // Funnel Data
    const funnelData = [
      { name: 'Total Leads', value: totalLeads },
      { name: 'Approved', value: leads.filter(l => l.leadStatus === 'Approved').length },
      { name: 'Contacted', value: contacted },
      { name: 'Won', value: won },
    ];

    // Opportunity Data
    const oppMap = leads.reduce((acc, lead) => {
      const type = lead.opportunityType || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const opportunityData = Object.entries(oppMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Score Distribution
    const scoreRanges = {
      '90-100 (Hot)': 0,
      '70-89 (Warm)': 0,
      '50-69 (Cold)': 0,
      '< 50 (Dead)': 0,
    };
    leads.forEach(l => {
      const score = l.leadScore || 0;
      if (score >= 90) scoreRanges['90-100 (Hot)']++;
      else if (score >= 70) scoreRanges['70-89 (Warm)']++;
      else if (score >= 50) scoreRanges['50-69 (Cold)']++;
      else scoreRanges['< 50 (Dead)']++;
    });
    
    const scoreData = Object.entries(scoreRanges).map(([name, count]) => ({ name, count }));

    return { totalLeads, avgScore, contacted, won, funnelData, opportunityData, scoreData };
  }, [leads]);

  if (leads.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
    >
      {/* Top Stat Cards */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center space-x-4">
        <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Leads</p>
          <p className="text-2xl font-black text-slate-800">{stats.totalLeads}</p>
        </div>
      </div>
      
      <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center space-x-4">
        <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Avg Lead Score</p>
          <p className="text-2xl font-black text-slate-800">{stats.avgScore}</p>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center space-x-4">
        <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Contact Rate</p>
          <p className="text-2xl font-black text-slate-800">
            {stats.totalLeads ? Math.round((stats.contacted / stats.totalLeads) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center space-x-4">
        <div className="bg-rose-100 p-3 rounded-xl text-rose-600">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Won Clients</p>
          <p className="text-2xl font-black text-slate-800">{stats.won}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="md:col-span-2 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Lead Status Funnel</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.funnelData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="md:col-span-1 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Opportunity Mix</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.opportunityData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.opportunityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="md:col-span-1 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Quality Distribution</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.scoreData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={80} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
};
