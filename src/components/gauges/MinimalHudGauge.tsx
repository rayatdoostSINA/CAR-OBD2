import React, { useEffect, useState } from 'react';
import { TelemetryValue, UserPreferences, VehicleProfile } from '../../types';

interface Props {
  telemetry: Record<string, TelemetryValue>;
  preferences?: UserPreferences;
  vehicle?: VehicleProfile;
  tripStats?: {
    distanceKm: number;
    elapsedSeconds: number;
    maxSpeed: number;
    fuelConsumedLiters: number;
  };
}

export const MinimalHudGauge: React.FC<Props> = ({
  telemetry,
  tripStats = { distanceKm: 0, elapsedSeconds: 0, maxSpeed: 0, fuelConsumedLiters: 0 }
}) => {
  const [clockStr, setClockStr] = useState<string>('00:00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setClockStr(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Telemetry values
  const rawSpeed = telemetry['010D']?.value;
  const hasSpeed = rawSpeed !== undefined && rawSpeed !== null;
  const speed = hasSpeed ? Math.round(rawSpeed) : null;

  const rawRpm = telemetry['010C']?.value;
  const hasRpm = rawRpm !== undefined && rawRpm !== null;
  const rpm = hasRpm ? Math.round(rawRpm) : null;

  const rawEct = telemetry['0105']?.value;
  const hasEct = rawEct !== undefined && rawEct !== null;
  const ect = hasEct ? Math.round(rawEct) : null;

  // Boost calculation from MAP (010B) or direct TURBO_BOOST_BAR
  const mapVal = telemetry['010B']?.value;
  const baroVal = telemetry['0133']?.value ?? 100;
  const rawBoost = telemetry['TURBO_BOOST_BAR']?.value;
  const boost = rawBoost !== undefined && rawBoost !== null 
    ? rawBoost 
    : (mapVal !== undefined && mapVal !== null ? Number(((mapVal - baroVal) / 100).toFixed(1)) : null);

  const gear = telemetry['CURRENT_GEAR']?.displayValue || (hasSpeed && rawSpeed > 5 ? 'D' : 'N');

  // RPM Scale (0 to 9 representing 0 to 9000 RPM)
  const maxRpm = 9000;
  const currentRpmVal = rpm ?? 0;
  const rpmNorm = Math.min(1, Math.max(0, currentRpmVal / maxRpm));

  // 60 dense segmented ticks around the tach arc (270 degrees total: 135 deg to 405 deg)
  const totalTicks = 60;
  const activeTicksCount = Math.round(rpmNorm * totalTicks);

  // Coolant temperature bar ratio (20°C to 120°C)
  const totalTempSegments = 7;
  const currentEctVal = ect ?? 20;
  const tempRatio = Math.min(1, Math.max(0, (currentEctVal - 20) / (120 - 20)));
  const activeTempSegments = ect !== null ? Math.max(1, Math.round(tempRatio * totalTempSegments)) : 0;

  return (
    <div id="lufi-reference-hud" className="w-full max-w-5xl mx-auto p-1 sm:p-2 md:p-3 select-none flex items-center justify-center">
      
      {/* Outer Sleek Matte Black Bezel Chassis with Glass Glare */}
      <div className="w-full relative bg-[#171a1f] rounded-2xl sm:rounded-3xl border-2 sm:border-4 md:border-6 border-[#2b313c] shadow-[0_15px_40px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,255,255,0.15)] overflow-hidden p-2 sm:p-4 md:p-6">
        
        {/* Authentic Diagonal Glass Sheen Reflection matching reference image */}
        <div 
          className="absolute inset-0 pointer-events-none z-20 opacity-20"
          style={{
            background: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.08) 46%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.05) 54%, transparent 62%)'
          }}
        />

        {/* 2-Column Responsive Layout in Landscape & Tablets */}
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2 sm:gap-4 md:gap-6">
          
          {/* =========================================================================
              LEFT: TACHOMETER DIAL & SPEEDOMETER CLUSTER (7 COLS ON SM+)
              ========================================================================= */}
          <div className="sm:col-span-7 flex flex-col items-center justify-center relative">
            
            {/* Circular Gauge Bezel (Fluid Responsive Dimension) */}
            <div className="relative w-full max-w-[210px] xs:max-w-[240px] sm:max-w-[290px] md:max-w-[340px] aspect-square flex items-center justify-center">
              
              {/* SVG Radial Needle Arc and Numbers */}
              <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-[0_6px_16px_rgba(0,0,0,0.8)]">
                <defs>
                  {/* Chrome Outer Ring Bezel Gradient */}
                  <linearGradient id="chromeBezel" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="30%" stopColor="#8d99ae" stopOpacity="1" />
                    <stop offset="50%" stopColor="#2b303a" stopOpacity="1" />
                    <stop offset="70%" stopColor="#c5d0e6" stopOpacity="1" />
                    <stop offset="100%" stopColor="#1e222a" stopOpacity="1" />
                  </linearGradient>

                  {/* Glass highlight on center screen */}
                  <linearGradient id="centerGlass" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1c222b" />
                    <stop offset="50%" stopColor="#11151c" />
                    <stop offset="100%" stopColor="#080b0f" />
                  </linearGradient>
                </defs>

                {/* Outer Silver Bezel Ring */}
                <circle 
                  cx="200" 
                  cy="200" 
                  r="194" 
                  fill="none" 
                  stroke="url(#chromeBezel)" 
                  strokeWidth="5" 
                />
                
                {/* Thin Inner Shadow Ring */}
                <circle 
                  cx="200" 
                  cy="200" 
                  r="190" 
                  fill="#12151b" 
                  stroke="#05070a" 
                  strokeWidth="2" 
                />

                {/* Dark Groove Track for Radial Bars */}
                <circle 
                  cx="200" 
                  cy="200" 
                  r="164" 
                  fill="none" 
                  stroke="#1c212a" 
                  strokeWidth="42" 
                />

                {/* Segmented Radial Ticks (0 to 9000 RPM) */}
                {Array.from({ length: totalTicks }).map((_, i) => {
                  // Arc spans 270 degrees (from 135 deg to 405 deg)
                  const angleDeg = 135 + (i / (totalTicks - 1)) * 270;
                  const angleRad = (angleDeg * Math.PI) / 180;
                  
                  const isLit = i <= activeTicksCount;
                  
                  // Color zones matching reference:
                  // 0 to ~3.5 = Cyan/Sky Blue (#00e5ff)
                  // ~3.5 to ~5.0 = Bright Yellow (#ffee00)
                  // > 5.0 when redlining = Red (#ff2a4b)
                  const tickRatio = i / totalTicks;
                  const isYellowZone = tickRatio >= 0.36 && tickRatio < 0.55;
                  const isRedZone = tickRatio >= 0.78;

                  let strokeColor = '#242b36';
                  let glowFilter = 'none';

                  if (isLit) {
                    if (isRedZone) {
                      strokeColor = '#ff2a4b';
                      glowFilter = 'drop-shadow(0 0 5px #ff2a4b)';
                    } else if (isYellowZone) {
                      strokeColor = '#ffee00';
                      glowFilter = 'drop-shadow(0 0 5px #ffee00)';
                    } else {
                      strokeColor = '#00f0ff';
                      glowFilter = 'drop-shadow(0 0 5px #00f0ff)';
                    }
                  }

                  const rInner = 145;
                  const rOuter = 183;
                  const x1 = 200 + rInner * Math.cos(angleRad);
                  const y1 = 200 + rInner * Math.sin(angleRad);
                  const x2 = 200 + rOuter * Math.cos(angleRad);
                  const y2 = 200 + rOuter * Math.sin(angleRad);

                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={strokeColor}
                      strokeWidth="3.2"
                      strokeLinecap="butt"
                      style={{ filter: glowFilter }}
                    />
                  );
                })}

                {/* Inner Chrome Bezel Ring separating tachometer from center screen */}
                <circle 
                  cx="200" 
                  cy="200" 
                  r="142" 
                  fill="url(#centerGlass)" 
                  stroke="url(#chromeBezel)" 
                  strokeWidth="3.5" 
                />

                {/* Scale Numbers 0 to 9 */}
                {[
                  { num: '0', angle: 138, r: 165 },
                  { num: '1', angle: 168, r: 165 },
                  { num: '2', angle: 198, r: 165 },
                  { num: '3', angle: 228, r: 165 },
                  { num: '4', angle: 258, r: 165 },
                  { num: '5', angle: 288, r: 165 },
                  { num: '6', angle: 318, r: 165 },
                  { num: '7', angle: 348, r: 165 },
                  { num: '8', angle: 378, r: 165 },
                  { num: '9', angle: 408, r: 165 },
                ].map(({ num, angle, r }) => {
                  const rad = (angle * Math.PI) / 180;
                  const x = 200 + r * Math.cos(rad);
                  const y = 200 + r * Math.sin(rad);

                  return (
                    <text
                      key={num}
                      x={x}
                      y={y + 7}
                      fill="#ffffff"
                      fontSize="26"
                      fontWeight="900"
                      fontFamily="'Arial Black', 'Inter', sans-serif"
                      textAnchor="middle"
                      className="select-none"
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                    >
                      {num}
                    </text>
                  );
                })}

                {/* Top Compass / Gear Arch */}
                <path
                  d="M 130 115 Q 200 135 270 115"
                  fill="none"
                  stroke="#3a4556"
                  strokeWidth="1.5"
                />

                {/* Top Center White Needle Marker */}
                <polygon points="200,82 196,96 204,96" fill="#ffffff" />
                <line x1="200" y1="96" x2="200" y2="108" stroke="#ffffff" strokeWidth="2" />

                <line x1="165" y1="92" x2="165" y2="102" stroke="#8896ab" strokeWidth="1.5" />
                <line x1="235" y1="92" x2="235" y2="102" stroke="#8896ab" strokeWidth="1.5" />

                <text x="155" y="116" fill="#8d99ae" fontSize="13" fontWeight="bold" textAnchor="middle">V</text>
                <text x="200" y="122" fill="#ffffff" fontSize="18" fontWeight="900" textAnchor="middle" fontFamily="'Arial Black', sans-serif">
                  {gear === 'P' || gear === 'R' || gear === 'D' ? gear : 'N'}
                </text>
                <text x="245" y="116" fill="#8d99ae" fontSize="13" fontWeight="bold" textAnchor="middle">F</text>

                {/* Center Divider */}
                <line x1="100" y1="200" x2="300" y2="200" stroke="#4e5d73" strokeWidth="1.5" />
                <line 
                  x1="140" 
                  y1="200" 
                  x2="260" 
                  y2="200" 
                  stroke="#00ffcc" 
                  strokeWidth="1.5" 
                  strokeOpacity="0.8"
                  style={{ filter: 'drop-shadow(0 0 6px #00ffcc)' }}
                />
              </svg>

              {/* Digital Values Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {/* Upper RPM */}
                <div className="flex flex-col items-center -mt-1 sm:-mt-2">
                  <div 
                    className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#00ffcc] select-none leading-none"
                    style={{
                      fontFamily: 'Orbitron, monospace',
                      textShadow: '0 0 14px rgba(0,255,204,0.7), 0 0 2px #ffffff'
                    }}
                  >
                    {rpm !== null ? rpm : '---'}
                  </div>
                  <span className="text-[8px] sm:text-[10px] font-extrabold text-slate-300 tracking-wider self-end mr-6 sm:mr-10 font-sans">
                    RPM
                  </span>
                </div>

                {/* Lower Speed */}
                <div className="flex flex-col items-center mt-1 sm:mt-2.5">
                  <div 
                    className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#00ffcc] select-none leading-none"
                    style={{
                      fontFamily: 'Orbitron, monospace',
                      textShadow: '0 0 14px rgba(0,255,204,0.7), 0 0 2px #ffffff'
                    }}
                  >
                    {speed !== null ? speed : '---'}
                  </div>
                  <span className="text-[7px] sm:text-[9px] font-bold text-slate-300 tracking-wider font-sans">
                    KM/H
                  </span>
                </div>
              </div>

            </div>

            {/* Bottom Coolant Sub-Gauge `20 °C 120` */}
            <div className="mt-1.5 sm:mt-2 w-full max-w-[190px] sm:max-w-[240px] bg-[#11161d] rounded-xl sm:rounded-2xl p-1.5 sm:p-2 border-2 border-[#333d4d] flex flex-col items-center shadow-md">
              <div className="flex items-center justify-center text-[#00e5ff] mb-0.5 sm:mb-1">
                <svg viewBox="0 0 40 24" className="w-5 sm:w-6 h-3 sm:h-3.5 fill-none stroke-[#00e5ff] stroke-[2.2]">
                  <path d="M20 3 v9 a3 3 0 1 0 0 6 a3 3 0 0 0 0 -6 v-9 z" fill="#00e5ff" fillOpacity="0.4" />
                  <path d="M12 18 c2 -1 4 -1 6 0 c2 1 4 1 6 0 c2 -1 4 -1 6 0" />
                  <path d="M12 21 c2 -1 4 -1 6 0 c2 1 4 1 6 0 c2 -1 4 -1 6 0" />
                </svg>
              </div>

              {/* Segmented Solid Green Temp Bar */}
              <div className="w-full bg-[#18202c] p-0.5 sm:p-1 rounded-md border border-[#2b3544] flex items-center justify-between gap-0.5 sm:gap-1">
                {Array.from({ length: totalTempSegments }).map((_, idx) => {
                  const isLit = idx < activeTempSegments;
                  const isRed = idx >= totalTempSegments - 1;

                  return (
                    <div
                      key={idx}
                      className={`flex-1 h-2.5 sm:h-3 rounded-xs transition-colors duration-150 ${
                        isLit 
                          ? isRed
                            ? 'bg-[#ff2a4b] shadow-[0_0_5px_#ff2a4b]'
                            : 'bg-[#15e038] shadow-[0_0_5px_#15e038]'
                          : 'bg-[#0e131a]'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Scale Labels */}
              <div className="w-full flex justify-between items-center text-[10px] sm:text-xs font-black text-[#00e5ff] px-1 mt-0.5 font-mono">
                <span>20</span>
                <span className="text-slate-300 font-sans text-[9px]">°C</span>
                <span>120</span>
              </div>
            </div>

          </div>

          {/* =========================================================================
              RIGHT: 4 ROWS TELEMETRY STACK (TURBO, ECT.T, TRIP, CLOCK) (5 COLS ON SM+)
              ========================================================================= */}
          <div className="sm:col-span-5 flex flex-col divide-y divide-[#2d3542]/80 border-t sm:border-t-0 border-[#2d3542]/80 pt-1 sm:pt-0">
            
            {/* ROW 1: TURBO */}
            <div className="py-1.5 sm:py-2.5 md:py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span 
                  className="text-sm sm:text-base md:text-lg font-black text-[#00e5ff] tracking-wider uppercase font-sans"
                  style={{ textShadow: '0 0 8px rgba(0,229,255,0.4)' }}
                >
                  TURBO
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-[#00e5ff] bg-[#00e5ff]/10 flex items-center justify-center shadow-[0_0_6px_rgba(0,229,255,0.4)]">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-none stroke-[#00e5ff] stroke-[2.2]">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="3" fill="#00e5ff" />
                    <path d="M12 3 a9 9 0 0 1 7 4 l-6 4" />
                    <path d="M21 12 a9 9 0 0 1 -4 7 l-4 -6" />
                    <path d="M12 21 a9 9 0 0 1 -7 -4 l6 -4" />
                    <path d="M3 12 a9 9 0 0 1 4 -7 l4 6" />
                  </svg>
                </div>

                <div 
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-[#00ffcc] tracking-tight min-w-[75px] sm:min-w-[100px] text-right"
                  style={{
                    fontFamily: 'Orbitron, monospace',
                    textShadow: '0 0 12px rgba(0,255,204,0.7), 0 0 2px #ffffff'
                  }}
                >
                  {boost !== null ? (boost >= 0 ? `+${boost.toFixed(1)}` : boost.toFixed(1)) : '---'}
                </div>
              </div>
            </div>

            {/* ROW 2: ECT.T */}
            <div className="py-1.5 sm:py-2.5 md:py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span 
                  className="text-sm sm:text-base md:text-lg font-black text-[#00e5ff] tracking-wider uppercase font-sans"
                  style={{ textShadow: '0 0 8px rgba(0,229,255,0.4)' }}
                >
                  ECT.T
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3">
                <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-[#00e5ff]">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 fill-none stroke-[#00e5ff] stroke-[2.2]">
                    <path d="M12 3 v10 a3 3 0 1 0 0 4 a3 3 0 0 0 0 -4 v-10 z" />
                    <path d="M6 19 c1.5 -1 3 -1 4.5 0 c1.5 1 3 1 4.5 0 c1.5 -1 3 -1 4.5 0" />
                    <path d="M6 21 c1.5 -1 3 -1 4.5 0 c1.5 1 3 1 4.5 0 c1.5 -1 3 -1 4.5 0" />
                  </svg>
                </div>

                <div 
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-[#00ffcc] tracking-tight min-w-[75px] sm:min-w-[100px] text-right"
                  style={{
                    fontFamily: 'Orbitron, monospace',
                    textShadow: '0 0 12px rgba(0,255,204,0.7), 0 0 2px #ffffff'
                  }}
                >
                  {ect !== null ? `${ect}°` : '---'}
                </div>
              </div>
            </div>

            {/* ROW 3: TRIP */}
            <div className="py-1.5 sm:py-2.5 md:py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span 
                  className="text-sm sm:text-base md:text-lg font-black text-[#00e5ff] tracking-wider uppercase font-sans"
                  style={{ textShadow: '0 0 8px rgba(0,229,255,0.4)' }}
                >
                  TRIP
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] sm:text-[11px] font-black text-[#00e5ff] tracking-widest font-sans">
                    A B
                  </span>
                  <svg viewBox="0 0 32 10" className="w-5 sm:w-7 h-2 sm:h-2.5">
                    <defs>
                      <linearGradient id="arrowGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#00e5ff" stopOpacity="1" />
                      </linearGradient>
                    </defs>
                    <path d="M0 5 h24 M20 1 l6 4 l-6 4" stroke="url(#arrowGrad2)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <div 
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-[#00ffcc] tracking-tight min-w-[75px] sm:min-w-[100px] text-right"
                  style={{
                    fontFamily: 'Orbitron, monospace',
                    textShadow: '0 0 12px rgba(0,255,204,0.7), 0 0 2px #ffffff'
                  }}
                >
                  {tripStats.distanceKm.toFixed(2)}
                </div>
              </div>
            </div>

            {/* ROW 4: CLOCK */}
            <div className="py-1.5 sm:py-2.5 md:py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span 
                  className="text-sm sm:text-base md:text-lg font-black text-[#00e5ff] tracking-wider uppercase font-sans"
                  style={{ textShadow: '0 0 8px rgba(0,229,255,0.4)' }}
                >
                  CLOCK
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-3">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-[#00e5ff] bg-[#00e5ff]/10 flex items-center justify-center shadow-[0_0_6px_rgba(0,229,255,0.4)]">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-none stroke-[#00e5ff] stroke-[2.2]">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7 v5 l3 2" />
                  </svg>
                </div>

                <div 
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-[#00ffcc] tracking-tight min-w-[75px] sm:min-w-[100px] text-right"
                  style={{
                    fontFamily: 'Orbitron, monospace',
                    textShadow: '0 0 12px rgba(0,255,204,0.7), 0 0 2px #ffffff'
                  }}
                >
                  {clockStr}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
