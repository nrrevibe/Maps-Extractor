import React from 'react';
import {
  MapPin,
  Table,
  Mail,
  Chrome,
  BarChart2,
  Settings as SettingsIcon,
  Sparkles,
  CheckCircle2,
  Database,
  Globe,
  Share2
} from 'lucide-react';
import { AgencySettings } from '../types';

interface HeaderProps {
  activeTab: 'extractor' | 'crm' | 'emails' | 'extension' | 'analytics';
  setActiveTab: (tab: 'extractor' | 'crm' | 'emails' | 'extension' | 'analytics') => void;
  settings: AgencySettings;
  onOpenSettings: () => void;
  leadCount: number;
  hotLeadCount: number;
  approvedEmailCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  onOpenSettings,
  leadCount,
  hotLeadCount,
  approvedEmailCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-30 shadow-sm">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Logo & Agency Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-indigo-500/20">
            NR
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-lg tracking-tight text-slate-900">
                NR Revibe
              </h1>
              <span className="text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Extension Active
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Google Maps Extractor • Web Audit • AI Outreach • Google Sheets CRM
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="hidden md:flex items-center space-x-3 text-xs">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center space-x-2">
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-slate-500 font-medium">Total Scanned:</span>
            <span className="font-bold text-slate-800">{leadCount}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-slate-500 font-medium">Hot Leads:</span>
            <span className="font-bold text-amber-600">{hotLeadCount}</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center space-x-2">
            <Mail className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-slate-500 font-medium">Email Queue:</span>
            <span className="font-bold text-indigo-600">{approvedEmailCount}</span>
          </div>

          {/* Google Sheets Sync Indicator */}
          <button
            onClick={onOpenSettings}
            className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 hover:bg-emerald-100 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-xs">{settings.sheetName || 'Sheets Connected'}</span>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center space-x-1 text-xs border border-slate-200"
            title="Agency & Sheet Settings"
          >
            <SettingsIcon className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline font-semibold">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 overflow-x-auto">
        <nav className="flex space-x-1 sm:space-x-2 py-2">
          <button
            onClick={() => setActiveTab('extractor')}
            className={`px-3.5 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center space-x-2 whitespace-nowrap transition-all ${
              activeTab === 'extractor'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Google Maps Scraper</span>
          </button>

          <button
            onClick={() => setActiveTab('crm')}
            className={`px-3.5 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center space-x-2 whitespace-nowrap transition-all ${
              activeTab === 'crm'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Google Sheets CRM ({leadCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`px-3.5 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center space-x-2 whitespace-nowrap transition-all ${
              activeTab === 'emails'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>AI Email Campaigns</span>
            {approvedEmailCount > 0 && (
              <span className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full border font-bold ${
                activeTab === 'emails' ? 'bg-white/20 text-white border-white/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {approvedEmailCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('extension')}
            className={`px-3.5 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center space-x-2 whitespace-nowrap transition-all ${
              activeTab === 'extension'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Chrome className="w-4 h-4" />
            <span>Chrome Extension Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-lg font-semibold text-xs sm:text-sm flex items-center space-x-2 whitespace-nowrap transition-all ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Analytics & Insights</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
