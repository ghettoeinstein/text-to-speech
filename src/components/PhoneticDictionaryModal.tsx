import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
  X,
  Edit2,
  Info,
} from 'lucide-react';
import { PhoneticRule } from '../types';
import { DEFAULT_PHONETIC_RULES, applyPhoneticReplacements } from '../utils/phoneticEngine';

interface PhoneticDictionaryModalProps {
  rules: PhoneticRule[];
  onSaveRules: (rules: PhoneticRule[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const PhoneticDictionaryModal: React.FC<PhoneticDictionaryModalProps> = ({
  rules,
  onSaveRules,
  isOpen,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [testText, setTestText] = useState('The JCOD protocol processes TTS audio via VoIP and API endpoints.');

  // New rule form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState('');
  const [formReplacement, setFormReplacement] = useState('');
  const [formCategory, setFormCategory] = useState<PhoneticRule['category']>('Custom');
  const [formCaseSensitive, setFormCaseSensitive] = useState(false);
  const [formMatchWholeWord, setFormMatchWholeWord] = useState(true);
  const [formDescription, setFormDescription] = useState('');

  if (!isOpen) return null;

  const handleToggleRule = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    onSaveRules(updated);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    onSaveRules(updated);
  };

  const handleResetDefaults = () => {
    onSaveRules(DEFAULT_PHONETIC_RULES);
  };

  const handleOpenEdit = (rule: PhoneticRule) => {
    setEditingRuleId(rule.id);
    setFormTarget(rule.target);
    setFormReplacement(rule.replacement);
    setFormCategory(rule.category);
    setFormCaseSensitive(rule.caseSensitive);
    setFormMatchWholeWord(rule.matchWholeWord);
    setFormDescription(rule.description || '');
    setShowAddForm(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTarget.trim() || !formReplacement.trim()) return;

    if (editingRuleId) {
      // Update existing
      const updated = rules.map((r) =>
        r.id === editingRuleId
          ? {
              ...r,
              target: formTarget.trim(),
              replacement: formReplacement.trim(),
              category: formCategory,
              caseSensitive: formCaseSensitive,
              matchWholeWord: formMatchWholeWord,
              description: formDescription.trim(),
            }
          : r
      );
      onSaveRules(updated);
    } else {
      // Add new
      const newRule: PhoneticRule = {
        id: `rule-${Date.now()}`,
        target: formTarget.trim(),
        replacement: formReplacement.trim(),
        category: formCategory,
        caseSensitive: formCaseSensitive,
        matchWholeWord: formMatchWholeWord,
        description: formDescription.trim(),
        enabled: true,
      };
      onSaveRules([newRule, ...rules]);
    }

    // Reset form
    setShowAddForm(false);
    setEditingRuleId(null);
    setFormTarget('');
    setFormReplacement('');
    setFormDescription('');
  };

  const filteredRules = rules.filter((r) => {
    const matchesSearch =
      r.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.replacement.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || r.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const testPreview = applyPhoneticReplacements(testText, rules);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0F0F13] border border-slate-200 dark:border-[#1F1F28] rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1F1F28] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/80">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                Phonetic Pronunciation Dictionary
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage automated acronym expansions, technical jargon, and JCOD acoustic normalization
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#181822] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Live Playground Preview */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#1F1F28] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Live Acoustic Transformation Preview
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {testPreview.appliedCount} replacements active
              </span>
            </div>

            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Type any sentence to test pronunciation normalization..."
              className="w-full text-xs rounded-xl bg-white dark:bg-[#0F0F13] border border-slate-200 dark:border-[#262634] px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <div className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs font-mono text-indigo-900 dark:text-indigo-200">
              {testPreview.transformedText || <span className="text-slate-400 italic">No text</span>}
            </div>
          </div>

          {/* Action Bar: Search, Category Filter, Add Rule Button, Reset */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search rules (e.g. JCOD, SQL)..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="All">All Categories</option>
                <option value="Acronym">Acronyms</option>
                <option value="Technical">Technical</option>
                <option value="Brand">Brand</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetDefaults}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#181822] hover:bg-slate-200 dark:hover:bg-[#222230] text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200/60 dark:border-[#262634] transition-colors flex items-center gap-1"
                title="Restore default dictionary"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Defaults
              </button>

              <button
                onClick={() => {
                  setEditingRuleId(null);
                  setFormTarget('');
                  setFormReplacement('');
                  setFormDescription('');
                  setShowAddForm(!showAddForm);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddForm ? 'Close Form' : 'Add New Rule'}
              </button>
            </div>
          </div>

          {/* Add / Edit Rule Form */}
          {showAddForm && (
            <form
              onSubmit={handleSaveForm}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-[#09090C] border border-indigo-200 dark:border-indigo-900/60 space-y-3 animate-in fade-in duration-150"
            >
              <h4 className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                {editingRuleId ? 'Edit Phonetic Rule' : 'Create New Phonetic Rule'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">
                    Target Text / Acronym:
                  </label>
                  <input
                    type="text"
                    required
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    placeholder="e.g. jcod or NASA"
                    className="w-full rounded-lg bg-white dark:bg-[#0F0F13] border border-slate-200 dark:border-[#262634] px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">
                    Phonetic Replacement:
                  </label>
                  <input
                    type="text"
                    required
                    value={formReplacement}
                    onChange={(e) => setFormReplacement(e.target.value)}
                    placeholder="e.g. jay-cod or NA-SA"
                    className="w-full rounded-lg bg-white dark:bg-[#0F0F13] border border-slate-200 dark:border-[#262634] px-3 py-1.5 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1">Category:</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full rounded-lg bg-white dark:bg-[#0F0F13] border border-slate-200 dark:border-[#262634] px-3 py-1.5 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Acronym">Acronym</option>
                    <option value="Technical">Technical</option>
                    <option value="Brand">Brand</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="wholeWordCheck"
                    checked={formMatchWholeWord}
                    onChange={(e) => setFormMatchWholeWord(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="wholeWordCheck" className="text-slate-700 dark:text-slate-300">
                    Match Whole Word (\b)
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="caseCheck"
                    checked={formCaseSensitive}
                    onChange={(e) => setFormCaseSensitive(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="caseCheck" className="text-slate-700 dark:text-slate-300">
                    Case Sensitive
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  Optional Description:
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Notes about why this rule is applied..."
                  className="w-full text-xs rounded-lg bg-white dark:bg-[#0F0F13] border border-slate-200 dark:border-[#262634] px-3 py-1.5 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-[#181822]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow"
                >
                  {editingRuleId ? 'Save Changes' : 'Add Rule'}
                </button>
              </div>
            </form>
          )}

          {/* Rules Table */}
          <div className="space-y-2">
            {filteredRules.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No phonetic rules matched your search query.
              </div>
            ) : (
              filteredRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    rule.enabled
                      ? 'bg-white dark:bg-[#09090C] border-slate-200 dark:border-[#1F1F28] shadow-sm'
                      : 'bg-slate-50 dark:bg-[#060608] border-slate-200/50 dark:border-[#16161E] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white font-mono">
                          {rule.target}
                        </span>
                        <span className="text-slate-400 text-xs">➔</span>
                        <span className="font-semibold text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                          {rule.replacement}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#181822] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#262634]">
                          {rule.category}
                        </span>
                      </div>
                      {rule.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {rule.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(rule)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#181822]"
                      title="Edit rule"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                      title="Delete rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#1F1F28] flex items-center justify-between bg-slate-50 dark:bg-[#09090C]">
          <span className="text-xs text-slate-500 font-mono">
            {rules.filter((r) => r.enabled).length} of {rules.length} active rules
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/25 transition-all"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
