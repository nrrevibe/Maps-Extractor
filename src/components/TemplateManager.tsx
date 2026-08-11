import React, { useState, useRef } from 'react';
import { Plus, Edit2, Trash2, Check, FileText, Copy, ChevronDown, ChevronRight, X, Tag, RotateCcw } from 'lucide-react';
import { EmailTemplate } from '../types';
import { DEFAULT_EMAIL_TEMPLATES } from '../utils/templates';

interface TemplateManagerProps {
  customTemplates: EmailTemplate[];
  onChange: (templates: EmailTemplate[]) => void;
}

const AVAILABLE_VARIABLES = [
  { tag: '{{business_name}}', label: 'Business Name' },
  { tag: '{{city}}', label: 'City' },
  { tag: '{{category}}', label: 'Category' },
  { tag: '{{website_issue}}', label: 'Website Issue' },
  { tag: '{{social_media_issue}}', label: 'Social Media Issue' },
  { tag: '{{google_rating}}', label: 'Google Rating' },
  { tag: '{{review_count}}', label: 'Reviews' },
  { tag: '{{recommended_service}}', label: 'Service' },
  { tag: '{{revenue_potential}}', label: 'Revenue' },
  { tag: '{{sender_name}}', label: 'Sender Name' },
  { tag: '{{agency_name}}', label: 'Agency Name' },
  { tag: '{{agency_website}}', label: 'Agency URL' },
  { tag: '{{agency_phone}}', label: 'Phone' },
  { tag: '{{agency_instagram}}', label: 'Instagram' },
  { tag: '{{calendar_link}}', label: 'Calendar Link' },
];

const CATEGORY_OPTIONS = [
  'Website Improvement', 'No Website', 'Social Media', 'Combined Growth',
  'Follow-Up 1', 'Follow-Up 2', 'SEO', 'Custom'
];

