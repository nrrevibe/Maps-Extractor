import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Lead, AgencySettings } from '../types';

interface LeadContextType {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  settings: AgencySettings;
  setSettings: React.Dispatch<React.SetStateAction<AgencySettings>>;
  handleUpdateSettings: (newSettings: AgencySettings) => Promise<void>;
  handleSyncFromGoogleSheets: () => Promise<void>;
  handleAddLeads: (newLeads: Lead[]) => void;
  handleUpdateLead: (updatedLead: Lead) => Promise<void>;
  handleDeleteLead: (leadId: string) => Promise<void>;
  existingLeadIds: Set<string>;
  isConnected: boolean;
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

export const LeadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  const [settings, setSettings] = useState<AgencySettings>(() => {
    const saved = localStorage.getItem('nr_revibe_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      agencyName: 'NR Revibe',
      senderName: 'NR Revibe Growth Team',
      senderEmail: 'nr.revibe@gmail.com',
      agencyWebsite: 'https://nrrevibe.com',
      calendarLink: 'https://nrrevibe.com/book',
      emailSignature: 'NR Revibe • Website Development & Social Media Management',
      dailySendingLimit: 50,
      followUpIntervalDays: 4,
      googleSheetConnected: true,
      sheetName: 'NR Revibe Master Leads 2026',
      sheetId: 'sheet-nr-revibe-2026',
      sendingMode: 'Approval',
      googleAppsScriptUrl: '',
    };
  });

  // Fetch settings from server on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const localSettings = JSON.parse(localStorage.getItem('nr_revibe_settings') || '{}');
        const scriptUrl = localSettings.googleAppsScriptUrl || '';
        
        const res = await fetch(`/api/settings${scriptUrl ? `?scriptUrl=${encodeURIComponent(scriptUrl)}` : ''}`);
        const data = await res.json();
        
