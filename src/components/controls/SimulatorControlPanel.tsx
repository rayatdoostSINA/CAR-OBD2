import React from 'react';
import { UserPreferences } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { Power, AlertOctagon, Zap } from 'lucide-react';

interface Props {
  preferences: UserPreferences;
  throttle: number;
  gear: number;
  isEngineOn: boolean;
  onThrottleChange: (val: number) => void;
  onGearChange: (val: number) => void;
  onToggleEngine: () => void;
  onInjectFault: (code: string) => void;
}

export const SimulatorControlPanel: React.FC<Props> = ({
  preferences,
  throttle,
  gear,
  isEngineOn,
  onThrottleChange,
  onGearChange,
  onToggleEngine,
  onInjectFault
}) => {
  const t = getTranslation(preferences.language);
  const isRtl = preferences.language === 'fa';

  const scenarios = [
    { label: t.scenIdle, action: () => { onThrottleChange(0); onGearChange(0); } },
    { label: t.scenCity, action: () => { onThrottleChange(35); onGearChange(2); } },
    { label: t.scenHighway, action: () => { onThrottleChange(55); onGearChange(5); } },
    { label: t.scenSport, action: () => { onThrottleChange(95); onGearChange(3); } }
  ];

  return (
    <div id="simulator-control-bar" className="w-full bg-slate-900/95 border-t border-cyan-900/50 p-3 sm:p-4 backdrop-blur-md shadow-2xl">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Engine Power & Scenario Badges */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <button
            onClick={onToggleEngine}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold border transition ${isEngineOn ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-red-600/80 hover:bg-red-500 border-red-400 text-white'}`}
          >
            <Power className="w-4 h-4" />
            {isEngineOn ? (isRtl ? 'موتور روشن' : 'Engine RUNNING') : (isRtl ? 'موتور خاموش' : 'Engine STOPPED')}
          </button>

          {/* Quick Scenario Buttons */}
          <div className="hidden sm:flex items-center gap-1.5">
            {scenarios.map((sc, i) => (
              <button
                key={i}
                onClick={sc.action}
                className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500 rounded-lg text-xs font-semibold text-slate-300 transition"
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Virtual Throttle Slider & Gear Selection */}
        <div className="flex items-center gap-4 w-full md:w-1/2">
          {/* Throttle Pedal */}
          <div className="flex-1 flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-amber-400 whitespace-nowrap flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {t.gasPedal}:
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={throttle}
              onChange={(e) => onThrottleChange(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <span className="font-orbitron font-bold text-amber-300 text-xs w-9 text-right">
              {Math.round(throttle)}%
            </span>
          </div>

          {/* Gear buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[0, 1, 2, 3, 4, 5].map((g) => (
              <button
                key={g}
                onClick={() => onGearChange(g)}
                className={`w-7 h-7 rounded-lg text-xs font-bold font-orbitron transition ${gear === g ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                {g === 0 ? 'N' : g}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Inject Fault & Overheat Simulation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onInjectFault('P0420')}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-950/70 hover:bg-amber-900 border border-amber-700 text-amber-300 rounded-xl text-xs font-bold transition"
            title="Inject P0420 Catalyst System Efficiency Below Threshold"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            {isRtl ? 'تزریق خطا (P0420)' : 'Inject Fault (P0420)'}
          </button>
        </div>

      </div>
    </div>
  );
};
