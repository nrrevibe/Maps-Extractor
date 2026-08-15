import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MapsExtractor } from './components/MapsExtractor';
import { LeadsCRMTable } from './components/LeadsCRMTable';
import { LeadDetailModal } from './components/LeadDetailModal';
import { EmailCampaignManager } from './components/EmailCampaignManager';
import { ExtensionSimulator } from './components/ExtensionSimulator';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SettingsModal } from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useLeadStore } from './store/useLeadStore';
import { Lead } from './types';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const { 
    leads, 
    settings, 
    handleUpdateSettings, 
    handleAddLeads,
    handleUpdateLead, 
    handleDeleteLead,
    existingLeadIds,
    isConnected,
    setLeads,
    setIsConnected
  } = useLeadStore();

  const [activeTab, setActiveTab] = useState<'extractor' | 'crm' | 'emails' | 'extension' | 'analytics'>('extractor');
  const [selectedLeadForModal, setSelectedLeadForModal] = useState<Lead | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const fuzzyNameMatch = (a: string, b: string): boolean => {
    if (!a || !b) return false;
    const n1 = a.toLowerCase().replace(/[|•,]/g, ' ').replace(/\s+/g, ' ').trim();
    const n2 = b.toLowerCase().replace(/[|•,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;
    const w1 = n1.split(' ')[0];
    const w2 = n2.split(' ')[0];
    if (w1 && w2 && w1 === w2 && w1.length > 3) return true;
    return false;
  };

  const handleSyncFromLocalServer = async () => {
    try {
      const res = await fetch(`/api/leads`);
      
      // If we got any response, the local server is connected
      setIsConnected(true);

      if (!res.ok) {
        console.warn('Backend returned error status:', res.status);
        return; // Don't try to parse leads if it failed
      }
      
      const data = await res.json();
      
      if (data.success && Array.isArray(data.leads) && data.leads.length > 0) {
        setLeads((() => {
          const combined = [...leads];
          const idMap = new Map(combined.map((l, i) => [l.id, i]));
          
          data.leads.forEach((nl: Lead) => {
            const nlRawId = (nl as any).raw_id;
            let index = idMap.has(nl.id) ? idMap.get(nl.id)! : (nlRawId && idMap.has(nlRawId) ? idMap.get(nlRawId)! : -1);
            
            if (index !== -1) {
              combined[index] = { ...combined[index], ...nl };
            } else {
              const originalMatch = combined.find(
                el =>
                  fuzzyNameMatch(el.businessName, nl.businessName) ||
                  (el.websiteUrl && nl.websiteUrl && el.websiteUrl !== 'N/A' && el.websiteUrl !== '' && el.websiteUrl === nl.websiteUrl) ||
                  (el.phone && nl.phone && el.phone !== 'N/A' && el.phone !== '' && el.phone === nl.phone)
              );
              if (originalMatch) {
                nl.customTags = [...(nl.customTags || []), `Duplicate of: ${originalMatch.businessName}`];
              }
              combined.unshift(nl);
            }
          });
          return combined;
        })());
      }
    } catch (e) {
      // fetch() only throws on actual network failures (e.g. server is down)
      setIsConnected(false);
    }
  };

  useEffect(() => {
    handleSyncFromLocalServer();
    const interval = setInterval(handleSyncFromLocalServer, 3000);
    return () => clearInterval(interval);
  }, []);



  useEffect(() => {
    const processQueue = async () => {
      try {
        const queueStr = localStorage.getItem('nr_revibe_sync_queue');
        if (!queueStr) return;
        
        const queue: Lead[] = JSON.parse(queueStr);
        if (queue.length === 0) return;
        
        const leadsToSync = queue.slice(0, 5); // Process up to 5 at a time
        
        let successIds = new Set<string>();
        await Promise.all(leadsToSync.map(async (leadToSync) => {
          try {
            const res = await fetch(`/api/leads/${leadToSync.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lead: leadToSync })
            });
            if (res.ok) successIds.add(leadToSync.id);
          } catch(e) { }
        }));
        
        setIsConnected(true);
        if (successIds.size > 0) {
          const currentQueueStr = localStorage.getItem('nr_revibe_sync_queue');
          if (currentQueueStr) {
            let currentQueue: Lead[] = JSON.parse(currentQueueStr);
            currentQueue = currentQueue.filter(l => !successIds.has(l.id));
            localStorage.setItem('nr_revibe_sync_queue', JSON.stringify(currentQueue));
          }
        }
      } catch (e) {
        setIsConnected(false);
      }
    };
    
    const interval = setInterval(processQueue, 3000); // 3 seconds instead of 5
    return () => clearInterval(interval);
  }, []);

  const handleDeleteLeadModal = async (id: string) => {
    await handleDeleteLead(id);
    if (selectedLeadForModal?.id === id) {
      setSelectedLeadForModal(null);
    }
  };

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
      {!isConnected && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span className="text-xs font-bold text-rose-700">
            Local server disconnected. Cannot sync data to Google Sheets. Please ensure `node --import tsx server.ts` is running.
          </span>
        </div>
      )}

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        leadCount={leads.length}
        hotLeadCount={hotLeadCount}
        approvedEmailCount={approvedEmailCount}
      />

      <main className="flex-1 max-w-full w-full px-6 py-6">
        <ErrorBoundary componentName={`${activeTab} tab`}>
          {activeTab === 'extractor' && (
            <MapsExtractor
              onAddLeads={handleAddLeads}
              onUpdateSettings={handleUpdateSettings}
              onSyncFromLocalServer={handleSyncFromLocalServer}
            />
          )}

          {activeTab === 'crm' && (
            <LeadsCRMTable
              onSelectLeadForModal={lead => setSelectedLeadForModal(lead)}
              onRunBatchAIAudit={handleRunBatchAIAudit}
            />
          )}

          {activeTab === 'emails' && (
            <EmailCampaignManager />
          )}

          {activeTab === 'extension' && (
            <ExtensionSimulator
              leads={leads}
              settings={settings}
              onAddLeads={handleAddLeads}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsDashboard leads={leads} />}
        </ErrorBoundary>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 font-medium">
        NR Revibe Lead Generation & Google Sheets Extension Suite • Website Development & Social Media Management
      </footer>

      {selectedLeadForModal && (
        <ErrorBoundary componentName="Lead Detail Modal">
          <LeadDetailModal
            lead={selectedLeadForModal}
            onClose={() => setSelectedLeadForModal(null)}
            onUpdateLead={handleUpdateLead}
            settings={settings}
          />
        </ErrorBoundary>
      )}

      <ErrorBoundary componentName="Settings Modal">
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSaveSettings={handleUpdateSettings}
        />
      </ErrorBoundary>
    </div>
  );
}