        if (data.success && data.settings && Object.keys(data.settings).length > 0) {
          setSettings(prev => ({ ...prev, ...data.settings }));
          localStorage.setItem('nr_revibe_settings', JSON.stringify({ ...localSettings, ...data.settings }));
        }
      } catch (e) {
        console.error('Failed to load settings from DB:', e);
      }
    };
    fetchSettings();
  }, []);

  const handleUpdateSettings = async (newSettings: AgencySettings) => {
    setSettings(newSettings);
    localStorage.setItem('nr_revibe_settings', JSON.stringify(newSettings));
    
    try {
      const scriptUrl = newSettings.googleAppsScriptUrl;
      await fetch(`/api/settings${scriptUrl ? `?scriptUrl=${encodeURIComponent(scriptUrl)}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings })
      });
    } catch (e) {
      console.error('Failed to save settings to DB:', e);
    }
  };

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

  const existingLeadIds = useMemo(() => new Set(leads.map(l => l.id)), [leads]);

  const handleAddLeads = (newLeads: Lead[]) => {
    const uniqueNew = newLeads.filter(nl => {
      const isDuplicate = leads.some(
        el =>
          el.id === nl.id ||
          fuzzyNameMatch(el.businessName, nl.businessName) ||
          (el.phone && nl.phone && el.phone !== 'N/A' && el.phone !== '' && el.phone === nl.phone) ||
          (el.websiteUrl && nl.websiteUrl && el.websiteUrl !== 'N/A' && el.websiteUrl !== '' && el.websiteUrl === nl.websiteUrl) ||
          (el.email && nl.email && el.email !== 'N/A' && el.email !== '' && el.email === nl.email)
      );
      return !isDuplicate;
    });

    if (uniqueNew.length > 0) {
      setLeads(prev => [...uniqueNew, ...prev]);
    }
  };

  const handleSyncFromGoogleSheets = async () => {
    if (!settings.googleAppsScriptUrl) {
      alert('Please configure your Google Apps Script Web App URL in settings first.');
      return;
    }

    try {
      const res = await fetch(`${settings.googleAppsScriptUrl}?action=get_leads&apiKey=nr-revibe-secure-key-2026`);
      const data = await res.json();
      if (data.success && Array.isArray(data.leads)) {
        setLeads(data.leads);
        setIsConnected(true);
        
        try {
          await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: data.leads })
          });
        } catch (localSyncErr) {
          console.warn('Failed to populate local server cache with Sheets leads:', localSyncErr);
        }
      } else {
        alert('Failed to fetch leads: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error fetching leads: ' + err.message);
      setIsConnected(false);
    }
  };

  const handleSyncFromLocalServer = async () => {
    try {
      const scriptUrl = settings.googleAppsScriptUrl;
      const res = await fetch(`/api/leads${scriptUrl ? `?scriptUrl=${encodeURIComponent(scriptUrl)}` : ''}`);
      if (!res.ok) throw new Error('Local server down');
      const data = await res.json();
      setIsConnected(true);
      
      if (data.success && Array.isArray(data.leads) && data.leads.length > 0) {
        setLeads(prev => {
          const combined = [...prev];
          data.leads.forEach((nl: Lead) => {
            const exists = combined.some(
              el =>
                el.id === nl.id ||
                fuzzyNameMatch(el.businessName, nl.businessName) ||
                (el.websiteUrl && nl.websiteUrl && el.websiteUrl !== 'N/A' && el.websiteUrl !== '' && el.websiteUrl === nl.websiteUrl) ||
                (el.phone && nl.phone && el.phone !== 'N/A' && el.phone !== '' && el.phone === nl.phone)
            );
            if (!exists) {
              combined.unshift(nl);
            } else {
              const index = combined.findIndex(el => el.id === nl.id || el.id === nl.raw_id);
              if (index !== -1) {
                combined[index] = { ...combined[index], ...nl };
              }
            }
          });
          return combined;
        });
      }
    } catch (e) {
      setIsConnected(false);
    }
  };

  // Poll local Express registry every 3 seconds for direct Chrome Extension sync
  useEffect(() => {
    handleSyncFromLocalServer();
    const interval = setInterval(handleSyncFromLocalServer, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sync leads on mount if Sheet URL is configured
  useEffect(() => {
    if (settings.googleAppsScriptUrl) {
      handleSyncFromGoogleSheets();
    }
  }, [settings.googleAppsScriptUrl]);

  // Background Sync Queue for Lead Updates
  useEffect(() => {
    const processQueue = async () => {
      try {
        const queueStr = localStorage.getItem('nr_revibe_sync_queue');
        if (!queueStr) return;
        
        const queue: Lead[] = JSON.parse(queueStr);
        if (queue.length === 0) return;
        
        const leadToSync = queue[0];
        const scriptUrl = settings.googleAppsScriptUrl;
        
        const res = await fetch(`/api/leads/${leadToSync.id}${scriptUrl ? `?scriptUrl=${encodeURIComponent(scriptUrl)}` : ''}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead: leadToSync })
        });
        
        setIsConnected(true);
        if (res.ok) {
          const newQueue = queue.slice(1);
          localStorage.setItem('nr_revibe_sync_queue', JSON.stringify(newQueue));
        }
      } catch (e) {
        setIsConnected(false);
      }
    };
    
    const interval = setInterval(processQueue, 5000);
    return () => clearInterval(interval);
  }, [settings.googleAppsScriptUrl]);

  const handleUpdateLead = async (updatedLead: Lead) => {
    setLeads(prev => prev.map(l => (l.id === updatedLead.id ? updatedLead : l)));
    
    try {
      const queueStr = localStorage.getItem('nr_revibe_sync_queue');
      const queue: Lead[] = queueStr ? JSON.parse(queueStr) : [];
      const existingIndex = queue.findIndex(l => l.id === updatedLead.id);
      if (existingIndex >= 0) queue[existingIndex] = updatedLead;
      else queue.push(updatedLead);
      
      localStorage.setItem('nr_revibe_sync_queue', JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to enqueue lead update locally:', e);
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    setLeads(prev => prev.filter(l => l.id !== id));
    
    try {
      const scriptUrl = settings.googleAppsScriptUrl;
      await fetch(`/api/leads/${id}${scriptUrl ? `?scriptUrl=${encodeURIComponent(scriptUrl)}` : ''}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error('Failed to delete lead from server:', e);
    }
  };

  return (
    <LeadContext.Provider value={{
      leads, setLeads,
      settings, setSettings,
      handleUpdateSettings, handleSyncFromGoogleSheets,
      handleAddLeads, handleUpdateLead, handleDeleteLead,
      existingLeadIds, isConnected
    }}>
      {children}
    </LeadContext.Provider>
  );
};

export const useLeadContext = () => {
  const context = useContext(LeadContext);
  if (context === undefined) {
    throw new Error('useLeadContext must be used within a LeadProvider');
  }
  return context;
};
