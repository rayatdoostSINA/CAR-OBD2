import React, { useState } from 'react';
import { UserPreferences, VehicleProfile, ThemeColor, DetectedVehicleInfo } from '../../types';
import { getTranslation } from '../../i18n/translations';
import vehiclesJson from '../../database/vehicles.json';
import { 
  Bell, 
  Volume2, 
  VolumeX, 
  Palette, 
  Globe, 
  ShieldCheck, 
  Car, 
  Check, 
  Plus
} from 'lucide-react';

interface Props {
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => void;
  selectedVehicle: VehicleProfile;
  onSelectVehicle: (vehicle: VehicleProfile) => void;
  detectedInfo?: DetectedVehicleInfo | null;
}

export const SettingsView: React.FC<Props> = ({
  preferences,
  onUpdatePreferences,
  selectedVehicle,
  onSelectVehicle,
  detectedInfo
}) => {
  const t = getTranslation(preferences.language);
  const isRtl = preferences.language === 'fa';

  const defaultVehicles = vehiclesJson as VehicleProfile[];
  const [customVehicles, setCustomVehicles] = useState<VehicleProfile[]>(() => {
    try {
      const saved = localStorage.getItem('multigauge_custom_vehicles');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    manufacturer: '',
    persianManufacturer: '',
    model: '',
    persianModel: '',
    engine: '',
    redlineRpm: 6500,
    fuelTankCapacity: 60,
    isTurbocharged: true,
    normalEctMin: 85,
    normalEctMax: 98
  });

  const allAvailableVehicles = [...defaultVehicles, ...customVehicles];

  const handleCreateCustomVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.model) return;

    const customProfile: VehicleProfile = {
      id: `custom_${Date.now()}`,
      manufacturer: newVehicle.manufacturer || 'Custom',
      persianManufacturer: newVehicle.persianManufacturer || newVehicle.manufacturer || 'سفارشی',
      model: newVehicle.model,
      persianModel: newVehicle.persianModel || newVehicle.model,
      year: 'Custom',
      engine: newVehicle.engine || 'Multi-Cylinder OBD-II',
      ecu: 'Standard OBD-II / CAN',
      protocol: 'ISO 15765-4 (CAN 11/500)',
      fuelTankCapacity: Number(newVehicle.fuelTankCapacity) || 60,
      redlineRpm: Number(newVehicle.redlineRpm) || 6200,
      normalEctRange: [Number(newVehicle.normalEctMin) || 85, Number(newVehicle.normalEctMax) || 98],
      gearRatios: [3.5, 2.0, 1.4, 1.0, 0.75, 0.6],
      reverseRatio: 3.2,
      finalDriveRatio: 4.1,
      isTurbocharged: newVehicle.isTurbocharged,
      supportedPID: ["010C", "010D", "0105", "0104", "0111", "010F", "010B", "0142", "0106", "0107", "010E", "0133", "012F"],
      unsupportedPID: [],
      notes: 'پروفایل تعریف شده توسط کاربر'
    };

    const updated = [...customVehicles, customProfile];
    setCustomVehicles(updated);
    try {
      localStorage.setItem('multigauge_custom_vehicles', JSON.stringify(updated));
    } catch (err) {
      console.warn('Storage error:', err);
    }
    onSelectVehicle(customProfile);
    onUpdatePreferences({ 
      selectedVehicleId: customProfile.id,
      redlineAlert: customProfile.redlineRpm 
    });
    setIsAddModalOpen(false);
  };

  const themes: { id: ThemeColor; label: string; bg: string }[] = [
    { id: 'cyber-cyan', label: t.themeCyber, bg: 'from-cyan-500 to-blue-600' },
    { id: 'sport-red', label: t.themeSport, bg: 'from-red-600 to-rose-700' },
    { id: 'racing-amber', label: t.themeAmber, bg: 'from-amber-500 to-orange-600' },
    { id: 'lime-matrix', label: t.themeMatrix, bg: 'from-emerald-500 to-green-600' },
    { id: 'arctic-ice', label: t.themeIce, bg: 'from-sky-400 to-indigo-500' },
    { id: 'stealth-dark', label: t.themeStealth, bg: 'from-slate-700 to-zinc-900' }
  ];

  return (
    <div id="settings-container" className="w-full max-w-5xl flex flex-col p-2 sm:p-4 mx-auto space-y-6">
      
      {/* 1. Vehicle Selection & Profile Manager */}
      <div className="bg-slate-900/95 rounded-3xl p-6 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-950/80 rounded-xl border border-cyan-500/30">
              <Car className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isRtl ? 'انتخاب و کالیبراسیون خودرو (Vehicle Profiles)' : 'Vehicle Profiles & Car Calibration'}
              </h2>
              <p className="text-xs text-slate-400">
                {isRtl ? 'پروفایل پیش‌فرض خودروی خود را برای تنظیم دقیق ردلاین، بوست، باک سوخت و نسبت دنده‌ها انتخاب کنید:' : 'Select or customize vehicle calibration for redline, boost pressure, fuel tank, and gear ratios:'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span>{isRtl ? 'تعریف خودروی جدید' : 'Add Custom Vehicle'}</span>
          </button>
        </div>

        {/* Vehicle Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {allAvailableVehicles.map((veh) => {
            const isSelected = selectedVehicle.id === veh.id;
            return (
              <button
                key={veh.id}
                onClick={() => {
                  onSelectVehicle(veh);
                  onUpdatePreferences({ 
                    selectedVehicleId: veh.id,
                    redlineAlert: veh.redlineRpm 
                  });
                }}
                className={`text-right p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-gradient-to-br from-cyan-950/90 to-slate-900 border-cyan-500 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500' 
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-cyan-400 px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-800/50">
                      {isRtl ? veh.persianManufacturer : veh.manufacturer}
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/50">
                        <Check className="w-3.5 h-3.5" />
                        {isRtl ? 'فعال' : 'Active'}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-white text-sm mb-1 line-clamp-1">
                    {isRtl ? veh.persianModel : veh.model}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-1 mb-3">
                    {veh.engine}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
                  <div className="bg-slate-900 p-1.5 rounded-lg text-center">
                    <span className="block text-slate-500 text-[9px]">Redline</span>
                    <span className="font-bold text-red-400">{veh.redlineRpm}</span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded-lg text-center">
                    <span className="block text-slate-500 text-[9px]">Fuel</span>
                    <span className="font-bold text-amber-400">{veh.fuelTankCapacity}L</span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded-lg text-center">
                    <span className="block text-slate-500 text-[9px]">Turbo</span>
                    <span className={`font-bold ${veh.isTurbocharged ? 'text-cyan-400' : 'text-slate-500'}`}>
                      {veh.isTurbocharged ? 'YES' : 'N/A'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Custom Vehicle Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">
                  {isRtl ? 'تعریف خودرو و پیشرانه جدید' : 'Create Custom Vehicle Profile'}
                </h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomVehicle} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    {isRtl ? 'نام کارخانه / برند (مثال: Toyota, Peugeot)' : 'Brand / Manufacturer'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Toyota / Chery / IKCO"
                    value={newVehicle.manufacturer}
                    onChange={e => setNewVehicle(p => ({ ...p, manufacturer: e.target.value, persianManufacturer: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    {isRtl ? 'مدل خودرو (مثال: Camry, Tiggo 8, 207)' : 'Model Name'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Camry / 207 / Tiggo"
                    value={newVehicle.model}
                    onChange={e => setNewVehicle(p => ({ ...p, model: e.target.value, persianModel: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-bold">
                  {isRtl ? 'مشخصات پیشرانه (مثال: 2.0L Turbo / TU5 / EF7)' : 'Engine Specification'}
                </label>
                <input
                  type="text"
                  placeholder="2.0T 4-Cyl GDI"
                  value={newVehicle.engine}
                  onChange={e => setNewVehicle(p => ({ ...p, engine: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    {isRtl ? 'ردلاین موتور (RPM)' : 'Redline RPM'}
                  </label>
                  <input
                    type="number"
                    min="4000"
                    max="9000"
                    step="100"
                    value={newVehicle.redlineRpm}
                    onChange={e => setNewVehicle(p => ({ ...p, redlineRpm: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    {isRtl ? 'ظرفیت باک (لیتر)' : 'Fuel Tank (L)'}
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="150"
                    value={newVehicle.fuelTankCapacity}
                    onChange={e => setNewVehicle(p => ({ ...p, fuelTankCapacity: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 col-span-2 sm:col-span-1 pt-4">
                  <input
                    type="checkbox"
                    id="isTurbo"
                    checked={newVehicle.isTurbocharged}
                    onChange={e => setNewVehicle(p => ({ ...p, isTurbocharged: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500 rounded"
                  />
                  <label htmlFor="isTurbo" className="text-slate-300 font-bold cursor-pointer">
                    {isRtl ? 'موتور توربوشارژ' : 'Turbocharged'}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold"
                >
                  {isRtl ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg"
                >
                  {isRtl ? 'ذخیره و فعال‌سازی' : 'Save & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Live Auto-Detected Vehicle Status Card & Universal Engine */}
      <div className="bg-gradient-to-r from-cyan-950/70 via-slate-900 to-slate-900 rounded-3xl p-6 border border-cyan-500/40 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">
              {isRtl ? 'موتور پروتکل جهانی OBD-II و استعلام زنده ECU' : 'Universal OBD-II Engine & Live ECU Telemetry'}
            </h2>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 border border-emerald-500 text-emerald-300">
            {isRtl ? 'پروتکل جهانی استاندارد (SAE J1979)' : 'Universal Standard (SAE J1979)'}
          </span>
        </div>
        
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          {isRtl 
            ? 'نرم‌افزار با تمامی خودروهای استاندارد مجهز به درگاه OBD-II سازگار است. سنسورهای فعال خودرو پس از اتصال به صورت خودکار کوئری شده و پارامترها با پروفایل کالیبراسیون انتخابی شما هماهنگ می‌گردند.'
            : 'The software is compatible with all standard OBD-II vehicles worldwide. Active sensors are queried dynamically and calibrated with your selected profile.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-950/80 rounded-2xl border border-cyan-800/40 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] mb-0.5">{isRtl ? 'شماره شاسی (VIN)' : 'VIN Number'}</span>
            <span className="font-mono font-bold text-cyan-300 text-sm">
              {detectedInfo?.vin || selectedVehicle.vin || (isRtl ? 'در انتظار اتصال...' : 'Waiting for connection...')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] mb-0.5">{isRtl ? 'پروتکل ارتباطی ECU' : 'ECU Protocol'}</span>
            <span className="font-bold text-slate-200 text-sm">
              {detectedInfo?.protocol || 'ISO 15765-4 (CAN 11/500)'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] mb-0.5">{isRtl ? 'سنسورهای فعال شناسایی‌شده' : 'Active Sensor PIDs'}</span>
            <span className="font-bold text-emerald-400 text-sm">
              {detectedInfo?.detectedSupportedPIDs?.length 
                ? (isRtl ? `${detectedInfo.detectedSupportedPIDs.length} پارامتر فعال` : `${detectedInfo.detectedSupportedPIDs.length} Active PIDs`)
                : (isRtl ? 'تشخیص خودکار پس از اتصال' : 'Auto-polled upon connection')}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] mb-0.5">{isRtl ? 'پروفایل فعال' : 'Active Profile'}</span>
            <span className="font-bold text-cyan-400 text-sm">
              {isRtl ? selectedVehicle.persianModel : selectedVehicle.model}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Audio & Warning Alarm Thresholds */}
      <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-6 h-6 text-amber-400" />
          <h2 className="text-lg font-bold text-white">
            {isRtl ? 'حدود آلارم و هشدارهای رانندگی' : 'Alert & Safety Thresholds'}
          </h2>
        </div>

        {/* Sound toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            {preferences.soundAlerts ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
            <div>
              <div className="font-bold text-white text-sm">{t.soundAlerts}</div>
              <div className="text-xs text-slate-400">
                {isRtl ? 'پخش بوق اخطار در زمان دمای بالای آب، ردلاین دور موتور یا افت ولتاژ دینام' : 'Beep alarm on overheat, redline, or low battery voltage'}
              </div>
            </div>
          </div>
          <button
            onClick={() => onUpdatePreferences({ soundAlerts: !preferences.soundAlerts })}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${preferences.soundAlerts ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            {preferences.soundAlerts ? (isRtl ? 'فعال' : 'ON') : (isRtl ? 'غیرفعال' : 'OFF')}
          </button>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* High Temp Threshold */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <label className="text-xs font-bold text-slate-300 block mb-1">
              {t.highEctThreshold}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="90"
                max="125"
                value={preferences.highEctAlert}
                onChange={(e) => onUpdatePreferences({ highEctAlert: Number(e.target.value) })}
                className="flex-1 accent-red-500"
              />
              <span className="font-orbitron font-bold text-red-400 text-base">
                {preferences.highEctAlert}°C
              </span>
            </div>
          </div>

          {/* Redline RPM */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <label className="text-xs font-bold text-slate-300 block mb-1">
              {t.shiftAlertRpm}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="4500"
                max="8500"
                step="100"
                value={preferences.redlineAlert}
                onChange={(e) => onUpdatePreferences({ redlineAlert: Number(e.target.value) })}
                className="flex-1 accent-red-500"
              />
              <span className="font-orbitron font-bold text-red-400 text-base">
                {preferences.redlineAlert} RPM
              </span>
            </div>
          </div>

          {/* Low Voltage Threshold */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <label className="text-xs font-bold text-slate-300 block mb-1">
              {t.lowVoltThreshold}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10.8"
                max="12.5"
                step="0.1"
                value={preferences.lowVoltageAlert}
                onChange={(e) => onUpdatePreferences({ lowVoltageAlert: Number(e.target.value) })}
                className="flex-1 accent-amber-500"
              />
              <span className="font-orbitron font-bold text-amber-400 text-base">
                {preferences.lowVoltageAlert.toFixed(1)}V
              </span>
            </div>
          </div>

          {/* Speed limit alert */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <label className="text-xs font-bold text-slate-300 block mb-1">
              {t.speedThreshold}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="80"
                max="180"
                step="5"
                value={preferences.speedAlert}
                onChange={(e) => onUpdatePreferences({ speedAlert: Number(e.target.value) })}
                className="flex-1 accent-cyan-500"
              />
              <span className="font-orbitron font-bold text-cyan-400 text-base">
                {preferences.speedAlert} km/h
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Theme & Language */}
      <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Language Switcher */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">{t.language}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdatePreferences({ language: 'fa' })}
                className={`p-3 rounded-xl font-bold text-sm transition ${preferences.language === 'fa' ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}
              >
                فارسی (Persian / RTL)
              </button>
              <button
                onClick={() => onUpdatePreferences({ language: 'en' })}
                className={`p-3 rounded-xl font-bold text-sm transition ${preferences.language === 'en' ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}
              >
                English (LTR)
              </button>
            </div>
          </div>

          {/* Color Themes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-5 h-5 text-fuchsia-400" />
              <h3 className="text-base font-bold text-white">{t.theme}</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((theme) => {
                const isSelected = preferences.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => onUpdatePreferences({ theme: theme.id })}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${isSelected ? 'border-white bg-slate-800' : 'border-slate-800 bg-slate-950 text-slate-400'}`}
                  >
                    <div className={`w-full h-3 rounded-full bg-gradient-to-r ${theme.bg}`} />
                    <span>{theme.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* 5. iOS & Offline Execution Guide */}
      <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 rounded-3xl p-6 border border-blue-800/40 shadow-xl text-xs text-slate-300 space-y-3">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <ShieldCheck className="w-5 h-5" />
          <span>{isRtl ? 'راهنمای کارکرد آفلاین و اتصال در آیفون (iOS)' : 'Offline & iOS Hardware Guide'}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800/80">
            <span className="font-bold text-cyan-300 block mb-1">
              {isRtl ? '۱. چرا سافاری بلوتوث را شناسایی نمی‌کند؟' : '1. Web Bluetooth on iOS Safari'}
            </span>
            <p className="leading-relaxed text-slate-300">
              {isRtl 
                ? 'شرکت اپل پروتکل Web Bluetooth را در سافاری محدود کرده است. راهکار: کافیست از اپ استور مرورگر رایگان Bluefy Browser را نصب کرده و این آدرس را داخل آن باز کنید؛ یا از دانگل وای‌فای (WiFi ELM327) استفاده نمایید.'
                : 'Safari blocks Web Bluetooth. Solution: Install "Bluefy Browser" from the App Store and load this web app, or use a WiFi OBD-II adapter.'}
            </p>
          </div>
          <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800/80">
            <span className="font-bold text-emerald-300 block mb-1">
              {isRtl ? '۲. نحوه اجرای ۱۰۰٪ آفلاین بدون اینترنت' : '2. 100% Offline Loading'}
            </span>
            <p className="leading-relaxed text-slate-300">
              {isRtl 
                ? 'پس از یک بار باز کردن کامل برنامه آنلاین، دکمه Share (مربع با فلش بالا) را زده و Add to Home Screen را لمس کنید. سپس با قطع کامل اینترنت نیز برنامه از کش پرسرعت آفلاین باز می‌شود.'
                : 'Open the app once, tap Share > Add to Home Screen. The app will cache all assets via Service Worker for offline launch.'}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
