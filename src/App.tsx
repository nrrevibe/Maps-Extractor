import React, { useState } from 'react';
import { Header } from './components/Header';
import { MapsExtractor } from './components/MapsExtractor';
import { LeadsCRMTable } from './components/LeadsCRMTable';
import { LeadDetailModal } from './components/LeadDetailModal';
import { EmailCampaignManager } from './components/EmailCampaignManager';
import { ExtensionSimulator } from './components/ExtensionSimulator';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SettingsModal } from './components/SettingsModal';
import { useLeadContext } from './context/LeadContext';
import { Lead } from './types';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const { 
    leads, 
    settings, 
    handleUpdateSettings, 
    handleSyncFromGoogleSheets,
    handleAddLeads, 
    handleUpdateLead, 
    handleDeleteLead,
    existingLeadIds,
    isConnected 
  } = useLeadContext();

  const [activeTab, setActiveTab] = useState<'extractor' | 'crm' | 'emails' | 'extension' | 'analytics'>('extractor');
  const [selectedLeadForModal, setSelectedLeadForModal] = useState<Lead | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleDeleteLeadModal = async (id: string) => {
    await handleDeleteLead(id);
    if (selectedLeadForModal?.id === id) {
      setSelectedLeadForModal(null);
    }
  };

  // Batch Gemini AI Audit
  const handleRunBatchAIAudit = async (selectedIds: string[]) => {
    for (const id of selectedIds) {
      const target = leads.find(l => l.id === id);
      if (target) {
        try {
          const res = await fetch('/api/ai-recommendation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead: target, agencyName: settings.agencyName }),
          });
          const data = await res.json();
          if (data.success && data.aiAnalysis) {
            handleUpdateLead({
              ...target,
              aiAnalysis: data.aiAnalysis,
              notes: `${target.notes || ''}\n\n[BATCH AI AUDIT]\n${data.aiAnalysis}`,
            });
          }
        } catch (e) {
          console.error('Batch AI Error:', e);
        }
      }
    }
  };

  const hotLeadCount = leads.filter(l => l.leadScore >= 80).length;
  const approvedEmailCount = leads.filter(l => l.emailStatus === 'Approved').length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Global Connection Banner */}
      {!isConnected && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span className="text-xs font-bold text-rose-700">
            Local server disconnected. Cannot sync data to Google Sheets. Please ensure `node --import tsx server.ts` is running.
          </span>
        </div>
      )}

      {/* App Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        leadCount={leads.length}
        hotLeadCount={hotLeadCount}
        approvedEmailCount={approvedEmailCount}
      />

      {/* Main Tab Content */}
      <main className="flex-1 max-w-full w-full px-6 py-6">
        {activeTab === 'extractor' && (
          <MapsExtractor
            onAddLeads={handleAddLeads}
            existingLeadIds={existingLeadIds}
            onSyncFromSheets={handleSyncFromGoogleSheets}
            settings={settings}
          />
        )}

        {activeTab === 'crm' && (
          <LeadsCRMTable
            leads={leads}
            onUpdateLead={handleUpdateLead}
            onDeleteLead={handleDeleteLeadModal}
            onSelectLeadForModal={lead => setSelectedLeadForModal(lead)}
            onRunBatchAIAudit={handleRunBatchAIAudit}
            onAddLeads={handleAddLeads}
            settings={settings}
          />
        )}

        {activeTab === 'emails' && (
          <EmailCampaignManager
            leads={leads}
            onUpdateLead={handleUpdateLead}
            settings={settings}
          />
        )}

        {activeTab === 'extension' && (
          <ExtensionSimulator
            leads={leads}
            settings={settings}
            onAddLeads={handleAddLeads}
          />
        )}

        {activeTab === 'analytics' && <AnalyticsDashboard leads={leads} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 font-medium">
        NR Revibe Lead Generation & Google Sheets Extension Suite • Website Development & Social Media Management
      </footer>

      {/* Modals */}
      <LeadDetailModal
        lead={selectedLeadForModal}
        onClose={() => setSelectedLeadForModal(null)}
        onUpdateLead={handleUpdateLead}
        settings={settings}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleUpdateSettings}
      />
    </div>
  );
}
