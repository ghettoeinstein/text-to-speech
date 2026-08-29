import React from 'react';
import {
  Mic,
  Users,
  UploadCloud,
  BookOpen,
  Wand2,
  History,
  Activity,
  Moon,
  Sun,
  Volume2,
  BookmarkCheck,
} from 'lucide-react';

export type StudioTab =
  | 'single_speaker'
  | 'multi_speaker'
  | 'upload_convert'
  | 'library'
  | 'phonetic_dict'
  | 'history';

interface NavbarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  activePhoneticCount: number;
  historyCount: number;
  libraryCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  isDarkMode,
  onToggleDarkMode,
  activePhoneticCount,
  historyCount,
  libraryCount = 0,
}) => {
  const tabs = [
    {
      id: 'single_speaker' as StudioTab,
      label: 'Voice Studio',
      icon: Mic,
      tag: 'Gemini TTS',
    },
    {
      id: 'multi_speaker' as StudioTab,
      label: 'Multi-Speaker Dialogue',
      icon: Users,
      tag: 'Multi-Turn',
    },
    {
      id: 'upload_convert' as StudioTab,
      label: 'Upload & Convert (8k / 16k)',
      icon: UploadCloud,
      tag: 'Telephony DSP',
    },
    {
      id: 'library' as StudioTab,
      label: 'Clip Library',
      icon: BookmarkCheck,
      count: libraryCount,
      tag: 'IndexedDB',
    },
    {
      id: 'phonetic_dict' as StudioTab,
      label: 'Phonetic Dictionary',
      icon: BookOpen,
      count: activePhoneticCount,
    },
    {
      id: 'history' as StudioTab,
      label: 'Vault & Exports',
      icon: History,
      count: historyCount,
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0A0A0C]/90 backdrop-blur-xl border-b border-slate-200 dark:border-[#1F1F28] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Branding Row */}
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-600/25 ring-1 ring-white/10">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                  AI TTS Studio & Resampler
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80">
                  Gemini Audio
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                8 kHz Telephony IVR • 16 kHz AI VoIP • 24 kHz Studio Master HD
              </p>
            </div>
          </div>

          {/* Right Controls: Sample Rate Badges & Dark Mode */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px]">
                8 kHz PSTN
              </span>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[10px]">
                16 kHz Whisper
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                24 kHz Studio
              </span>
            </div>

            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#181820] border border-transparent dark:border-slate-800/60 transition-colors"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-1 ring-indigo-400/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#15151C]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.tag && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-indigo-500/40 text-indigo-100'
                        : 'bg-slate-100 dark:bg-[#1A1A24] text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {tab.tag}
                  </span>
                )}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 dark:bg-[#1A1A24] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
