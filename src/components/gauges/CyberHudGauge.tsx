import React from 'react';
import { TelemetryValue, UserPreferences, VehicleProfile } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { Gauge, Zap, Flame, Wind, Battery, Activity, Fuel } from 'lucide-react';

interface Props {
  telemetry: Record<string, TelemetryValue>;
  preferences: UserPreferences;
  vehicle: VehicleProfile;
  tripStats: { distanceKm: number; durationSeconds: number; maxSpeed: number; avgSpeed: number; maxRpm: number; maxEct: number };
  themeStyles: { glowColor: string; primaryColor: string; accentColor: string };
}

export const CyberHudGauge: React.FC<Props> = ({
  telemetry,
  preferences,
  vehicle,
  tripStats,
  themeStyles
}) => {
  const t = getTranslation(preferences.language);
  const isRtl = preferences.language === 'fa';

  const rpmVal = telemetry['010C']?.value ?? 0;
  const speedVal = telemetry['010D']?.value ?? 0;
  const ectVal = telemetry['0105']?.value;
  const ectSupported = telemetry['0105']?.isSupported ?? true;
  const loadVal = telemetry['0104']?.value;
  const loadSupported = telemetry['0104']?.isSupported ?? true;
  const tpsVal = telemetry['0111']?.value;
  const tpsSupported = telemetry['0111']?.isSupported ?? true;
  const iatVal = telemetry['010F']?.value;
  const iatSupported = telemetry['010F']?.isSupported ?? true;
  const mapVal = telemetry['010B']?.value;
  const mapSupported = telemetry['010B']?.isSupported ?? true;
  const vltVal = telemetry['0142']?.value;
  const vltSupported = telemetry['0142']?.isSupported ?? true;
  const tftVal = telemetry['01A6']?.value;
  const tftSupported = telemetry['01A6']?.isSupported ?? true;

  // Boost calculation from MAP (assuming 100 kPa atmospheric pressure)
  const baro = telemetry['0133']?.value ?? 100;
  const boostBar = mapVal !== null && mapVal !== undefined ? Number(((mapVal - baro) / 100).toFixed(2)) : null;

  // Shift Light LED sequence calculation (0 to 8 dots)
  const redline = vehicle.redlineRpm || 6500;
  const activeLeds = Math.min(8, Math.floor((rpmVal / (redline * 0.95)) * 8));
  const isRedlineActive = rpmVal >= redline * 0.92;

  // Tachometer SVG Arc
  const radius = 140;
  const strokeWidth = 14;
  // Arc from 140 deg to 400 deg (260 deg sweep)
  const totalAngle = 240;
  const startAngle = 150;
  const endAngle = startAngle + (totalAngle * (rpmVal / redline));

  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians)
    };
  };

  const describeArc = (x: number, y: number, r: number, startA: number, endA: number) => {
    const start = polarToCartesian(x, y, r, endA);
    const end = polarToCartesian(x, y, r, startA);
    const largeArcFlag = endA - startA <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const backgroundArcPath = describeArc(200, 180, radius, startAngle, startAngle + totalAngle);
  const activeArcPath = rpmVal > 100 ? describeArc(200, 180, radius, startAngle, Math.min(startAngle + totalAngle, endAngle)) : '';

  // Format trip time
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div id="cyber-hud-container" className="w-full flex flex-col items-center justify-center p-2 sm:p-4">
      {/* Outer Cyber Chassis Frame */}
      <div 
        id="cyber-hud-chassis"
        className="relative w-full max-w-5xl rounded-3xl p-4 sm:p-6 transition-all duration-300 hud-chassis"
        style={{
          boxShadow: `0 0 35px ${themeStyles.glowColor || 'rgba(6, 182, 212, 0.25)'}, inset 0 0 20px rgba(255, 255, 255, 0.05)`
        }}
      >
        {/* Futuristic Side Glowing Wings */}
        <div className="absolute -left-3 sm:-left-5 top-1/4 bottom-1/4 w-3 sm:w-4 rounded-l-2xl bg-gradient-to-b from-cyan-400 via-sky-500 to-fuchsia-500 shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-pulse" />
        <div className="absolute -right-3 sm:-right-5 top-1/4 bottom-1/4 w-3 sm:w-4 rounded-r-2xl bg-gradient-to-b from-cyan-400 via-sky-500 to-fuchsia-500 shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-pulse" />

        {/* Top Sequential Shift Light LED Bar */}
        <div className="w-full flex flex-col items-center justify-center mb-3">
          <div className="flex items-center gap-2 sm:gap-3 bg-black/60 px-5 py-2 rounded-full border border-slate-700/60 shadow-inner">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
              const isOn = idx < activeLeds;
              let dotColor = 'bg-slate-800 border-slate-700';
              if (isOn) {
                if (idx < 3) dotColor = 'bg-cyan-400 border-cyan-300 shadow-[0_0_10px_#22d3ee]';
                else if (idx < 5) dotColor = 'bg-emerald-400 border-emerald-300 shadow-[0_0_10px_#34d399]';
                else if (idx < 7) dotColor = 'bg-amber-400 border-amber-300 shadow-[0_0_10px_#fbbf24]';
                else dotColor = 'bg-red-500 border-red-400 shadow-[0_0_15px_#ef4444] animate-ping';
              }
              return (
                <div
                  key={idx}
                  className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full border transition-all duration-75 ${dotColor}`}
                />
              );
            })}
          </div>
          {isRedlineActive && (
            <span className="text-xs font-bold text-red-400 tracking-widest mt-1 animate-bounce uppercase">
              {isRtl ? 'تعویض دنده! (ردلاین)' : 'SHIFT NOW! (REDLINE)'}
            </span>
          )}
        </div>

        {/* Center Screen Inset */}
        <div className="relative w-full rounded-2xl p-4 sm:p-6 hud-screen-inset border border-slate-800/80">
          {/* Main Display Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Left Telemetry Pods */}
            <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-1 gap-3 order-2 lg:order-1">
              {/* Coolant ECT */}
              <div className={`bg-slate-900/80 rounded-xl p-3 border ${telemetry['0105']?.status === 'critical' ? 'border-red-500 shadow-[0_0_15px_#ef4444]' : 'border-slate-800'}`}>
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-cyan-400" />
                    {t.ect}
                  </span>
                  <span className="font-mono text-cyan-400">ECT</span>
                </div>
                {ectSupported ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl sm:text-3xl font-orbitron font-bold text-white tracking-wider">
                      {ectVal !== null && ectVal !== undefined ? Math.round(ectVal) : '---'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">°C</span>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-amber-500/90 italic">{t.unsupportedNote}</div>
                )}
                {/* Visual bar */}
                {ectSupported && ectVal !== null && ectVal !== undefined && (
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${ectVal > 105 ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : ectVal > 95 ? 'bg-amber-400' : 'bg-cyan-400'}`}
                      style={{ width: `${Math.min(100, Math.max(0, ((ectVal - 40) / 80) * 100))}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Battery Voltage */}
              <div className={`bg-slate-900/80 rounded-xl p-3 border ${telemetry['0142']?.status === 'critical' ? 'border-red-500 shadow-[0_0_15px_#ef4444]' : 'border-slate-800'}`}>
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Battery className="w-3.5 h-3.5 text-emerald-400" />
                    {t.vlt}
                  </span>
                  <span className="font-mono text-emerald-400">VLT</span>
                </div>
                {vltSupported ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl sm:text-3xl font-orbitron font-bold text-emerald-400 tracking-wider">
                      {vltVal !== null && vltVal !== undefined ? vltVal.toFixed(1) : '---'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">V</span>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-amber-500/90 italic">{t.unsupportedNote}</div>
                )}
                {vltSupported && vltVal !== null && vltVal !== undefined && (
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${vltVal < 11.8 ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min(100, Math.max(0, ((vltVal - 10) / 5) * 100))}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Intake Air Temp (IAT) */}
              <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5 text-sky-400" />
                    {t.iat}
                  </span>
                  <span className="font-mono text-sky-400">IAT</span>
                </div>
                {iatSupported ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl sm:text-3xl font-orbitron font-bold text-white tracking-wider">
                      {iatVal !== null && iatVal !== undefined ? Math.round(iatVal) : '---'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">°C</span>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-amber-500/90 italic">{t.unsupportedNote}</div>
                )}
              </div>

              {/* Transmission Fluid Temp (TFT / ATF) */}
              <div className={`bg-slate-900/80 rounded-xl p-3 border ${telemetry['01A6']?.status === 'critical' ? 'border-red-500 shadow-[0_0_15px_#ef4444]' : 'border-slate-800'}`}>
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    {t.tft}
                  </span>
                  <span className="font-mono text-orange-400">TFT</span>
                </div>
                {tftSupported ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl sm:text-3xl font-orbitron font-bold text-orange-400 tracking-wider">
                      {tftVal !== null && tftVal !== undefined ? Math.round(tftVal) : '---'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">°C</span>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-amber-500/90 italic">{t.unsupportedNote}</div>
                )}
                {tftSupported && tftVal !== null && tftVal !== undefined && (
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${tftVal > 115 ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : tftVal > 100 ? 'bg-amber-400' : 'bg-orange-400'}`}
                      style={{ width: `${Math.min(100, Math.max(0, ((tftVal - 40) / 90) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Center Super Gauge: Circular Tachometer Arc & Digital Speed */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center order-1 lg:order-2">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
                
                {/* SVG Gauge Background & Active Needle Path */}
                <svg className="w-full h-full transform -rotate-10" viewBox="0 0 400 360">
                  <defs>
                    <linearGradient id="cyberTachoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="85%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                    <filter id="neonGlow">
                      <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Background Track */}
                  <path
                    d={backgroundArcPath}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                  />

                  {/* Tick marks */}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((rpmK) => {
                    const angle = startAngle + (totalAngle * ((rpmK * 1000) / redline));
                    if (angle > startAngle + totalAngle) return null;
                    const inner = polarToCartesian(200, 180, radius - 15, angle);
                    const outer = polarToCartesian(200, 180, radius + 10, angle);
                    const textPos = polarToCartesian(200, 180, radius - 28, angle);
                    const isRed = (rpmK * 1000) >= redline * 0.9;
                    return (
                      <g key={rpmK}>
                        <line
                          x1={inner.x}
                          y1={inner.y}
                          x2={outer.x}
                          y2={outer.y}
                          stroke={isRed ? '#ef4444' : '#64748b'}
                          strokeWidth="2.5"
                        />
                        <text
                          x={textPos.x}
                          y={textPos.y + 4}
                          textAnchor="middle"
                          fill={isRed ? '#ef4444' : '#94a3b8'}
                          fontSize="13"
                          fontFamily="Orbitron"
                          fontWeight="bold"
                        >
                          {rpmK}
                        </text>
                      </g>
                    );
                  })}

                  {/* Active Tachometer Glowing Arc */}
                  {activeArcPath && (
                    <path
                      d={activeArcPath}
                      fill="none"
                      stroke="url(#cyberTachoGrad)"
                      strokeWidth={strokeWidth + 2}
                      strokeLinecap="round"
                      filter="url(#neonGlow)"
                    />
                  )}
                </svg>

                {/* Center Digital Speed & RPM Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                  <span className="text-xs tracking-widest text-slate-400 font-bold uppercase">
                    {t.speed}
                  </span>
                  
                  {/* Huge Digital Speed Readout */}
                  <div className="flex items-baseline">
                    <span 
                      className="text-6xl sm:text-7xl font-black font-orbitron text-white tracking-tighter"
                      style={{
                        textShadow: `0 0 25px ${themeStyles.glowColor || 'rgba(6,182,212,0.6)'}`
                      }}
                    >
                      {Math.round(speedVal)}
                    </span>
                    <span className="text-sm sm:text-base font-bold text-cyan-400 ml-1">
                      km/h
                    </span>
                  </div>

                  {/* Digital RPM Counter & Smart Gear Indicator */}
                  <div className="mt-1 flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1 rounded-lg border border-slate-800">
                      <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                      <span className="text-base sm:text-lg font-orbitron font-bold text-cyan-300">
                        {Math.round(rpmVal)}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">RPM</span>
                    </div>

                    {/* Active Gear Badge & Radiator Fan */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-slate-950/90 px-3 py-1 rounded-xl border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{isRtl ? 'دنده' : 'GEAR'}</span>
                        <span className="text-base font-orbitron font-black text-cyan-300">
                          {telemetry['GEAR']?.displayValue || (speedVal > 2 ? 'D' : 'P')}
                        </span>
                      </div>

                      {telemetry['FAN_STATUS'] && (
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[10px] font-bold ${
                          telemetry['FAN_STATUS'].value === 2 
                            ? 'bg-red-950/90 border-red-500 text-red-300 animate-pulse' 
                            : telemetry['FAN_STATUS'].value === 1 
                              ? 'bg-amber-950/90 border-amber-500 text-amber-300' 
                              : 'bg-slate-950/80 border-slate-800 text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${telemetry['FAN_STATUS'].value === 2 ? 'bg-red-400' : telemetry['FAN_STATUS'].value === 1 ? 'bg-amber-400' : 'bg-slate-500'}`} />
                          <span>{telemetry['FAN_STATUS'].displayValue}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Telemetry Pods */}
            <div className="lg:col-span-3 grid grid-cols-2 lg:grid-cols-1 gap-3 order-3">
              {/* MAP / Turbo Boost */}
              <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-fuchsia-400" />
                    {boostBar !== null && boostBar > 0 ? t.boost : t.map}
                  </span>
                  <span className="font-mono text-fuchsia-400">
                    {boostBar !== null && boostBar > 0 ? 'BOOST' : 'MAP'}
                  </span>
                </div>
                {mapSupported ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl sm:text-3xl font-orbitron font-bold text-fuchsia-400 tracking-wider">
                      {boostBar !== null && boostBar > 0 ? boostBar.toFixed(2) : (mapVal !== null && mapVal !== undefined ? Math.round(mapVal) : '---')}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {boostBar !== null && boostBar > 0 ? 'bar' : 'kPa'}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-amber-500/90 italic">{t.unsupportedNote}</div>
                )}
              </div>

              {/* Throttle Position (TPS) */}
              <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    {t.tps}
                  </span>
                  <span className="font-mono text-amber-400">TPS</span>
                </div>
                {tpsSupported ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl sm:text-3xl font-orbitron font-bold text-white tracking-wider">
                      {tpsVal !== null && tpsVal !== undefined ? Math.round(tpsVal) : '---'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-amber-500/90 italic">{t.unsupportedNote}</div>
                )}
                {tpsSupported && tpsVal !== null && tpsVal !== undefined && (
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-amber-400 rounded-full transition-all duration-150"
                      style={{ width: `${Math.min(100, Math.max(0, tpsVal))}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Engine Load */}
              <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-rose-400" />
                    {t.load}
                  </span>
                  <span className="font-mono text-rose-400">LOAD</span>
                </div>
                {loadSupported ? (
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl sm:text-3xl font-orbitron font-bold text-white tracking-wider">
                      {loadVal !== null && loadVal !== undefined ? Math.round(loadVal) : '---'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-amber-500/90 italic">{t.unsupportedNote}</div>
                )}
              </div>
            </div>

          </div>

          {/* Bottom Trip & Fuel Telemetry Ribbon */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
            <div className="bg-black/40 rounded-lg p-2 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">{t.tripDistance}</span>
              <span className="font-orbitron font-bold text-cyan-300 text-sm">
                {tripStats.distanceKm.toFixed(1)} km
              </span>
            </div>
            <div className="bg-black/40 rounded-lg p-2 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">{t.tripDuration}</span>
              <span className="font-orbitron font-bold text-slate-200 text-sm">
                {formatTime(tripStats.durationSeconds)}
              </span>
            </div>
            <div className="bg-black/40 rounded-lg p-2 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">{t.tripAvgSpeed}</span>
              <span className="font-orbitron font-bold text-slate-200 text-sm">
                {tripStats.avgSpeed} km/h
              </span>
            </div>
            <div className="bg-black/40 rounded-lg p-2 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">{t.tripMaxSpeed}</span>
              <span className="font-orbitron font-bold text-amber-400 text-sm">
                {Math.round(tripStats.maxSpeed)} km/h
              </span>
            </div>
            <div className="bg-black/40 rounded-lg p-2 border border-slate-800">
              <span className="text-slate-400 text-[11px] flex items-center justify-center gap-1">
                <Fuel className="w-3 h-3 text-emerald-400" />
                {t.instantFuel}
              </span>
              <span className="font-orbitron font-bold text-emerald-400 text-sm">
                {telemetry['FUEL_L100KM']?.displayValue || '0.0 L/100km'}
              </span>
            </div>
            <div className="bg-black/40 rounded-lg p-2 border border-slate-800">
              <span className="text-slate-400 text-[11px] flex items-center justify-center gap-1">
                <Fuel className="w-3 h-3 text-cyan-400" />
                {t.avgFuel}
              </span>
              <span className="font-orbitron font-bold text-cyan-300 text-sm">
                {telemetry['AVG_FUEL_L100KM']?.displayValue || '8.5 L/100km'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
