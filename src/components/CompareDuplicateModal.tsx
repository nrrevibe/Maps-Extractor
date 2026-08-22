import React, { useState } from 'react';
import { X, ArrowRightLeft, CheckCircle2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Lead } from '../types';

interface CompareDuplicateModalProps {
  originalLead: Lead;
  duplicateLead: Lead;
  onClose: () => void;
  onMerge: (mergedLead: Lead, duplicateId: string) => void;
  onDeleteDuplicate: (duplicateId: string) => void;
}

export function CompareDuplicateModal({ originalLead, duplicateLead, onClose, onMerge, onDeleteDuplicate }: CompareDuplicateModalProps) {
  const [isMerging, setIsMerging] = useState(false);

  const handleMerge = () => {
    setIsMerging(true);
    // Simple Merge: Take all non-empty fields from duplicate that are empty in original
    const merged = { ...originalLead };
    
    const fieldsToCheck: (keyof Lead)[] = [
      'websiteUrl', 'instagramUrl', 'facebookUrl', 'twitterUrl', 
      'linkedinUrl', 'youtubeUrl', 'tiktokUrl', 'phone', 'email'
    ];

    fieldsToCheck.forEach(field => {
      if ((!merged[field] || merged[field] === 'N/A') && duplicateLead[field] && duplicateLead[field] !== 'N/A') {
        (merged as any)[field] = duplicateLead[field];
      }
    });
    
    // Also merge notes
    if (duplicateLead.notes && duplicateLead.notes !== '') {
      merged.notes = merged.notes ? `${merged.notes}\n\n[Merged from duplicate]: ${duplicateLead.notes}` : duplicateLead.notes;
    }

    setTimeout(() => {
      onMerge(merged, duplicateLead.id);
      setIsMerging(false);
    }, 500);
  };

  const renderField = (label: string, originalVal: any, duplicateVal: any) => {
    const isDifferent = originalVal !== duplicateVal && (originalVal !== 'N/A' || duplicateVal !== 'N/A') && (originalVal || duplicateVal);
    const originalHasIt = originalVal && originalVal !== 'N/A';
    const duplicateHasIt = duplicateVal && duplicateVal !== 'N/A';
    
    const originalClass = isDifferent && originalHasIt && !duplicateHasIt ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700';
    const duplicateClass = isDifferent && duplicateHasIt && !originalHasIt ? 'bg-indigo-50 text-indigo-800 font-medium' : 'text-slate-700';
    
    return (
      <div className="grid grid-cols-3 gap-4 py-2 border-b border-slate-100 last:border-0 text-sm">
        <div className="font-medium text-slate-500">{label}</div>
        <div className={`break-words px-2 py-1 rounded ${originalClass}`}>{originalVal || 'N/A'}</div>
        <div className={`break-words px-2 py-1 rounded ${duplicateClass}`}>{duplicateVal || 'N/A'}</div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-10">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Compare Duplicate</h2>
              <p className="text-sm text-slate-500">Review details and merge new data into the original lead</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 gap-4 p-4 border-b border-slate-200 bg-slate-100/50 font-bold text-slate-700">
              <div>Field</div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Original Lead</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>New Duplicate</span>
              </div>
            </div>
            
            <div className="p-4 space-y-1">
              {renderField('Business Name', originalLead.businessName, duplicateLead.businessName)}
              {renderField('Category', originalLead.category, duplicateLead.category)}
              {renderField('City', originalLead.city, duplicateLead.city)}
              {renderField('Phone', originalLead.phone, duplicateLead.phone)}
              {renderField('Email', originalLead.email, duplicateLead.email)}
              {renderField('Website', originalLead.websiteUrl, duplicateLead.websiteUrl)}
              {renderField('Instagram', originalLead.instagramUrl, duplicateLead.instagramUrl)}
              {renderField('Facebook', originalLead.facebookUrl, duplicateLead.facebookUrl)}
              {renderField('Rating', originalLead.rating, duplicateLead.rating)}
              {renderField('Collected Date', originalLead.collectedDate, duplicateLead.collectedDate)}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-2xl">
          <button
            onClick={() => onDeleteDuplicate(duplicateLead.id)}
            className="px-4 py-2 text-rose-600 font-bold hover:bg-rose-50 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Discard Duplicate</span>
          </button>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={isMerging}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center space-x-2 transition-colors shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isMerging ? 'Merging...' : 'Merge Data & Delete Duplicate'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