export const TemplateManager: React.FC<TemplateManagerProps> = ({ customTemplates, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const updateTemplate = (id: string, updates: Partial<EmailTemplate>) => {
    const updated = customTemplates.map(t => t.id === id ? { ...t, ...updates } : t);
    onChange(updated);
  };

  const handleAddTemplate = () => {
    const newTemplate: EmailTemplate = {
      id: `custom-${Date.now()}`,
      name: 'New Custom Template',
      subject: '',
      body: 'Hi {{business_name}},\n\nYour message here...\n\nBest regards,\n{{sender_name}}\n{{agency_name}}\n{{agency_website}}',
      category: 'Custom',
    };
    const updated = [...customTemplates, newTemplate];
    onChange(updated);
    setEditingId(newTemplate.id);
    setExpandedId(newTemplate.id);
  };

  const handleStartEdit = (tmpl: EmailTemplate) => {
    setEditingId(tmpl.id);
    setExpandedId(tmpl.id);
  };

  const handleFinishEdit = () => {
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (customTemplates.length <= 1) {
      alert('You must keep at least one template.');
      return;
    }
    if (confirm('Delete this template? This cannot be undone.')) {
      onChange(customTemplates.filter(t => t.id !== id));
      if (editingId === id) setEditingId(null);
      if (expandedId === id) setExpandedId(null);
    }
  };

  const handleDuplicate = (tmpl: EmailTemplate) => {
    const dup: EmailTemplate = {
      ...tmpl,
      id: `custom-${Date.now()}`,
      name: `${tmpl.name} (Copy)`,
    };
    onChange([...customTemplates, dup]);
    setExpandedId(dup.id);
  };

  const handleResetToDefault = (tmpl: EmailTemplate) => {
    const original = DEFAULT_EMAIL_TEMPLATES.find(d => d.id === tmpl.id);
    if (original) {
      if (confirm(`Reset "${tmpl.name}" back to the original default?`)) {
        const updated = customTemplates.map(t => t.id === tmpl.id ? { ...original } : t);
        onChange(updated);
      }
    }
  };

  const insertVariable = (tag: string, tmpl: EmailTemplate) => {
    if (!bodyRef.current) return;
    const textarea = bodyRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = tmpl.body.substring(0, start);
    const after = tmpl.body.substring(end);
    updateTemplate(tmpl.id, { body: before + tag + after });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  const isDefault = (id: string) => DEFAULT_EMAIL_TEMPLATES.some(d => d.id === id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span>Email & Message Templates</span>
          <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">{customTemplates.length} templates</span>
        </h3>
        <button
          type="button"
          onClick={handleAddTemplate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Template</span>
        </button>
      </div>

      {/* Template List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {customTemplates.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <span className="text-xs text-slate-500 font-medium block">No templates yet.</span>
            <span className="text-[10px] text-slate-400">Click "New Template" to create your first outreach template.</span>
          </div>
        ) : (
          customTemplates.map((tmpl, idx) => {
            const isEditing = editingId === tmpl.id;
            const isExpanded = expandedId === tmpl.id;
            const isDefaultTemplate = isDefault(tmpl.id);

            return (
              <div key={tmpl.id} className={`border rounded-xl transition-all ${isEditing ? 'border-indigo-400 bg-indigo-50/30 shadow-md' : isExpanded ? 'border-slate-300 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                {/* Collapsed Header Row */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer select-none"
                  onClick={() => !isEditing && setExpandedId(isExpanded ? null : tmpl.id)}
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{tmpl.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDefaultTemplate ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {isDefaultTemplate ? 'Default' : 'Custom'}
                        </span>
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{tmpl.category}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[320px]">{tmpl.subject || '(no subject)'}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-0.5 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => handleStartEdit(tmpl)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => handleDuplicate(tmpl)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Duplicate">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {isDefaultTemplate && (
                      <button type="button" onClick={() => handleResetToDefault(tmpl)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Reset to Original">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => handleDelete(tmpl.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && !isEditing && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subject</div>
                    <div className="text-xs text-slate-700 font-medium bg-slate-50 rounded-lg p-2 border border-slate-100">{tmpl.subject}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-2">Body Preview</div>
                    <div className="text-xs text-slate-600 font-medium bg-slate-50 rounded-lg p-3 border border-slate-100 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">{tmpl.body}</div>
                    <div className="pt-2">
                      <button type="button" onClick={() => handleStartEdit(tmpl)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition-colors">
                        <Edit2 className="w-3 h-3" />
                        <span>Edit This Template</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Editor */}
                {isEditing && (
                  <div className="px-4 pb-4 border-t border-indigo-200 pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Template Name</label>
                        <input
                          type="text"
                          value={tmpl.name}
                          onChange={e => updateTemplate(tmpl.id, { name: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</label>
                        <select
                          value={tmpl.category}
                          onChange={e => updateTemplate(tmpl.id, { category: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          {CATEGORY_OPTIONS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Subject</label>
                      <input
                        type="text"
                        value={tmpl.subject}
                        onChange={e => updateTemplate(tmpl.id, { subject: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="e.g. A few ideas for {{business_name}} online"
                      />
                    </div>

                    {/* Variable Insert Toolbar */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                        <Tag className="w-3 h-3" />
                        <span>Insert Dynamic Variable</span>
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {AVAILABLE_VARIABLES.map(v => (
                          <button
                            key={v.tag}
                            type="button"
                            onClick={() => insertVariable(v.tag, tmpl)}
                            onContextMenu={e => { e.preventDefault(); handleCopyTag(v.tag); }}
                            className={`px-2 py-1 text-[9px] font-bold rounded-md border transition-all ${copiedTag === v.tag ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700'}`}
                            title={`Click to insert ${v.tag} • Right-click to copy`}
                          >
                            {copiedTag === v.tag ? '✓ Copied' : v.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Body</label>
                      <textarea
                        ref={bodyRef}
                        value={tmpl.body}
                        onChange={e => updateTemplate(tmpl.id, { body: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none h-48 resize-y leading-relaxed font-mono"
                        placeholder="Write your outreach message here..."
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[10px] text-slate-400">{tmpl.body.length} chars</span>
                      <div className="flex space-x-2">
                        <button type="button" onClick={handleFinishEdit} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center space-x-1 shadow-sm transition-colors">
                          <Check className="w-3.5 h-3.5" />
                          <span>Done Editing</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
