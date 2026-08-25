import React, { useState, useEffect, useRef } from 'react';
import { UserPreferences, VehicleProfile, BrakingRun } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { 
  Zap, 
  Trophy, 
  RotateCcw, 
  Disc, 
  TrendingDown,
  Trash2
} from 'lucide-react';

interface Props {
  preferences: UserPreferences;
  vehicle: VehicleProfile;
  accelState: {
    isArmed: boolean;
    isRunning: boolean;
    currentSpeed: number;
    elapsedTime: number;
    bestTime: number | null;
  };
  onReset: () => void;
}

export const AccelerationTimerView: React.FC<Props> = ({
  preferences,
  vehicle,
  accelState,
  onReset
}) => {
  const t = getTranslation(preferences.language);
  const isRtl = preferences.language === 'fa';

  const [activeTab, setActiveTab] = useState<'accel' | 'brake'>('accel');
  const { isArmed, isRunning, currentSpeed, elapsedTime, bestTime } = accelState;

  // --- Braking Test State Machine ---
  const [brakeTargetSpeed, setBrakeTargetSpeed] = useState<number>(100);
  const [brakeStatus, setBrakeStatus] = useState<'idle' | 'ready' | 'braking' | 'finished'>('idle');
  const [brakeTime, setBrakeTime] = useState<number>(0);
  const [brakeDistance, setBrakeDistance] = useState<number>(0);
  const [maxDecelG, setMaxDecelG] = useState<number>(0);
  const [brakeHistory, setBrakeHistory] = useState<BrakingRun[]>(() => {
    try {
      const saved = localStorage.getItem('multigauge_braking_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const lastSpeedRef = useRef<number>(currentSpeed);
  const lastTimeRef = useRef<number>(0);
  const brakeStartTimeRef = useRef<number>(0);
  const brakeDistanceAccRef = useRef<number>(0);
  const maxGRef = useRef<number>(0);

  // Braking test real-time ticker
  useEffect(() => {
    if (activeTab !== 'brake') return;

    const now = Date.now();
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = now;
      lastSpeedRef.current = currentSpeed;
      return;
    }

    const dt = Math.max(0.01, (now - lastTimeRef.current) / 1000);
    const prevSpeed = lastSpeedRef.current;
    lastSpeedRef.current = currentSpeed;
    lastTimeRef.current = now;

    // 1. Idle -> Ready (When reaching cruising speed)
    if (brakeStatus === 'idle' || brakeStatus === 'finished') {
      if (currentSpeed >= brakeTargetSpeed) {
        queueMicrotask(() => setBrakeStatus('ready'));
      }
    } 
    // 2. Ready -> Braking (When speed begins dropping rapidly from target)
    else if (brakeStatus === 'ready') {
      if (currentSpeed < brakeTargetSpeed - 1) {
        brakeStartTimeRef.current = now;
        brakeDistanceAccRef.current = 0;
        maxGRef.current = 0;
        queueMicrotask(() => setBrakeStatus('braking'));
      }
    } 
    // 3. Braking in progress
    else if (brakeStatus === 'braking') {
      const elapsed = (now - brakeStartTimeRef.current) / 1000;
      // Distance integration: d = v_avg (m/s) * dt (s)
      const avgSpeedMps = ((prevSpeed + currentSpeed) / 2) * (1000 / 3600);
      brakeDistanceAccRef.current += avgSpeedMps * dt;

      // Deceleration G calculation: a = (dv / dt) / 9.81
      const dvMps = (prevSpeed - currentSpeed) * (1000 / 3600);
      const decelG = dt > 0 ? dvMps / dt / 9.81 : 0;
      if (decelG > maxGRef.current) {
        maxGRef.current = decelG;
      }

      // Complete stop detected!
      if (currentSpeed <= 1) {
        const finalRun: BrakingRun = {
          date: new Date().toLocaleTimeString(preferences.language === 'fa' ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          startSpeed: brakeTargetSpeed,
          timeSeconds: Number(elapsed.toFixed(2)),
          distanceMeters: Number(brakeDistanceAccRef.current.toFixed(1)),
          maxDecelG: Number(maxGRef.current.toFixed(2)),
          dataPoints: []
        };

        const updatedHistory = [finalRun, ...brakeHistory].slice(0, 10);
        try {
          localStorage.setItem('multigauge_braking_history', JSON.stringify(updatedHistory));
        } catch (err) {
          console.warn(err);
        }

        queueMicrotask(() => {
          setBrakeTime(elapsed);
          setBrakeDistance(brakeDistanceAccRef.current);
          setMaxDecelG(Number(maxGRef.current.toFixed(2)));
          setBrakeStatus('finished');
          setBrakeHistory(updatedHistory);
        });
      } else {
        queueMicrotask(() => {
          setBrakeTime(elapsed);
          setBrakeDistance(brakeDistanceAccRef.current);
          setMaxDecelG(Number(maxGRef.current.toFixed(2)));
        });
      }
    }
  }, [currentSpeed, brakeStatus, activeTab, brakeTargetSpeed, brakeHistory, preferences.language]);

  const handleResetBrake = () => {
    setBrakeStatus('idle');
    setBrakeTime(0);
    setBrakeDistance(0);
    setMaxDecelG(0);
    brakeDistanceAccRef.current = 0;
    maxGRef.current = 0;
  };

  const handleClearBrakeHistory = () => {
    setBrakeHistory([]);
    try {
      localStorage.removeItem('multigauge_braking_history');
    } catch {}
  };

  const bestBrakingDist = brakeHistory.length > 0
    ? Math.min(...brakeHistory.map(r => r.distanceMeters))
    : null;

  // Accel speed progress towards 100 km/h
  const speedPercent = Math.min(100, Math.max(0, (currentSpeed / 100) * 100));

  return (
    <div id="performance-view-container" className="w-full max-w-4xl flex flex-col p-2 sm:p-4 mx-auto space-y-6">
      
      {/* Top Mode Selector Tabs */}
      <div className="flex items-center justify-center gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 max-w-md mx-auto w-full">
        <button
          onClick={() => setActiveTab('accel')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === 'accel' 
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-950/50' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>{isRtl ? 'تست شتاب ۰ تا ۱۰۰' : '0-100 Acceleration'}</span>
        </button>

        <button
          onClick={() => setActiveTab('brake')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === 'brake' 
              ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-950/50' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Disc className="w-4 h-4 text-rose-300" />
          <span>{isRtl ? 'تست ترمزگیری ۱۰۰ به ۰' : '100-0 Braking Test'}</span>
        </button>
      </div>

      {/* --- TAB 1: 0-100 ACCELERATION TIMER --- */}
      {activeTab === 'accel' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-black rounded-3xl p-6 sm:p-8 border-2 border-cyan-900/60 shadow-[0_0_40px_rgba(6,182,212,0.15)] flex flex-col items-center text-center">
            
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-6 h-6 text-amber-400" />
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {t.accelTitle}
              </h1>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              {isRtl ? 'با توقف کامل خودرو سیستم آماده می‌شود و به محض لانچ و حرکت، زمان‌سنجی دقیق آغاز می‌گردد.' : 'Stop vehicle to arm timer automatically; launching throttle starts high-precision timing.'}
            </p>

            {/* State Banner */}
            <div className="mb-6">
              {isRunning ? (
                <span className="px-5 py-2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500 font-orbitron font-extrabold text-sm sm:text-base animate-pulse">
                  {t.accelLaunch}
                </span>
              ) : isArmed ? (
                <span className="px-5 py-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500 font-orbitron font-extrabold text-sm sm:text-base">
                  {t.accelReady}
                </span>
              ) : (
                <span className="px-5 py-2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500 font-orbitron font-extrabold text-sm sm:text-base">
                  {t.accelFinished}
                </span>
              )}
            </div>

            {/* Large Digital Stopwatch Readout */}
            <div className="my-4">
              <div className="flex items-baseline justify-center">
                <span className="text-7xl sm:text-8xl font-orbitron font-black text-cyan-300 tracking-tight">
                  {elapsedTime.toFixed(2)}
                </span>
                <span className="text-xl sm:text-2xl font-bold text-slate-400 ml-2">
                  sec
                </span>
              </div>
            </div>

            {/* Live Speed Arc / Progress Bar */}
            <div className="w-full max-w-lg mb-6">
              <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                <span>0 km/h</span>
                <span className="font-bold text-white text-sm">{Math.round(currentSpeed)} km/h</span>
                <span>100 km/h</span>
              </div>
              <div className="w-full bg-slate-800 h-3.5 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-75 ${speedPercent >= 100 ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]' : 'bg-gradient-to-r from-cyan-400 to-amber-400'}`}
                  style={{ width: `${speedPercent}%` }}
                />
              </div>
            </div>

            {/* Controls & Best Time Badge */}
            <div className="flex items-center gap-4">
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-bold border border-slate-700 transition"
              >
                <RotateCcw className="w-4 h-4" />
                {t.resetTimer}
              </button>

              {bestTime !== null && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-950/60 border border-amber-600/60 rounded-xl text-amber-300">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold">{t.accelBest}:</span>
                  <span className="font-orbitron font-extrabold text-sm">{bestTime.toFixed(2)}s</span>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* --- TAB 2: EMERGENCY BRAKING TEST (100 -> 0) --- */}
      {activeTab === 'brake' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-black rounded-3xl p-6 sm:p-8 border-2 border-rose-900/60 shadow-[0_0_40px_rgba(244,63,94,0.15)] flex flex-col items-center text-center">
            
            <div className="flex items-center justify-between w-full flex-wrap gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Disc className="w-6 h-6 text-rose-400 animate-spin-slow" />
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  {t.brakingTitle}
                </h1>
              </div>

              {/* Target speed switch */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => { setBrakeTargetSpeed(100); handleResetBrake(); }}
                  className={`px-3 py-1 rounded-lg font-bold transition ${brakeTargetSpeed === 100 ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
                >
                  100 → 0 km/h
                </button>
                <button
                  onClick={() => { setBrakeTargetSpeed(60); handleResetBrake(); }}
                  className={`px-3 py-1 rounded-lg font-bold transition ${brakeTargetSpeed === 60 ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
                >
                  60 → 0 km/h
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              {isRtl 
                ? `سرعت خودرو را به بیش از ${brakeTargetSpeed} کیلومتر برسانید؛ به محض فشردن شدید پدال ترمز، مسافت خط ترمز و زمان توقف اندازه‌گیری می‌شود.` 
                : `Accelerate above ${brakeTargetSpeed} km/h, then stomp brake pedal firmly to record stopping distance and deceleration.`}
            </p>

            {/* Status Banner */}
            <div className="mb-6">
              {brakeStatus === 'idle' && (
                <span className="px-5 py-2 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-orbitron font-extrabold text-sm sm:text-base">
                  {isRtl ? `سرعت را به بالای ${brakeTargetSpeed} برسانید (${Math.round(currentSpeed)} km/h)` : `REACH ${brakeTargetSpeed}+ KM/H (${Math.round(currentSpeed)} km/h)`}
                </span>
              )}
              {brakeStatus === 'ready' && (
                <span className="px-5 py-2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500 font-orbitron font-extrabold text-sm sm:text-base animate-pulse">
                  {t.brakingArmed}
                </span>
              )}
              {brakeStatus === 'braking' && (
                <span className="px-5 py-2 rounded-full bg-rose-600 text-white border border-rose-400 font-orbitron font-extrabold text-sm sm:text-base animate-ping">
                  {t.brakingInProgress}
                </span>
              )}
              {brakeStatus === 'finished' && (
                <span className="px-5 py-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500 font-orbitron font-extrabold text-sm sm:text-base">
                  {t.brakingFinished}
                </span>
              )}
            </div>

            {/* Stopping Distance & Time Dual Readouts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mb-6">
              {/* Distance */}
              <div className="bg-slate-950/80 p-5 rounded-2xl border border-rose-900/50 flex flex-col items-center">
                <span className="text-xs text-rose-400 font-bold uppercase mb-1">
                  {t.brakingDistance}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl sm:text-6xl font-orbitron font-black text-white">
                    {brakeDistance.toFixed(1)}
                  </span>
                  <span className="text-lg font-bold text-rose-400">m</span>
                </div>
              </div>

              {/* Time & Decel */}
              <div className="bg-slate-950/80 p-5 rounded-2xl border border-rose-900/50 flex flex-col items-center justify-between">
                <span className="text-xs text-slate-400 font-bold uppercase mb-1">
                  {t.brakingTime} & {t.brakingDecel}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl sm:text-6xl font-orbitron font-black text-rose-300">
                    {brakeTime.toFixed(2)}
                  </span>
                  <span className="text-lg font-bold text-slate-400">s</span>
                </div>
                <div className="mt-2 text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>Max Decel: {maxDecelG > 0 ? `-${maxDecelG} G` : '---'}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons & Best Record Badge */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleResetBrake}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-bold border border-slate-700 transition"
              >
                <RotateCcw className="w-4 h-4" />
                {t.resetTimer}
              </button>

              {bestBrakingDist !== null && (
                <div className="flex items-center gap-2 px-4 py-2 bg-rose-950/60 border border-rose-600/60 rounded-xl text-rose-300">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold">{t.brakingBest}:</span>
                  <span className="font-orbitron font-extrabold text-sm">{bestBrakingDist.toFixed(1)}m</span>
                </div>
              )}
            </div>

          </div>

          {/* Braking History Log */}
          {brakeHistory.length > 0 && (
            <div className="bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Disc className="w-4 h-4 text-rose-400" />
                  <span>{isRtl ? 'تاریخچه رکوردهای تست ترمز' : 'Braking Test History Log'}</span>
                </div>
                <button
                  onClick={handleClearBrakeHistory}
                  className="flex items-center gap-1 text-slate-400 hover:text-red-400 text-xs transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'پاک کردن لاگ' : 'Clear Log'}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="p-2.5 text-center">{isRtl ? 'تست' : 'Test'}</th>
                      <th className="p-2.5 text-center">{isRtl ? 'مسافت توقف' : 'Distance'}</th>
                      <th className="p-2.5 text-center">{isRtl ? 'مدت زمان' : 'Time'}</th>
                      <th className="p-2.5 text-center">{isRtl ? 'حداکثر G' : 'Max G'}</th>
                      <th className="p-2.5 text-center">{isRtl ? 'ساعت' : 'Time Recorded'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {brakeHistory.map((run, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="p-2.5 text-center text-rose-400 font-bold">{run.startSpeed} → 0</td>
                        <td className="p-2.5 text-center font-bold text-white">{run.distanceMeters} m</td>
                        <td className="p-2.5 text-center text-cyan-300">{run.timeSeconds} s</td>
                        <td className="p-2.5 text-center text-amber-400">-{run.maxDecelG} G</td>
                        <td className="p-2.5 text-center text-slate-400">{run.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vehicle Reference Card */}
      <div className="bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">
            {isRtl ? 'پروتکل ارتباطی' : 'Protocol'}
          </span>
          <span className="font-bold text-white text-sm">
            {vehicle.protocol}
          </span>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">
            {isRtl ? 'مشخصات پیشرانه' : 'Powertrain Spec'}
          </span>
          <span className="font-bold text-cyan-300 text-sm">
            {vehicle.engine}
          </span>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">
            {isRtl ? 'ردلاین دور موتور' : 'Redline Shift RPM'}
          </span>
          <span className="font-orbitron font-bold text-red-400 text-sm">
            {vehicle.redlineRpm} RPM
          </span>
        </div>
      </div>

    </div>
  );
};
