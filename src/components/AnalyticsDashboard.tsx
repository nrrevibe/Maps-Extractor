import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  BarChart2,
  PieChart as PieIcon,
  TrendingUp,
  Sparkles,
  Award,
  Target
} from 'lucide-react';
import { Lead } from '../types';
import { getMainCategory } from '../utils/categoryGrouping';

interface AnalyticsDashboardProps {
  leads: Lead[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ leads }) => {
  // Score Distribution
  const scoreData = [
    { name: '🔥 Hot Lead (80-100)', count: leads.filter(l => l.leadScore >= 80).length, color: '#f59e0b' },
    { name: '⚡ High Priority (60-79)', count: leads.filter(l => l.leadScore >= 60 && l.leadScore < 80).length, color: '#06b6d4' },
    { name: 'Medium Priority (40-59)', count: leads.filter(l => l.leadScore >= 40 && l.leadScore < 60).length, color: '#3b82f6' },
    { name: 'Low Priority (0-39)', count: leads.filter(l => l.leadScore < 40).length, color: '#64748b' },
  ];

  // Opportunity Types (Based on Suggested Services)
  const serviceCounts: Record<string, number> = {};
  leads.forEach(l => {
    const svc = l.suggestedService || 'Uncategorized';
    serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
  });

  const colors = ['#06b6d4', '#ec4899', '#a855f7', '#10b981', '#f59e0b', '#3b82f6', '#f43f5e', '#8b5cf6'];
  const opportunityData = Object.entries(serviceCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]) // sort by count descending
    .map(([name, count], idx) => ({
      name: name.length > 30 ? name.substring(0, 30) + '...' : name,
      value: count,
      color: colors[idx % colors.length]
    }));

  // Pipeline Status
  const funnelData = [
    { name: 'Extracted', count: leads.length },
    { name: 'Approved', count: leads.filter(l => l.leadStatus === 'Approved').length },
    { name: 'Contacted', count: leads.filter(l => l.leadStatus === 'Contacted').length },
    { name: 'Replied', count: leads.filter(l => l.leadStatus === 'Replied' || l.leadStatus === 'Won').length },
    { name: 'Won', count: leads.filter(l => l.leadStatus === 'Won').length },
  ];

  // Top Niches (Grouped by Main Category)
  const nicheCounts: Record<string, number> = {};
  leads.forEach(l => {
    const mainCategory = getMainCategory(l.category);
    nicheCounts[mainCategory] = (nicheCounts[mainCategory] || 0) + 1;
  });

  const nicheData = Object.entries(nicheCounts).map(([category, count]) => ({
    category,
    count,
  }));

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-medium">Estimated Pipeline Value</span>
          <div className="text-2xl font-black text-emerald-600">
            ₹{leads.reduce((sum, l) => {
              const val = parseInt((l.revenuePotential || '15000').replace(/[^0-9]/g, '')) || 15000;
              return sum + val;
            }, 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Sum of agency package opportunities</span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-medium">Average Lead Score</span>
          <div className="text-2xl font-black text-indigo-600">
            {leads.length > 0 ? Math.round(leads.reduce((a, b) => a + b.leadScore, 0) / leads.length) : 0} / 100
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Technical & social quality score</span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-medium">No Website Leads</span>
          <div className="text-2xl font-black text-amber-600">
            {leads.filter(l => !l.websiteUrl || l.websiteStatus === 'No Website').length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Prime Website Redesign Leads</span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-medium">Unsecure (HTTP) Sites</span>
          <div className="text-2xl font-black text-rose-600">
            {leads.filter(l => l.websiteUrl && !l.https).length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">SSL Security Gap Leads</span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-medium">Inactive Socials</span>
          <div className="text-2xl font-black text-purple-600">
            {leads.filter(l => l.socialStatus === 'Inactive' || l.socialStatus === 'Missing').length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Social Management Leads</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Breakdown Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <BarChart2 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">Lead Priority & Score Distribution</h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {scoreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Opportunity Types Pie Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <PieIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">NR Revibe Service Opportunity Breakdown</h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={opportunityData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {opportunityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Campaign Funnel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Lead Conversion Pipeline Funnel</h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical">
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Target Niches */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Target className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-sm">Top Lead Categories Extracted</h3>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nicheData}>
                <XAxis dataKey="category" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
