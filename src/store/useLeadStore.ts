import { create } from 'zustand';
import { Lead, AgencySettings } from '../types';
import { DEFAULT_EMAIL_TEMPLATES, DEFAULT_WHATSAPP_TEMPLATES } from '../utils/templates';

interface LeadState {
  leads: Lead[];
  settings: AgencySettings;
  isConnected: boolean;
  existingLeadIds: Set<string>;
  
  // Actions
  setLeads: (leads: Lead[]) => void;
  setSettings: (settings: AgencySettings) => void;
  setIsConnected: (connected: boolean) => void;
  
  handleUpdateSettings: (newSettings: AgencySettings) => Promise<void>;
  handleSyncFromGoogleSheets: () => Promise<void>;
  handleAddLeads: (newLeads: Lead[]) => void;
  handleUpdateLead: (updatedLead: Lead) => Promise<void>;
  handleBatchUpdateLeads: (updatedLeads: Lead[]) => Promise<void>;
  handleDeleteLead: (leadId: string, skipConfirm?: boolean) => Promise<void>;
  handleBatchDeleteLeads: (leadIds: string[]) => Promise<void>;
}

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

const getDefaultSettings = (): AgencySettings => {
  const defaults: AgencySettings = {
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
    customTemplates: [...DEFAULT_EMAIL_TEMPLATES],
    customWhatsAppTemplates: [...DEFAULT_WHATSAPP_TEMPLATES],
  };

  const saved = localStorage.getItem('nr_revibe_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Merge saved over defaults so new fields (like customTemplates) always exist
      return {
        ...defaults,
        ...parsed,
        // If saved settings have no customTemplates, use the defaults
        customTemplates: parsed.customTemplates && parsed.customTemplates.length > 0
          ? parsed.customTemplates
          : [...DEFAULT_EMAIL_TEMPLATES],
        customWhatsAppTemplates: parsed.customWhatsAppTemplates && parsed.customWhatsAppTemplates.length > 0
          ? parsed.customWhatsAppTemplates
          : [...DEFAULT_WHATSAPP_TEMPLATES],
      };
    } catch (e) {}
  }
  return defaults;
};

export const useLeadStore = create<LeadState>((set, get) => ({
  leads: [],
  settings: getDefaultSettings(),
  isConnected: true,
  existingLeadIds: new Set(),

  setLeads: (leads) => set({ leads, existingLeadIds: new Set(leads.map(l => l.id)) }),
  setSettings: (settings) => set({ settings }),
  setIsConnected: (isConnected) => set({ isConnected }),

  handleUpdateSettings: async (newSettings) => {
    set({ settings: newSettings });
    localStorage.setItem('nr_revibe_settings', JSON.stringify(newSettings));
    
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings })
      });
    } catch (e) {
      console.error('Failed to save settings to DB:', e);
    }
  },

  handleSyncFromGoogleSheets: async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      if (data.success && Array.isArray(data.leads)) {
        get().setLeads(data.leads);
        set({ isConnected: true });
      } else {
        alert('Failed to fetch leads: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error fetching leads: ' + err.message);
      set({ isConnected: false });
    }
  },

  handleAddLeads: (newLeads) => {
    const { leads } = get();
    const uniqueNew = newLeads.map(nl => {
      const originalMatch = leads.find(
        el =>
          fuzzyNameMatch(el.businessName, nl.businessName) ||
          (el.phone && nl.phone && el.phone !== 'N/A' && el.phone !== '' && el.phone === nl.phone) ||
          (el.websiteUrl && nl.websiteUrl && el.websiteUrl !== 'N/A' && el.websiteUrl !== '' && el.websiteUrl === nl.websiteUrl) ||
          (el.email && nl.email && el.email !== 'N/A' && el.email !== '' && el.email === nl.email)
      );
      if (originalMatch) {
        nl.customTags = [...(nl.customTags || []), `Duplicate of: ${originalMatch.businessName}`];
      }
      return nl;
    }).filter(nl => !leads.some(el => el.id === nl.id));

    if (uniqueNew.length > 0) {
      const updatedLeads = [...uniqueNew, ...leads];
      get().setLeads(updatedLeads);
      
      try {
        const queueStr = localStorage.getItem('nr_revibe_sync_queue');
        const queue: Lead[] = queueStr ? JSON.parse(queueStr) : [];
        const newPendingLeads = uniqueNew.filter(nl => !queue.some(q => q.id === nl.id));
        if (newPendingLeads.length > 0) {
          const updatedQueue = [...queue, ...newPendingLeads];
          localStorage.setItem('nr_revibe_sync_queue', JSON.stringify(updatedQueue));
        }
      } catch (e) {
        console.error('Failed to enqueue new leads locally:', e);
      }
    }
  },

  handleUpdateLead: async (updatedLead) => {
    const { leads } = get();
    const updatedLeads = leads.map(l => (l.id === updatedLead.id ? updatedLead : l));
    get().setLeads(updatedLeads);
    
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
  },

  handleBatchUpdateLeads: async (updatedLeadsArray) => {
    if (updatedLeadsArray.length === 0) return;
    const { leads } = get();
    const updatedMap = new Map(updatedLeadsArray.map(l => [l.id, l]));
    
    const newLeads = leads.map(l => updatedMap.has(l.id) ? updatedMap.get(l.id)! : l);
    get().setLeads(newLeads);
    
    try {
      const queueStr = localStorage.getItem('nr_revibe_sync_queue');
      const queue: Lead[] = queueStr ? JSON.parse(queueStr) : [];
      
      updatedLeadsArray.forEach(updatedLead => {
        const existingIndex = queue.findIndex(l => l.id === updatedLead.id);
        if (existingIndex >= 0) queue[existingIndex] = updatedLead;
        else queue.push(updatedLead);
      });
      
      localStorage.setItem('nr_revibe_sync_queue', JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to enqueue batch lead updates locally:', e);
    }
  },

  handleDeleteLead: async (id, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm('Are you sure you want to delete this lead?')) return;
    const { leads, settings } = get();
    get().setLeads(leads.filter(l => l.id !== id));
    
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error('Failed to delete lead from server:', e);
    }
  },

  handleBatchDeleteLeads: async (ids) => {
    const { leads } = get();
    const idSet = new Set(ids);
    get().setLeads(leads.filter(l => !idSet.has(l.id)));
    
    try {
      await fetch(`/api/leads/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
    } catch (e) {
      console.error('Failed to batch delete leads from server:', e);
    }
  },
}));
