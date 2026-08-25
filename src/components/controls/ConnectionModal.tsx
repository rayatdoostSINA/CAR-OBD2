import React, { useState } from 'react';
import { ConnectionType, UserPreferences } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { Bluetooth, Wifi, Cpu, AlertCircle, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (type: ConnectionType, wifiConfig?: { ip: string; port: number }) => Promise<void>;
  isConnecting: boolean;
  preferences: UserPreferences;
}

export const ConnectionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConnect,
  isConnecting,
  preferences
}) => {
  const t = getTranslation(preferences.language);
  const isRtl = preferences.language === 'fa';

  const [selectedType, setSelectedType] = useState<ConnectionType>('simulator');
  const [wifiIp, setWifiIp] = useState<string>('192.168.0.10');
  const [wifiPort, setWifiPort] = useState<number>(35000);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartConnection = async () => {
    setErrorMsg(null);
    try {
      if (selectedType === 'wifi') {
        await onConnect(selectedType, { ip: wifiIp, port: wifiPort });
      } else {
        await onConnect(selectedType);
      }
      onClose();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isCancelled = (err as { isCancelled?: boolean })?.isCancelled || errMsg.toLowerCase().includes('cancel');
      if (isCancelled) {
        setErrorMsg(
          isRtl 
            ? 'پنجره انتخاب دستگاه لغو شد. در صورتی که دانگل بلوتوثی روشن نیست، می‌توانید از حالت شبیه‌ساز (Simulator) استفاده فرمایید.'
            : 'Device selection cancelled. If your Bluetooth OBD adapter is not turned on, you can switch to Simulator mode.'
        );
      } else {
        setErrorMsg(errMsg || (isRtl ? 'خطا در برقراری ارتباط' : 'Failed to connect'));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              {t.connectionMethod}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRtl 
                ? 'تشخیص نوع خودرو و سنسورهای ECU پس از اتصال به‌صورت ۱۰۰٪ خودکار انجام خواهد شد' 
                : 'Vehicle profile & ECU sensors are auto-detected instantly upon connection'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg">
            ✕
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3 my-5">
          {/* Virtual Simulator */}
          <div
            onClick={() => setSelectedType('simulator')}
            className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-3.5 ${selectedType === 'simulator' ? 'bg-cyan-950/70 border-cyan-500 shadow-md' : 'bg-slate-950 hover:bg-slate-800 border-slate-800'}`}
          >
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{t.simulator}</span>
                {selectedType === 'simulator' && <Check className="w-5 h-5 text-cyan-400" />}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {isRtl ? 'شبیه‌سازی کامل پارامترهای ECU با فیزیک واقعی دور موتور، سرعت، سنسورها و خطاها بدون نیاز به خودرو واقعی.' : 'Instant virtual engine simulation with real physics, live telemetry, and DTC injection.'}
              </p>
            </div>
          </div>

          {/* Web Bluetooth BLE ELM327 */}
          <div
            onClick={() => setSelectedType('bluetooth')}
            className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-3.5 ${selectedType === 'bluetooth' ? 'bg-cyan-950/70 border-cyan-500 shadow-md' : 'bg-slate-950 hover:bg-slate-800 border-slate-800'}`}
          >
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
              <Bluetooth className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{t.bluetooth}</span>
                {selectedType === 'bluetooth' && <Check className="w-5 h-5 text-cyan-400" />}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {isRtl ? 'اتصال مستقیم مرورگر به دانگل‌های بلوتوثی BLE ELM327 (v1.5 / v2.1).' : 'Direct browser pairing via Web Bluetooth GATT service with standard ELM327 BLE adapters.'}
              </p>

              {/* iOS Safari Notice */}
              <div className="mt-2.5 p-2 bg-blue-950/60 border border-blue-800/50 rounded-xl text-[11px] text-blue-300">
                <span className="font-bold block text-blue-200 mb-0.5">
                  {isRtl ? '📱 راهنمای کاربران آیفون (iOS / Safari):' : '📱 iOS / iPhone Users Notice:'}
                </span>
                {isRtl 
                  ? 'سافاری اپل به‌صورت پیش‌فرض Web Bluetooth را مسدود کرده است. برای اتصال بلوتوثی در آیفون کافیست این آدرس را داخل مرورگر رایگان Bluefy (از اپ‌استور) باز کنید، یا از دانگل وای‌فای (WiFi OBD) استفاده نمایید.'
                  : 'Apple Safari blocks Web Bluetooth. To connect via Bluetooth on iOS, open this web app inside "Bluefy Browser" from App Store, or use a WiFi OBD-II adapter.'}
              </div>
            </div>
          </div>

          {/* WiFi OBD Adapter */}
          <div
            onClick={() => setSelectedType('wifi')}
            className={`p-4 rounded-2xl border cursor-pointer transition flex items-start gap-3.5 ${selectedType === 'wifi' ? 'bg-cyan-950/70 border-cyan-500 shadow-md' : 'bg-slate-950 hover:bg-slate-800 border-slate-800'}`}
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <Wifi className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{t.wifi}</span>
                {selectedType === 'wifi' && <Check className="w-5 h-5 text-cyan-400" />}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {isRtl ? 'اتصال به دانگل‌های وای‌فای OBD با آدرس IP و پورت اختصاصی.' : 'Connect to WiFi OBD dongle using WebSocket / TCP gateway socket.'}
              </p>
              
              {selectedType === 'wifi' && (
                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">IP Address</label>
                    <input
                      type="text"
                      value={wifiIp}
                      onChange={(e) => setWifiIp(e.target.value)}
                      className="w-full bg-black/60 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Port</label>
                    <input
                      type="number"
                      value={wifiPort}
                      onChange={(e) => setWifiPort(Number(e.target.value))}
                      className="w-full bg-black/60 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-red-300 text-xs mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleStartConnection}
            disabled={isConnecting}
            className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-cyan-900/40 transition flex items-center gap-2"
          >
            {isConnecting ? t.connecting : t.connectBtn}
          </button>
        </div>

      </div>
    </div>
  );
};
