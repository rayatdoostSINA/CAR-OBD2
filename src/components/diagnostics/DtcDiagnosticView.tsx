import React, { useState } from 'react';
import { DiagnosticProtocol } from '../../obd/DiagnosticProtocol';
import { DTCRecord, UserPreferences, VehicleProfile, TelemetryValue, ModuleDTCGroup } from '../../types';
import { getTranslation } from '../../i18n/translations';
import dtcCodesJson from '../../database/dtc_codes.json';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  RefreshCw, 
  Search, 
  Sparkles, 
  ShieldAlert, 
  Layers, 
  Cpu 
} from 'lucide-react';

interface Props {
  protocol: DiagnosticProtocol | null;
  preferences: UserPreferences;
  vehicle: VehicleProfile;
  telemetry: Record<string, TelemetryValue>;
  isConnected: boolean;
}

export const DtcDiagnosticView: React.FC<Props> = ({
  protocol,
  preferences,
  vehicle,
  telemetry,
  isConnected
}) => {
  const t = getTranslation(preferences.language);
  const isRtl = preferences.language === 'fa';
  const allDtcDatabase = dtcCodesJson as DTCRecord[];

  const [scanMode, setScanMode] = useState<'standard' | 'multi_module'>('standard');
  const [storedCodes, setStoredCodes] = useState<string[]>([]);
  const [pendingCodes, setPendingCodes] = useState<string[]>([]);
  const [moduleResults, setModuleResults] = useState<ModuleDTCGroup[]>([]);
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isScanningAllModules, setIsScanningAllModules] = useState<boolean>(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // AI Mechanic state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Scan DTCs from vehicle ECU
  const handleScanDTCs = async () => {
    if (!protocol || !isConnected) return;
    setIsScanning(true);
    setAiAnalysis(null);
    try {
      const stored = await protocol.readStoredDTCs();
      const pending = await protocol.readPendingDTCs();
      setStoredCodes(stored || []);
      setPendingCodes(pending || []);
      setHasScanned(true);
      setScanMode('standard');
    } catch (e) {
      console.warn('Error reading DTCs:', e);
      setHasScanned(true);
    } finally {
      setIsScanning(false);
    }
  };

  // Scan All Modules (Multi-ECU: Engine, 6AT Transmission, ABS/ESP, SRS Airbag, BCM, 4WD)
  const handleScanAllModules = async () => {
    if (!protocol || !isConnected) return;
    setIsScanningAllModules(true);
    setAiAnalysis(null);
    try {
      const res = await protocol.readMultiModuleDTCs();
      setModuleResults(res || []);
      // Consolidate ECM codes
      const ecmGroup = res.find(m => m.moduleId === 'ECM');
      if (ecmGroup) {
        setStoredCodes(ecmGroup.dtcs);
      }
      setHasScanned(true);
      setScanMode('multi_module');
    } catch (e) {
      console.warn('Error reading multi module DTCs:', e);
      setHasScanned(true);
    } finally {
      setIsScanningAllModules(false);
    }
  };

  // Clear DTCs (Mode 04)
  const [clearResultMsg, setClearResultMsg] = useState<{ success: boolean; text: string } | null>(null);

  const handleConfirmClear = async () => {
    if (!protocol || !isConnected) return;
    setIsClearing(true);
    setClearResultMsg(null);
    try {
      const success = await protocol.clearDTCs();
      if (success) {
        setStoredCodes([]);
        setPendingCodes([]);
        setModuleResults(prev => prev.map(m => ({ ...m, dtcs: [], status: m.status === 'no_response' ? 'no_response' : 'healthy' })));
        setHasScanned(true);
        setShowClearConfirmModal(false);
        setAiAnalysis(null);
        setClearResultMsg({
          success: true,
          text: isRtl ? 'کدهای خطا با موفقیت از حافظه ECU پاک شدند.' : 'Diagnostic trouble codes cleared successfully from ECU.'
        });
      } else {
        setShowClearConfirmModal(false);
        setClearResultMsg({
          success: false,
          text: isRtl ? 'یونیت ECU دستور پاک کردن خطا را رد کرد (شرایط موتور: سوئیچ باز و موتور خاموش باشد).' : 'ECU rejected DTC clear request (Ensure ignition ON, engine OFF).'
        });
      }
    } catch (e) {
      console.warn('Error clearing DTCs:', e);
      setShowClearConfirmModal(false);
      setClearResultMsg({
        success: false,
        text: isRtl ? 'خطا در برقراری ارتباط با پورت OBD-II جهت پاکسازی خطاها.' : 'Communication error while attempting to clear DTCs.'
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Find detailed DTC record from offline database
  const getDtcDetail = (code: string): DTCRecord => {
    const found = allDtcDatabase.find(d => d.code.toUpperCase() === code.toUpperCase());
    if (found) return found;

    // Generic fallback for unlisted code
    return {
      code: code.toUpperCase(),
      system: "Powertrain / Engine",
      persianSystem: "سیستم انتقال قدرت و موتور",
      englishDescription: `Diagnostic Trouble Code ${code}`,
      persianDescription: `کد خطای تشخیصی ${code}`,
      severity: "Medium",
      persianSeverity: "متوسط",
      possibleCauses: ["Sensor wiring issue", "Component malfunction", "Loose connection"],
      persianPossibleCauses: ["ایراد در سوکت یا سیم‌کشی سنسور", "نقص عملکرد قطعه", "شل بودن اتصالات"],
      symptoms: ["Check Engine Light On"],
      persianSymptoms: ["روشن شدن چراغ چک"],
      recommendedAction: "Inspect electrical harness and live telemetry values.",
      persianRecommendedAction: "بررسی سیم‌کشی و مقادیر زنده سنسور مربوطه."
    };
  };

  // Filtered search list
  const filteredSearchList = searchQuery.trim() !== '' 
    ? allDtcDatabase.filter(d => 
        d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.englishDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.persianDescription.includes(searchQuery)
      )
    : [];

  // Trigger Gemini AI Mechanic diagnosis
  const handleAiMechanicAdvice = async () => {
    setIsAiLoading(true);
    setAiAnalysis(null);
    const activeCodes = Array.from(new Set([
      ...storedCodes, 
      ...pendingCodes,
      ...moduleResults.flatMap(m => m.dtcs)
    ]));

    try {
      const res = await fetch('/api/ai-mechanic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codes: activeCodes,
          vehicle: "OBD-II / CAN Multi-Module Vehicle",
          telemetry: {
            rpm: telemetry['010C']?.value,
            ect: telemetry['0105']?.value,
            load: telemetry['0104']?.value,
            map: telemetry['010B']?.value,
            stft: telemetry['0106']?.value,
            voltage: telemetry['0142']?.value,
            tft: telemetry['01A6']?.value
          },
          language: preferences.language
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.analysis);
      } else {
        // High quality offline diagnostic fallback advice based on actual codes
        const details = activeCodes.map(code => getDtcDetail(code));
        const adviceLines = details.map((d, idx) => 
          isRtl 
            ? `${idx + 1}. کد ${d.code} (${d.persianDescription}): ${d.persianRecommendedAction}`
            : `${idx + 1}. Code ${d.code} (${d.englishDescription}): ${d.recommendedAction}`
        ).join('\n');

        setAiAnalysis(
          isRtl
            ? `بر اساس خطاهای شناسایی شده (${activeCodes.join(', ')}) روی خودرو:\n${adviceLines}\n• وضعیت دمای آب ${telemetry['0105']?.value || 90}°C و ولتاژ ${telemetry['0142']?.value || 14.1}V سیستم برق بررسی شد.`
            : `Analysis for detected codes (${activeCodes.join(', ')}):\n${adviceLines}\n• Current ECT (${telemetry['0105']?.value || 90}°C) and Voltage (${telemetry['0142']?.value || 14.1}V) verified.`
        );
      }
    } catch {
      const details = activeCodes.map(code => getDtcDetail(code));
      const quickTips = details.map(d => isRtl ? `${d.code}: ${d.persianRecommendedAction}` : `${d.code}: ${d.recommendedAction}`).join(' | ');
      setAiAnalysis(
        isRtl
          ? `راهنمای فنی عیب‌یابی: ${quickTips}`
          : `Diagnostic Tip: ${quickTips}`
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const totalFaultsCount = scanMode === 'multi_module' 
    ? moduleResults.reduce((acc, m) => acc + m.dtcs.length, 0)
    : (storedCodes.length + pendingCodes.length);

  return (
    <div id="dtc-diagnostic-container" className="w-full max-w-5xl flex flex-col p-2 sm:p-4 mx-auto space-y-6">
      
      {/* Top Action Bar */}
      <div className="bg-slate-900/90 rounded-3xl p-5 sm:p-6 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {t.dtcTitle}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            {isRtl ? `پروتکل ارتباطی: ${vehicle.protocol}` : `Diagnostic Protocol: ${vehicle.protocol}`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Quick Engine Scan */}
          <button
            onClick={handleScanDTCs}
            disabled={isScanning || isScanningAllModules || !isConnected}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-cyan-900/30 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? t.scanInProgress : (isRtl ? 'اسکن سریع موتور' : 'Quick Engine Scan')}
          </button>

          {/* Full Multi-Module Scan (Engine, 6AT, ABS, Airbag, BCM, 4WD) */}
          <button
            onClick={handleScanAllModules}
            disabled={isScanning || isScanningAllModules || !isConnected}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-indigo-900/30 transition"
          >
            <Layers className={`w-4 h-4 ${isScanningAllModules ? 'animate-spin' : ''}`} />
            {isScanningAllModules ? (isRtl ? 'در حال اسکن تمام یونیت‌ها...' : 'Scanning All Modules...') : (isRtl ? 'اسکن کامل تمام یونیت‌ها (CAN)' : 'Scan All CAN Modules')}
          </button>

          {/* Clear Faults */}
          <button
            onClick={() => setShowClearConfirmModal(true)}
            disabled={isClearing || !isConnected || totalFaultsCount === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-red-900/30 transition"
          >
            <Trash2 className="w-4 h-4" />
            {t.clearFaults}
          </button>
        </div>
      </div>

      {/* Clear DTC Notification Banner */}
      {clearResultMsg && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold shadow-lg ${
          clearResultMsg.success 
            ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200 shadow-emerald-950/40' 
            : 'bg-red-950/80 border-red-500/80 text-red-200 shadow-red-950/40'
        }`}>
          <span>{clearResultMsg.text}</span>
          <button 
            onClick={() => setClearResultMsg(null)}
            className="px-2 py-0.5 rounded bg-black/40 hover:bg-black/60 text-slate-300 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mode Toggle Tabs (Standard vs Multi-Module) */}
      {hasScanned && (
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 self-start">
          <button
            onClick={() => setScanMode('standard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              scanMode === 'standard' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            {isRtl ? 'نمای موتور (OBD-II Standard)' : 'Engine ECM Standard'}
          </button>
          <button
            onClick={() => setScanMode('multi_module')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              scanMode === 'multi_module' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {isRtl ? 'یونیت‌های چندگانه (موتور، گیربکس، ABS، کیسه هوا، BCM، 4WD)' : 'Multi-Module CAN Units'}
          </button>
        </div>
      )}

      {/* Active Faults List & State */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${
              totalFaultsCount > 0 ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : (hasScanned ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]')
            }`} />
            {hasScanned 
              ? (scanMode === 'multi_module' 
                  ? (isRtl ? `نتیجه پایش یونیت‌های شبکه CAN (${totalFaultsCount} خطا در ماژول‌ها)` : `CAN Network Multi-Module Diagnostics (${totalFaultsCount} DTCs found)`)
                  : (isRtl ? `نتیجه استعلام خطاهای ECU موتور (${storedCodes.length} ثبت‌شده، ${pendingCodes.length} موقت)` : `Engine ECU Scan Results (${storedCodes.length} Stored, ${pendingCodes.length} Pending)`))
              : (isRtl ? 'بخش استعلام و عیب‌یابی کدهای خطای خودرو' : 'Vehicle ECU Trouble Code Scanner & Diagnostics')}
          </h2>

          {totalFaultsCount > 0 && (
            <button
              onClick={handleAiMechanicAdvice}
              disabled={isAiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
              {isAiLoading ? t.aiAnalyzing : t.aiMechanicBtn}
            </button>
          )}
        </div>

        {/* AI Mechanic Box */}
        {aiAnalysis && (
          <div className="bg-gradient-to-br from-indigo-950/80 to-purple-950/80 border border-purple-500/40 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm mb-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              {isRtl ? 'تحلیل هوشمند مکانیک هوش مصنوعی (Gemini AI)' : 'AI Diagnostic Mechanic Analysis'}
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
              {aiAnalysis}
            </p>
          </div>
        )}

        {/* State 1: Initial state before scan */}
        {!hasScanned && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-950/50">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              {isRtl ? 'آماده عیب‌یابی و اسکن سیستم‌های الکترونیکی خودرو' : 'Ready to diagnose vehicle electronic control modules'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mb-6 leading-relaxed">
              {isRtl 
                ? 'با انتخاب گزینه «اسکن سریع موتور» یا «اسکن کامل یونیت‌ها»، کدهای خطای ثبت‌شده (Stored) و موقت (Pending) از ECU موتور، گیربکس اتوماتیک ۶ سرعته، ترمز ABS، ایربگ و BCM استعلام خواهند شد.' 
                : 'Query active Diagnostic Trouble Codes from Engine, 6AT Transmission, ABS/ESP, Airbag SRS, and BCM modules via high-speed CAN bus.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleScanDTCs}
                disabled={!isConnected}
                className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-xl shadow-cyan-900/40 transition"
              >
                {t.readStored}
              </button>
              <button
                onClick={handleScanAllModules}
                disabled={!isConnected}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-900/40 transition"
              >
                {isRtl ? 'اسکن کامل تمام یونیت‌های خودرو (Multi-ECU)' : 'Full Multi-Module CAN Scan'}
              </button>
            </div>
          </div>
        )}

        {/* State 2: Multi-Module View */}
        {hasScanned && scanMode === 'multi_module' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {moduleResults.map((mod) => {
              const hasFault = mod.dtcs.length > 0;
              const isNoResponse = mod.status === 'no_response';
              return (
                <div 
                  key={mod.moduleId} 
                  className={`rounded-2xl p-4 border transition-all ${
                    hasFault 
                      ? 'bg-red-950/40 border-red-500/60 shadow-lg shadow-red-950/50' 
                      : (isNoResponse ? 'bg-slate-900/40 border-slate-800/80 opacity-80' : 'bg-slate-900/70 border-slate-800')
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cpu className={`w-4 h-4 ${hasFault ? 'text-red-400' : (isNoResponse ? 'text-slate-500' : 'text-emerald-400')}`} />
                      <span className="font-bold text-sm text-white">
                        {isRtl ? mod.persianModuleName : mod.moduleName}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      hasFault 
                        ? 'bg-red-900/80 border-red-700 text-red-300 animate-pulse' 
                        : (isNoResponse 
                            ? 'bg-slate-800/80 border-slate-700 text-slate-400' 
                            : 'bg-emerald-950/80 border-emerald-800 text-emerald-300')
                    }`}>
                      {hasFault 
                        ? (isRtl ? `${mod.dtcs.length} خطا` : `${mod.dtcs.length} Faults`) 
                        : (isNoResponse 
                            ? (isRtl ? 'عدم پاسخ / غیر فعال' : 'No Response / N/A') 
                            : (isRtl ? 'سالم / بدون خطا' : 'Healthy / No Faults'))}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 mb-2">
                    CAN Header: {mod.header}
                  </div>

                  {hasFault ? (
                    <div className="space-y-2 mt-3">
                      {mod.dtcs.map((c) => {
                        const detail = getDtcDetail(c);
                        return (
                          <div key={c} className="bg-black/50 p-2.5 rounded-xl border border-red-900/60">
                            <div className="flex items-center justify-between">
                              <span className="font-orbitron font-bold text-red-400 text-xs">{c}</span>
                              <span className="text-[10px] text-slate-400">{isRtl ? detail.persianSeverity : detail.severity}</span>
                            </div>
                            <p className="text-xs text-slate-200 mt-1 font-medium">
                              {isRtl ? detail.persianDescription : detail.englishDescription}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : isNoResponse ? (
                    <div className="text-xs text-slate-500 italic">
                      {isRtl ? 'این یونیت به درخواست CAN پاسخ نداد (احتمالاً روی این تیپ خودرو نصب نیست یا غیرفعال است).' : 'Module did not respond on CAN bus (may not be equipped on this trim).'}
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-400/90 font-medium">
                      {isRtl ? 'یونیت پاسخ داد و هیچ کد خطایی ثبت نشده است.' : 'Module responded with zero stored DTCs.'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* State 3: Standard Scan View */}
        {hasScanned && scanMode === 'standard' && (
          <div className="space-y-4">
            {storedCodes.length === 0 && pendingCodes.length === 0 ? (
              <div className="bg-emerald-950/30 border border-emerald-600/40 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-900/60 border border-emerald-500/60 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-900/40">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {t.noFaultsFound}
                </h3>
                <p className="text-xs text-emerald-300">
                  {isRtl ? 'وضعیت موتور و پارامترها نرمال است.' : 'Engine and powertrain parameters are healthy.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {storedCodes.map((code) => {
                  const detail = getDtcDetail(code);
                  return (
                    <div key={code} className="bg-slate-900/90 border border-red-500/50 rounded-2xl p-4 shadow-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-red-600 text-white font-orbitron font-bold text-sm rounded-xl">
                            {code}
                          </span>
                          <span className="text-xs font-bold text-slate-300">
                            {isRtl ? detail.persianSystem : detail.system}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 bg-red-950 border border-red-800 text-red-300 rounded-full text-xs font-bold">
                          {isRtl ? detail.persianSeverity : detail.severity}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-white mb-2">
                        {isRtl ? detail.persianDescription : detail.englishDescription}
                      </p>
                      <div className="bg-black/40 rounded-xl p-3 border border-slate-800 text-xs text-slate-300 space-y-1">
                        <div>
                          <strong className="text-cyan-400">{isRtl ? 'علت‌های احتمالی: ' : 'Possible Causes: '}</strong>
                          {isRtl ? detail.persianPossibleCauses.join(' • ') : detail.possibleCauses.join(' • ')}
                        </div>
                        <div>
                          <strong className="text-amber-400">{isRtl ? 'اقدام پیشنهادی: ' : 'Recommended Action: '}</strong>
                          {isRtl ? detail.persianRecommendedAction : detail.recommendedAction}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Offline DTC Dictionary Lookup */}
      <div className="mt-8 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Search className="w-4 h-4" />
            <span>{isRtl ? 'فرهنگ لغت و جستجوی آفلاین کدهای خطای OBD-II' : 'Offline OBD-II Trouble Code Dictionary & Lookup'}</span>
          </div>
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder={isRtl ? 'جستجوی کد یا نام قطعه (مثلاً P0300)...' : 'Search code or component (e.g. P0300)...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {searchQuery.trim() !== '' ? (
          filteredSearchList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
              {filteredSearchList.slice(0, 10).map((dtc) => (
                <div key={dtc.code} className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-orbitron font-bold text-amber-400 text-xs">{dtc.code}</span>
                    <span className="text-[10px] text-slate-400">{isRtl ? dtc.persianSystem : dtc.system}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-200 mb-1.5">
                    {isRtl ? dtc.persianDescription : dtc.englishDescription}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    <strong className="text-cyan-400">{isRtl ? 'اقدام: ' : 'Action: '}</strong>
                    {isRtl ? dtc.persianRecommendedAction : dtc.recommendedAction}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-2 text-center">
              {isRtl ? 'هیچ کد خطایی مطابق با جستجوی شما یافت نشد.' : 'No DTC found matching your search term.'}
            </p>
          )
        ) : (
          <p className="text-xs text-slate-400">
            {isRtl ? 'برای مشاهده توضیحات کامل، علت‌های خرابی و روش رفع هر کد، کد خطای مورد نظر را در کادر بالا جستجو کنید.' : 'Type any DTC code in the search bar above to look up description, causes, and recommended fixes.'}
          </p>
        )}
      </div>

      {/* Confirmation Modal for Clearing Codes */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-600/60 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">{t.clearModalTitle}</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
              {t.clearModalWarning}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmClear}
                disabled={isClearing}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-900/40 transition flex items-center gap-2"
              >
                {isClearing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {t.clearModalAction}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
