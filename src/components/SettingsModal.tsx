import React, { useState } from 'react';
import {
  X,
  Settings,
  Database,
  Mail,
  User,
  Globe,
  Calendar,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { AgencySettings } from '../types';
import { TemplateManager } from './TemplateManager';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AgencySettings;
  onSaveSettings: (newSettings: AgencySettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  if (!isOpen) return null;

  const [form, setForm] = useState<AgencySettings>({ ...settings });
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setForm({ ...settings });
    }
  }, [isOpen, settings]);

  const handleLoadFromDB = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings && Object.keys(data.settings).length > 0) {
        setForm(prev => ({ ...prev, ...data.settings }));
        alert('Settings loaded successfully from Database!');
      } else {
        alert('No settings found in the database or failed to load.');
      }
    } catch (e) {
      alert('Error connecting to database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-xl space-y-6 text-slate-800 overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">NR Rvibe Agency Settings</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Agency & Sender Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Agency Name</label>
              <input
                type="text"
                value={form.agencyName}
                onChange={e => setForm({ ...form, agencyName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Sender Name</label>
              <input
                type="text"
                value={form.senderName}
                onChange={e => setForm({ ...form, senderName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Sender Email</label>
              <input
                type="email"
                value={form.senderEmail}
                onChange={e => setForm({ ...form, senderEmail: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Agency Website</label>
              <input
                type="text"
                value={form.agencyWebsite}
                onChange={e => setForm({ ...form, agencyWebsite: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">WhatsApp / Phone Number</label>
              <input
                type="text"
                value={form.agencyPhone || ''}
                onChange={e => setForm({ ...form, agencyPhone: e.target.value })}
                placeholder="e.g. +1 234 567 8900"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Instagram Handle / URL</label>
              <input
                type="text"
                value={form.agencyInstagram || ''}
                onChange={e => setForm({ ...form, agencyInstagram: e.target.value })}
                placeholder="e.g. @youragency"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Calendar Link (Booking URL)</label>
              <input
                type="text"
                value={form.calendarLink || ''}
                onChange={e => setForm({ ...form, calendarLink: e.target.value })}
                placeholder="e.g. https://www.nrrevibe.online/#contact"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          </div>

          {/* Database Sync Settings */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold">
              <Settings className="w-4 h-4 text-emerald-600" />
              <span>Database Connection & Sending Mode</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">Sending Mode</label>
                <select
                  value={form.sendingMode}
                  onChange={e => setForm({ ...form, sendingMode: e.target.value as any })}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
                >
                  <option value="Manual">Manual Approval</option>
                  <option value="Approval">Approval Mode (Recommended)</option>
                  <option value="Campaign">Campaign Mode</option>
                </select>
              </div>
              
              <div className="flex items-end pb-1">
                <button 
                  type="button" 
                  onClick={handleLoadFromDB}
                  disabled={isLoading}
                  className="text-sm font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors w-full"
                >
                  {isLoading ? 'Loading...' : 'Load Settings from DB'}
                </button>
              </div>
            </div>
          </div>

          {/* SMTP Configuration (For sending emails via App Password) */}
          <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-3">
            <div className="flex items-center space-x-2 text-indigo-800 font-bold">
              <Mail className="w-4 h-4 text-indigo-600" />
              <span>SMTP / Email App Password Configuration</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">SMTP Host</label>
                <input
                  type="text"
                  value={form.smtpHost || ''}
                  onChange={e => setForm({ ...form, smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">SMTP Port</label>
                <input
                  type="number"
                  value={form.smtpPort || 465}
                  onChange={e => setForm({ ...form, smtpPort: Number(e.target.value) })}
                  placeholder="465"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-600 font-semibold">SMTP User</label>
                <input
                  type="email"
                  value={form.smtpUser || ''}
                  onChange={e => setForm({ ...form, smtpUser: e.target.value })}
                  placeholder="your-email@gmail.com"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <label className="text-slate-600 font-semibold">Google App Password</label>
              <input
                type="password"
                value={form.smtpPass || ''}
                onChange={e => setForm({ ...form, smtpPass: e.target.value })}
                placeholder="abcd efgh ijkl mnop"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-medium font-mono"
              />
              <span className="text-[10px] text-slate-400">Your Google Account 16-character App Password (not your normal Gmail password).</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Daily Email Limit</label>
              <input
                type="number"
                value={form.dailySendingLimit}
                onChange={e => setForm({ ...form, dailySendingLimit: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Follow-up Interval (Days)</label>
              <input
                type="number"
                value={form.followUpIntervalDays}
                onChange={e => setForm({ ...form, followUpIntervalDays: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-medium"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4">
            <TemplateManager 
              title="Email Templates"
              type="email"
              customTemplates={form.customTemplates || []}
              onChange={templates => setForm({ ...form, customTemplates: templates })}
            />
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4">
            <TemplateManager 
              title="WhatsApp Message Templates"
              type="whatsapp"
              customTemplates={form.customWhatsAppTemplates || []}
              onChange={templates => setForm({ ...form, customWhatsAppTemplates: templates })}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
