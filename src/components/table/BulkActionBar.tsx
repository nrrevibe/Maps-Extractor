import React from 'react';
import { LeadStatus } from '../../types';
import { CheckCircle2, Mail, Sparkles, StickyNote, FileSpreadsheet, Trash2, X } from 'lucide-react';

interface BulkActionBarProps {
  selectedLeadIds: Set<string>;
  onClearSelection: () => void;
  onBatchMoveToApproved: () => void;
  onBatchApplyCampaign: () => void;
  onRunBatchAIAudit: () => void;
  onOpenBatchNoteModal: () => void;
  onBatchChangeStatus: (status: LeadStatus) => void;
  onPushSelected: () => void;
  onBatchDelete: () => void;
  isSyncing: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedLeadIds,
  onClearSelection,
  onBatchMoveToApproved,
  onBatchApplyCampaign,
  onRunBatchAIAudit,
  onOpenBatchNoteModal,
  onBatchChangeStatus,
  onPushSelected,
  onBatchDelete,
  isSyncing
}) => {
  if (selectedLeadIds.size === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl p-3 px-5 flex flex-wrap items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center space-x-2 font-bold text-xs">
        <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-black shadow-sm">
          {selectedLeadIds.size} Selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-slate-400 hover:text-slate-200 p-1 transition-colors"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="h-5 w-px bg-slate-700" />

      {/* Move to Approved */}
      <button
        onClick={onBatchMoveToApproved}
        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
        title="Approve selected leads for outreach"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Move to Approved</span>
      </button>

      {/* Apply Campaign */}
      <button
        onClick={onBatchApplyCampaign}
        className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
        title="Prepare campaign email drafts"
      >
        <Mail className="w-3.5 h-3.5" />
        <span>Apply Campaign</span>
      </button>

      {/* AI Audit */}
      <button
        onClick={onRunBatchAIAudit}
        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        <span>Run Gemini AI Audit</span>
      </button>

      {/* Append Batch Note */}
      <button
        onClick={onOpenBatchNoteModal}
        className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm"
        title="Append a common note to selected leads"
      >
        <StickyNote className="w-3.5 h-3.5" />
        <span>Append Note</span>
      </button>

      {/* Batch Status Select */}
      <div className="flex items-center space-x-1">
        <select
          onChange={e => {
            onBatchChangeStatus(e.target.value as LeadStatus);
            e.target.value = '';
          }}
          defaultValue=""
          className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="" disabled>Set Status...</option>
          <option value="New">Set to New</option>
          <option value="Needs Review">Set to Needs Review</option>
          <option value="Approved">Set to Approved</option>
          <option value="Contacted">Set to Contacted</option>
          <option value="Replied">Set to Replied</option>
          <option value="Won">Set to Won</option>
        </select>
      </div>

      {/* Sync to Database */}
      <button
        onClick={onPushSelected}
        disabled={isSyncing}
        className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-50"
        title="Sync selected leads to database via Web App"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        <span>{isSyncing ? 'Syncing...' : 'Sync to Database'}</span>
      </button>

      <div className="h-5 w-px bg-slate-700" />

      {/* Delete */}
      <button
        onClick={onBatchDelete}
        className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all"
        title="Delete selected leads"
      >
        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
        <span>Delete</span>
      </button>
    </div>
  );
};
