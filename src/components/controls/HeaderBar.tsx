import React, { useState } from 'react';
import { GaugeMode, UserPreferences, VehicleProfile } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { 
  Gauge, 
  ShieldAlert, 
  Zap, 
  Terminal, 
  Settings, 
  Volume2, 
  VolumeX, 
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface Props {
  currentTab: 'dashboard' | 'diagnostics' | 'performance' | 'terminal' | 'settings';
  onChangeTab: (tab: 'dashboard' | 'diagnostics' | 'performance' | 'terminal' | 'settings') => void;
  gaugeMode: GaugeMode;
  onChangeGaugeMode: (mode: GaugeMode) => void;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => void;
  selectedVehicle: VehicleProfile;
  isConnected: boolean;
  isConnecting: boolean;
  connectionType: string;
  isOffline?: boolean;
  onOpenConnectModal: () => void;
  onDisconnect: () => void;
}

export const HeaderBar: React.FC<Props> = ({
  currentTab,
  onChangeTab,
  gaugeMode,
  onChangeGaugeMode,
  preferences,
  onUpdatePreferences,
  selectedVehicle,
  isConnected,
  isConnecting,
  connectionType,
  onOpenConnectModal,
  onDisconnect
}) => {
  const t = getTranslation(preferences.language);
  const isRtl = preferences.language === 'fa';
  
  // Collapse state for header to allow focus on gauges
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // 4 main gauge modes
  const gaugeModesList: { id: GaugeMode; label: string }[] = [
    { id: 'cyber-hud', label: isRtl ? 'سایبر نئون' : 'Cyber Neon' },
    { id: 'minimal-hud', label: isRtl ? 'مینیمال' : 'Minimal' },
    { id: 'sport-race', label: isRtl ? 'اسپرت کورسی' : 'Sport' },
    { id: 'matrix-grid', label: isRtl ? 'ماتریس' : 'Matrix' }
  ];

  // Collapsed Minimal Bar View (Takes minimal vertical space, ~28px)
  if (isCollapsed) {
    return (
      <header className="w-full bg-slate-950/90 backdrop-blur-md px-2 py-1 border-b border-slate-800 flex items-center justify-between gap-2 z-30 select-none">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-black border border-amber-500/80 p-0.5 flex items-center justify-center">
            <span className="text-[7px] font-black text-amber-400">CHK</span>
          </div>
          <span className="text-[11px] font-bold text-amber-400 font-sans truncate max-w-[110px] xs:max-w-none">
            Sina rayatdoost
          </span>
        </div>

        {/* Quick Mode Switcher in Compact Header */}
        {currentTab === 'dashboard' && (
          <div className="flex items-center gap-1 overflow-x-auto max-w-[55vw]">
            {gaugeModesList.map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeGaugeMode(m.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap transition ${
                  gaugeMode === m.id
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsCollapsed(false)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold"
            title={isRtl ? 'نمایش منوی کامل' : 'Expand Menu'}
          >
            <span>{isRtl ? 'منو' : 'Menu'}</span>
            <ChevronDown className="w-3 h-3 text-cyan-400" />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="w-full bg-slate-900/95 border-b border-slate-800 z-30 backdrop-blur-md select-none transition-all">
      {/* Top Single Responsive Bar */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        
        {/* Brand & Vehicle Logo */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-black border border-amber-500/80 p-0.5 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.3)] shrink-0">
            <svg 
              viewBox="0 0 100 80" 
              className="w-full h-full text-amber-400 drop-shadow-[0_0_4px_#f59e0b]"
              fill="currentColor"
            >
              <rect x="36" y="8" width="28" height="10" rx="2" />
              <rect x="8" y="32" width="10" height="24" rx="2" />
              <rect x="82" y="36" width="10" height="18" rx="2" />
              <path d="M22 24 h14 v-6 h28 v6 h14 c4.4 0 8 3.6 8 8 v10 h6 v16 h-6 v6 c0 4.4-3.6 8-8 8 h-8 l-10 8 h-30 v-8 h-8 c-4.4 0-8-3.6-8-8 v-26 c0-4.4 3.6-8 8-8 z" />
              <path d="M26 30 h48 c2 0 4 2 4 4 v20 c0 2-2 4-4 4 h-48 c-2 0-4-2-4-4 v-20 c0-2 2-4 4-4 z" fill="#090d14" />
              <text x="50" y="47" fill="#f59e0b" fontSize="12" fontWeight="900" fontFamily="Orbitron, Arial, sans-serif" textAnchor="middle" letterSpacing="0.5">CHECK</text>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black font-orbitron text-white tracking-wider">
                MultiGauge <span className="text-amber-400 text-[9px] px-1 rounded bg-amber-950/80 border border-amber-800">OBD</span>
              </span>
              <span className="hidden md:inline-block text-[10px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800 font-medium">
                {isRtl ? selectedVehicle.persianModel : selectedVehicle.model}
              </span>
            </div>
            <span className="text-[10px] sm:text-xs text-amber-400 font-bold tracking-wide block -mt-0.5">
              Sina rayatdoost
            </span>
          </div>
        </div>

        {/* Middle Compact Navigation Tabs */}
        <nav className="flex items-center gap-0.5 sm:gap-1 p-0.5 bg-slate-950/90 rounded-lg border border-slate-800/80 overflow-x-auto max-w-full">
          <button
            onClick={() => onChangeTab('dashboard')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap transition ${currentTab === 'dashboard' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>{t.dashboard}</span>
          </button>

          <button
            onClick={() => onChangeTab('diagnostics')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap transition ${currentTab === 'diagnostics' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{t.diagnostics}</span>
            <span className="xs:hidden">{isRtl ? 'دیاگ' : 'DTC'}</span>
          </button>

          <button
            onClick={() => onChangeTab('performance')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap transition ${currentTab === 'performance' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{t.performance}</span>
            <span className="xs:hidden">{isRtl ? 'شتاب' : '0-100'}</span>
          </button>

          <button
            onClick={() => onChangeTab('terminal')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap transition ${currentTab === 'terminal' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onChangeTab('settings')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap transition ${currentTab === 'settings' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </nav>

        {/* Right Tools: Connection, Audio, Language, Collapse Button */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Connection Toggle */}
          <button
            onClick={isConnected ? onDisconnect : onOpenConnectModal}
            className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border transition ${
              isConnected 
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' 
                : 'bg-red-950/80 border-red-500 text-red-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="hidden xs:inline">
              {isConnecting ? t.connecting : (isConnected ? (connectionType === 'simulator' ? 'Sim' : 'OBD') : t.connectBtn)}
            </span>
          </button>

          {/* Audio */}
          <button
            onClick={() => onUpdatePreferences({ soundAlerts: !preferences.soundAlerts })}
            className={`p-1 rounded-md border text-xs ${preferences.soundAlerts ? 'bg-slate-800 text-cyan-400 border-slate-700' : 'bg-slate-950 text-slate-500 border-slate-800'}`}
          >
            {preferences.soundAlerts ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Language */}
          <button
            onClick={() => onUpdatePreferences({ language: preferences.language === 'fa' ? 'en' : 'fa' })}
            className="px-1.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 text-xs font-bold"
          >
            {preferences.language === 'fa' ? 'EN' : 'فا'}
          </button>

          {/* Collapse Header Button (To minimize header completely) */}
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
            title={isRtl ? 'کوچک‌کردن هدر برای نمایش بزرگتر گیج‌ها' : 'Collapse Header'}
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Mode Switcher Bar in Dashboard Tab */}
      {currentTab === 'dashboard' && (
        <div className="bg-slate-950/90 border-t border-slate-800/80 px-2 py-1 flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto">
          {gaugeModesList.map((m) => (
            <button
              key={m.id}
              onClick={() => onChangeGaugeMode(m.id)}
              className={`px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-bold transition whitespace-nowrap ${
                gaugeMode === m.id 
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};
