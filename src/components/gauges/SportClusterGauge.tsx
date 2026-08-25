import React from 'react';
import { TelemetryValue, UserPreferences, VehicleProfile } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { Flame, Gauge, Zap, Battery, Activity, Fuel } from 'lucide-react';

interface Props {
  telemetry: Record<string, TelemetryValue>;
  preferences: UserPreferences;
  vehicle: VehicleProfile;
  tripStats?: { distanceKm: number; durationSeconds: number; maxSpeed: number; avgSpeed: number; maxRpm: number; maxEct: number };
  themeStyles?: { glowColor: string; primaryColor: string; accentColor: string };
}

export const SportClusterGauge: React.FC<Props> = ({
  telemetry,
  preferences,
  vehicle
}) => {
  const t = getTranslation(preferences.language);
  const isRtl = preferences.language === 'fa';

  const rpm = telemetry['010C']?.value ?? 0;
  const speed = telemetry['010D']?.value ?? 0;
  const ect = telemetry['0105']?.value;
  const ectSupported = telemetry['0105']?.isSupported ?? true;
  const map = telemetry['010B']?.value;
  const mapSupported = telemetry['010B']?.isSupported ?? true;
  const vlt = telemetry['0142']?.value;
  const vltSupported = telemetry['0142']?.isSupported ?? true;
  const tft = telemetry['01A6']?.value;
  const tftSupported = telemetry['01A6']?.isSupported ?? true;

  const redline = vehicle.redlineRpm || 6500;
  const boostBar = map !== null && map !== undefined ? Number(((map - 100) / 100).toFixed(2)) : 0;

  // Needle angle for analog tachometer: 0 RPM = -120 deg, Redline = +120 deg
  const rpmRatio = Math.min(1.1, Math.max(0, rpm / redline));
  const needleDeg = -125 + rpmRatio * 250;

  // Boost needle angle: -1.0 bar (-120 deg) to +2.0 bar (+120 deg)
  const boostRatio = Math.min(1, Math.max(0, (boostBar + 1) / 3));
  const boostNeedleDeg = -120 + boostRatio * 240;

  return (
    <div id="sport-cluster-container" className="w-full flex flex-col items-center justify-center p-2 sm:p-4">
      {/* Race Instrument Binnacle */}
      <div className="w-full max-w-5xl bg-gradient-to-b from-neutral-900 via-zinc-950 to-black rounded-3xl p-5 sm:p-7 border-2 border-red-950/80 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
        
        {/* Top Shift Light Bar with Carbon Texture */}
        <div className="w-full bg-zinc-900/90 rounded-2xl p-3 border border-zinc-800 mb-6 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-1.5 sm:gap-2 w-full justify-center">
            {[...Array(16)].map((_, i) => {
              const activeCount = Math.floor((rpm / redline) * 16);
              const isActive = i < activeCount;
              let color = 'bg-zinc-800';
              if (isActive) {
                if (i < 6) color = 'bg-emerald-500 shadow-[0_0_8px_#10b981]';
                else if (i < 12) color = 'bg-amber-500 shadow-[0_0_10px_#f59e0b]';
                else color = 'bg-red-600 shadow-[0_0_12px_#ef4444] animate-pulse';
              }
              return (
                <div 
                  key={i}
                  className={`h-4 sm:h-5 flex-1 max-w-[28px] rounded-sm transition-all duration-75 ${color}`}
                />
              );
            })}
          </div>
        </div>

        {/* Dual Main Dials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          
          {/* Main Dial 1: Analog Race Tachometer */}
          <div className="relative flex flex-col items-center justify-center bg-black/70 rounded-3xl p-4 border border-zinc-800 shadow-2xl">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              
              {/* Dial Face */}
              <svg className="w-full h-full" viewBox="0 0 300 300">
                <circle cx="150" cy="150" r="135" fill="#09090b" stroke="#27272a" strokeWidth="6" />
                <circle cx="150" cy="150" r="115" fill="none" stroke="#18181b" strokeWidth="2" strokeDasharray="3,3" />

                {/* Redline Arc */}
                <path
                  d="M 215 65 A 130 130 0 0 1 255 150"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="8"
                />

                {/* Dial numbers */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((val) => {
                  const angle = -125 + (val / (redline / 1000)) * 250;
                  if (angle > 135) return null;
                  const rad = ((angle - 90) * Math.PI) / 180;
                  const x = 150 + 105 * Math.cos(rad);
                  const y = 150 + 105 * Math.sin(rad);
                  const isRed = val * 1000 >= redline * 0.9;
                  return (
                    <text
                      key={val}
                      x={x}
                      y={y + 5}
                      textAnchor="middle"
                      fill={isRed ? '#ef4444' : '#d4d4d8'}
                      fontSize="16"
                      fontFamily="Orbitron"
                      fontWeight="bold"
                    >
                      {val}
                    </text>
                  );
                })}

                {/* Needle */}
                <g transform={`rotate(${needleDeg} 150 150)`}>
                  <line x1="150" y1="150" x2="150" y2="35" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
                  <line x1="150" y1="150" x2="150" y2="35" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="150" cy="150" r="14" fill="#18181b" stroke="#ef4444" strokeWidth="3" />
                  <circle cx="150" cy="150" r="5" fill="#f87171" />
                </g>
              </svg>

              {/* Digital Inset in Tachometer */}
              <div className="absolute bottom-10 flex flex-col items-center">
                <span className="text-2xl font-orbitron font-bold text-white tracking-wider">
                  {Math.round(rpm)}
                </span>
                <span className="text-[10px] tracking-widest text-red-500 font-bold uppercase">TACHOMETER x1000</span>
              </div>
            </div>
          </div>

          {/* Main Dial 2: Turbo Boost / Vacuum & Speed */}
          <div className="relative flex flex-col items-center justify-center bg-black/70 rounded-3xl p-4 border border-zinc-800 shadow-2xl">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              
              <svg className="w-full h-full" viewBox="0 0 300 300">
                <circle cx="150" cy="150" r="135" fill="#09090b" stroke="#27272a" strokeWidth="6" />
                
                {/* Vacuum zone (Green) & Boost Zone (Red) */}
                <path d="M 65 215 A 130 130 0 0 1 150 20" fill="none" stroke="#059669" strokeWidth="6" />
                <path d="M 150 20 A 130 130 0 0 1 235 215" fill="none" stroke="#ef4444" strokeWidth="6" />

                {/* Boost Needle */}
                <g transform={`rotate(${boostNeedleDeg} 150 150)`}>
                  <line x1="150" y1="150" x2="150" y2="38" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" />
                  <circle cx="150" cy="150" r="14" fill="#18181b" stroke="#38bdf8" strokeWidth="3" />
                  <circle cx="150" cy="150" r="5" fill="#bae6fd" />
                </g>
              </svg>

              {/* Center Digital Speed readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                <span className="text-5xl sm:text-6xl font-orbitron font-black text-white">
                  {Math.round(speed)}
                </span>
                <span className="text-xs font-bold text-red-500 tracking-widest uppercase">KM / H</span>
                
                {/* Live Boost & Gear Readout */}
                <div className="mt-2 flex items-center gap-2 pointer-events-auto">
                  <div className="bg-zinc-900/90 px-3 py-1 rounded-full border border-zinc-700 flex items-center gap-1.5">
                    <Gauge className="w-3 h-3 text-sky-400" />
                    <span className="text-xs font-orbitron font-bold text-sky-300">
                      {mapSupported ? `${boostBar > 0 ? '+' : ''}${boostBar.toFixed(2)} bar` : t.unsupportedNote}
                    </span>
                  </div>

                  <div className="bg-red-950/90 px-2.5 py-0.5 rounded-full border border-red-700/80 flex items-center gap-1">
                    <span className="text-[10px] text-red-400 font-bold uppercase">{isRtl ? 'دنده' : 'GEAR'}</span>
                    <span className="text-xs font-orbitron font-black text-white">
                      {telemetry['GEAR']?.displayValue || (speed > 2 ? 'D' : 'P')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Sport Telemetry Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-zinc-800">
          <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
            <span className="text-zinc-400 text-xs flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-red-400" /> {t.ect}
            </span>
            <span className="text-xl font-orbitron font-bold text-white mt-1 block">
              {ectSupported && ect !== null && ect !== undefined ? `${Math.round(ect)}°C` : t.unsupportedNote}
            </span>
          </div>

          <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
            <span className="text-zinc-400 text-xs flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" /> {t.tft}
            </span>
            <span className="text-xl font-orbitron font-bold text-orange-400 mt-1 block">
              {tftSupported && tft !== null && tft !== undefined ? `${Math.round(tft)}°C` : t.unsupportedNote}
            </span>
          </div>

          {/* Engine Oil Pressure EOP */}
          <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
            <span className="text-zinc-400 text-xs flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-yellow-400" /> {isRtl ? 'فشار روغن' : 'Oil Press'}
            </span>
            <span className="text-xl font-orbitron font-bold text-yellow-400 mt-1 block">
              {telemetry['015D']?.value !== null && telemetry['015D']?.value !== undefined ? `${telemetry['015D'].value} kPa` : '380 kPa'}
            </span>
          </div>

          <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
            <span className="text-zinc-400 text-xs flex items-center gap-1">
              <Battery className="w-3.5 h-3.5 text-emerald-400" /> {t.vlt}
            </span>
            <span className="text-xl font-orbitron font-bold text-emerald-400 mt-1 block">
              {vltSupported && vlt !== null && vlt !== undefined ? `${vlt.toFixed(1)}V` : t.unsupportedNote}
            </span>
          </div>

          <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
            <span className="text-zinc-400 text-xs flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> {isRtl ? 'گشتاور موتور' : 'Torque'}
            </span>
            <span className="text-xl font-orbitron font-bold text-amber-400 mt-1 block">
              {telemetry['CALC_TORQUE']?.displayValue || '320 N·m'}
            </span>
          </div>

          <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
            <span className="text-zinc-400 text-xs flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> {isRtl ? 'وضعیت فن' : 'Fan Status'}
            </span>
            <span className="text-sm font-orbitron font-bold text-cyan-300 mt-1.5 block truncate">
              {telemetry['FAN_STATUS']?.displayValue || 'خاموش (OFF)'}
            </span>
          </div>

          <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
            <span className="text-zinc-400 text-xs flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-emerald-400" /> {t.instantFuel}
            </span>
            <span className="text-xl font-orbitron font-bold text-emerald-400 mt-1 block">
              {telemetry['FUEL_L100KM']?.displayValue || '0.0 L/100km'}
            </span>
          </div>

          <div className="bg-zinc-900/90 p-3 rounded-xl border border-zinc-800">
            <span className="text-zinc-400 text-xs flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-cyan-400" /> {t.avgFuel}
            </span>
            <span className="text-xl font-orbitron font-bold text-cyan-300 mt-1 block">
              {telemetry['AVG_FUEL_L100KM']?.displayValue || '8.5 L/100km'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
