import React, { useState } from 'react';
import {
  Wand2,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  X,
  Languages,
  AlignLeft,
  Flame,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';

interface ScriptAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  onApplyScript: (script: string) => void;
}

export const ScriptAssistantModal: React.FC<ScriptAssistantModalProps> = ({
  isOpen,
  onClose,
  initialText = '',
  onApplyScript,
}) => {
  const [activeAction, setActiveAction] = useState<
    'generate' | 'polish' | 'expand' | 'translate'
  >('generate');

  const [promptTopic, setPromptTopic] = useState('Enterprise PBX & IVR Telephony Announcement');
  const [scriptText, setScriptText] = useState(initialText);
  const [tone, setTone] = useState('Natural & Engaging');
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setGeneratedOutput('');

    try {
      const response = await fetch('/api/tts/script-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: activeAction,
          prompt: promptTopic,
          text: scriptText || initialText,
          tone,
          targetLanguage,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process AI script assistance.');
      }

      setGeneratedOutput(data.resultText || '');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Script assistant failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedOutput) return;
    navigator.clipboard.writeText(generatedOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (!generatedOutput) return;
    onApplyScript(generatedOutput);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#0F0F13] border border-slate-200 dark:border-[#1F1F28] rounded-3xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1F1F28] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/80">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                AI Voiceover & Script Assistant
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Powered by Gemini to compose, polish cadence, and translate speech scripts
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Action Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 dark:bg-[#09090C] p-1.5 rounded-2xl border border-slate-200 dark:border-[#1F1F28]">
            <button
              onClick={() => setActiveAction('generate')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeAction === 'generate'
                  ? 'bg-white dark:bg-[#181822] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-[#2A2A3A]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate
            </button>

            <button
              onClick={() => setActiveAction('polish')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeAction === 'polish'
                  ? 'bg-white dark:bg-[#181822] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-[#2A2A3A]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Polish Cadence
            </button>

            <button
              onClick={() => setActiveAction('expand')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeAction === 'expand'
                  ? 'bg-white dark:bg-[#181822] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-[#2A2A3A]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
              Expand Draft
            </button>

            <button
              onClick={() => setActiveAction('translate')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeAction === 'translate'
                  ? 'bg-white dark:bg-[#181822] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-[#2A2A3A]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Languages className="w-3.5 h-3.5" />
              Translate
            </button>
          </div>

          {/* Action Specific Inputs */}
          {activeAction === 'generate' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Topic or Purpose of Voiceover:
                </label>
                <input
                  type="text"
                  value={promptTopic}
                  onChange={(e) => setPromptTopic(e.target.value)}
                  placeholder="e.g., Telecom Customer Support IVR, Tech Podcast Intro, Mindfulness Meditation..."
                  className="w-full text-xs rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] px-3.5 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Tone & Style:
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] px-3.5 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="Natural & Engaging">Natural & Engaging</option>
                  <option value="Professional Broadcaster">Professional Broadcaster</option>
                  <option value="Cheerful & Upbeat">Cheerful & Upbeat</option>
                  <option value="Telephony IVR Phone Prompt">Telephony IVR Phone Prompt</option>
                  <option value="Empathetic Support Specialist">Empathetic Support Specialist</option>
                  <option value="Theatrical Storyteller">Theatrical Storyteller</option>
                </select>
              </div>
            </div>
          )}

          {(activeAction === 'polish' || activeAction === 'expand') && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Draft Script to Optimize:
                </label>
                <textarea
                  rows={4}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Paste or type the draft text here..."
                  className="w-full text-xs rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] p-3 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {activeAction === 'translate' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Spoken Language:
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full text-xs rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] px-3.5 py-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="Spanish">Spanish (Español)</option>
                  <option value="French">French (Français)</option>
                  <option value="German">German (Deutsch)</option>
                  <option value="Japanese">Japanese (日本語)</option>
                  <option value="Portuguese">Portuguese (Português)</option>
                  <option value="Italian">Italian (Italiano)</option>
                  <option value="Mandarin Chinese">Mandarin Chinese (中文)</option>
                  <option value="Hindi">Hindi (हिन्दी)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Text to Translate for Speech:
                </label>
                <textarea
                  rows={3}
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Enter text to translate..."
                  className="w-full text-xs rounded-xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] p-3 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Trigger Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-[#1C1C26] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 transition-all active:scale-[0.99]"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Composing with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Process Script with Gemini</span>
              </>
            )}
          </button>

          {errorMessage && (
            <p className="text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
              {errorMessage}
            </p>
          )}

          {/* Output Preview */}
          {generatedOutput && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#1F1F28]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  AI Generated Result:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="p-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#09090C] border border-slate-200 dark:border-[#262634] text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {generatedOutput}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#1F1F28] flex items-center justify-between bg-slate-50 dark:bg-[#09090C]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#181822]"
          >
            Cancel
          </button>

          {generatedOutput && (
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/25"
            >
              <span>Apply to Voice Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
