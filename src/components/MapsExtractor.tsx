import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Filter,
  Play,
  RotateCcw,
  Sparkles,
  Globe,
  Star,
  CheckCircle,
  AlertTriangle,
  PlusCircle,
  ExternalLink,
  ShieldAlert,
  Smartphone,
  Flame
} from 'lucide-react';
import { Lead, ScraperFilter, AgencySettings } from '../types';
import { RefreshCw, Download, FileSpreadsheet } from 'lucide-react';

interface MapsExtractorProps {
  onAddLeads: (newLeads: Lead[]) => void;
  existingLeadIds: Set<string>;
  onSyncFromSheets: () => Promise<void>;
  settings: AgencySettings;
}

export const MapsExtractor: React.FC<MapsExtractorProps> = ({
  onAddLeads,
  existingLeadIds,
  onSyncFromSheets,
  settings,
}) => {
  const [isExtracting, setIsExtracting] = useState(false);

  const handleSyncClick = async () => {
    setIsExtracting(true);
    try {
      await onSyncFromSheets();
    } finally {
      setIsExtracting(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs px-3 py-1 rounded-full mb-3 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>NR Rvibe Live Lead Collector</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
            Real-Time Lead Extraction & Google Sheets CRM Sync
          </h2>
          <p className="mt-2 text-slate-300 text-sm leading-relaxed">
            Extract local business leads in real-time directly from active Google Maps pages using our Chrome Extension. All leads are automatically synced to your Google Sheet database and loaded here.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Sync Controller */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <span>Google Sheets Database Sync</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Retrieve newly extracted local business leads from your master Google Sheets database. Make sure your Google Apps Script Web App URL is configured in Settings.
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Google Apps Script URL:</span>
                <span className={`font-mono font-bold ${settings.googleAppsScriptUrl ? 'text-indigo-600' : 'text-amber-600'}`}>
                  {settings.googleAppsScriptUrl ? 'Configured ✓' : 'Not Set ✗'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Target Sheet Name:</span>
                <span className="text-slate-800 font-bold">{settings.sheetName || 'NR Rvibe Master DB'}</span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={onSyncFromSheets}
              disabled={isExtracting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sync Live Leads from Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Right Side: Setup Instructions */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <span>Chrome Extension Guide</span>
          </h3>

          <div className="space-y-4 text-xs text-slate-600 font-medium">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                1
              </div>
              <div>
                <p className="text-slate-900 font-bold">Download Chrome Extension Package</p>
                <p className="text-slate-500 mt-0.5">
                  Go to the <strong>Extension Simulator</strong> tab and click the download button to get the pre-configured zip package.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                2
              </div>
              <div>
                <p className="text-slate-900 font-bold">Load Extension in Chrome Developer Mode</p>
                <p className="text-slate-500 mt-0.5">
                  Navigate to <code>chrome://extensions</code>, enable <strong>Developer mode</strong> in the top-right corner, click <strong>Load unpacked</strong>, and select the extracted extension folder.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                3
              </div>
              <div>
                <p className="text-slate-900 font-bold">Extract directly from Google Maps</p>
                <p className="text-slate-500 mt-0.5">
                  Search for target local businesses on Google Maps (e.g. "Beauty Salons in London"), open the NR Rvibe Extension, and click <strong>Extract Leads</strong> to sync them directly to your sheets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
