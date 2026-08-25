import React, { useState } from 'react';
import { TelemetryValue, UserPreferences, VehicleProfile, PIDDefinition } from '../../types';
import { getTranslation } from '../../i18n/translations';
import standardPidsJson from '../../database/standard_pid.json';
import { Settings, RotateCcw, Check } from 'lucide-react';

interface Props {
  telemetry: Record<string, TelemetryValue>;
  preferences: UserPreferences;
  vehicle: VehicleProfile;
  onResetPeaks: () => void;
}

export const MatrixGridGauge: React.FC<Props> = ({
  telemetry,
  preferences,
  vehicle,
  onResetPeaks
}) => {
  const t = getTranslation(preferences.language);
  const isRtl = preferences.language === 'fa';
  const allPids = standardPidsJson as PIDDefinition[];

  // Configurable tile slot assignment
  const [assignedPids, setAssignedPids] = useState<string[]>([
    '010C', // RPM
    '010D', // SPEED
    '0105', // ECT
    '01A6', // TFT (Transmission Fluid Temp)
    '015D', // EOP (Engine Oil Pressure)
    '0104', // LOAD
    '010B', // MAP / Turbo
    '0142', // VLT
    '015E', // FUEL RATE
    '0162', // ACTUAL TORQUE
    '0111', // TPS
    '010F'  // IAT
  ]);

  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const handleSelectPidForSlot = (pidId: string) => {
    if (selectedSlotIndex !== null) {
      const updated = [...assignedPids];
      updated[selectedSlotIndex] = pidId;
      setAssignedPids(updated);
      setSelectedSlotIndex(null);
    }
  };

  return (
    <div id="matrix-grid-container" className="w-full flex flex-col items-center p-2 sm:p-4">
      {/* Top Header Bar for Matrix */}
      <div className="w-full max-w-6xl flex items-center justify-between mb-4 bg-slate-900/90 px-4 py-3 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            {t.modeMatrix}
          </h2>
          <p className="text-xs text-slate-400">
            {isRtl ? 'روی هر کاشی کلیک کنید تا پارامتر آن را تغییر دهید' : 'Click any tile to customize its PID parameter'}
          </p>
        </div>

        <button
          onClick={onResetPeaks}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-semibold border border-slate-700 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t.resetPeaks}
        </button>
      </div>

      {/* Matrix Tiles Grid */}
      <div className="w-full max-w-6xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {assignedPids.map((pidId, slotIdx) => {
          const pidDef = allPids.find(p => p.id === pidId);
          const data = telemetry[pidId];
          const isSupported = data?.isSupported ?? true;
          const val = data?.value;

          let statusBorder = 'border-slate-800/90';
          let valColor = 'text-white';
          if (data?.status === 'critical') {
            statusBorder = 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]';
            valColor = 'text-red-400';
          } else if (data?.status === 'warning') {
            statusBorder = 'border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]';
            valColor = 'text-amber-400';
          } else if (pidId === '010D' || pidId === '010C') {
            valColor = 'text-cyan-300';
          } else if (pidId === '0142') {
            valColor = 'text-emerald-400';
          }

          const label = isRtl ? (pidDef?.persianName || pidDef?.name) : (pidDef?.englishName || pidDef?.name);

          return (
            <div
              key={slotIdx}
              onClick={() => setSelectedSlotIndex(slotIdx)}
              className={`relative bg-gradient-to-b from-slate-900/95 to-slate-950/95 rounded-2xl p-4 border ${statusBorder} hover:border-cyan-500/50 cursor-pointer transition-all duration-200 shadow-xl group`}
            >
              {/* Tile Top Label & Change Icon */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-bold text-slate-300 line-clamp-1">
                    {label}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                    {pidDef?.name || pidId}
                  </span>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition p-1 bg-slate-800 rounded-lg text-slate-300">
                  <Settings className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Main Telemetry Numeric Value */}
              <div className="my-2 min-h-[48px] flex items-baseline justify-between">
                {isSupported ? (
                  <>
                    <span className={`text-3xl sm:text-4xl font-orbitron font-extrabold tracking-tight ${valColor}`}>
                      {val !== null && val !== undefined ? (
                        pidId === '0142' ? val.toFixed(1) : (
                          pidId === '0114' ? val.toFixed(2) : Math.round(val)
                        )
                      ) : '---'}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-400 ml-1">
                      {pidDef?.unit || ''}
                    </span>
                  </>
                ) : (
                  <div className="w-full py-1 text-center bg-slate-800/60 rounded-lg border border-slate-700/50">
                    <span className="text-xs font-semibold text-amber-400/90 italic">
                      {t.unsupportedNote}
                    </span>
                  </div>
                )}
              </div>

              {/* Peak Records (Min / Max) */}
              {isSupported && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>
                    MIN: <strong className="text-slate-200">{data?.minPeak !== null && data?.minPeak !== undefined ? Math.round(data.minPeak) : '-'}</strong>
                  </span>
                  <span>
                    MAX: <strong className="text-cyan-300">{data?.maxPeak !== null && data?.maxPeak !== undefined ? Math.round(data.maxPeak) : '-'}</strong>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* PID Selector Modal */}
      {selectedSlotIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {isRtl ? `انتخاب پارامتر برای جایگاه شماره ${selectedSlotIndex + 1}` : `Select PID Parameter for Slot ${selectedSlotIndex + 1}`}
              </h3>
              <button
                onClick={() => setSelectedSlotIndex(null)}
                className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 py-3 flex-1">
              {allPids.map((p) => {
                const isCurrent = assignedPids[selectedSlotIndex] === p.id;
                const isCarSupported = vehicle.supportedPID.includes(p.id) || !vehicle.unsupportedPID.includes(p.id);

                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPidForSlot(p.id)}
                    className={`w-full p-3 rounded-xl flex items-center justify-between text-left transition ${isCurrent ? 'bg-cyan-950/80 border border-cyan-500 text-cyan-200' : 'bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-slate-200'}`}
                  >
                    <div>
                      <div className="font-bold text-sm flex items-center gap-2">
                        <span>{isRtl ? p.persianName : p.englishName}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-cyan-300 font-mono">
                          {p.name}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {p.category} • {p.unit} {p.description ? `• ${p.description}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCarSupported && (
                        <span className="text-[10px] bg-amber-950/80 text-amber-400 border border-amber-800 px-2 py-0.5 rounded">
                          {isRtl ? 'ممکن است ساپورت نشود' : 'May not be supported'}
                        </span>
                      )}
                      {isCurrent && <Check className="w-5 h-5 text-cyan-400" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
