import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  TelemetryValue, 
  UserPreferences, 
  VehicleProfile, 
  GaugeMode, 
  ConnectionType, 
  PIDEngineListener,
  DetectedVehicleInfo 
} from './types';
import vehiclesJson from './database/vehicles.json';
import { SimulatorTransport } from './obd/SimulatorTransport';
import { WebBluetoothTransport } from './obd/WebBluetoothTransport';
import { WiFiTransport } from './obd/WiFiTransport';
import { OBDAdapterDriver } from './obd/OBDAdapterDriver';
import { DiagnosticProtocol } from './obd/DiagnosticProtocol';
import { PIDEngine } from './obd/PIDEngine';

// Components
import { HeaderBar } from './components/controls/HeaderBar';
import { ConnectionModal } from './components/controls/ConnectionModal';
import { SimulatorControlPanel } from './components/controls/SimulatorControlPanel';
import { CyberHudGauge } from './components/gauges/CyberHudGauge';
import { SportClusterGauge } from './components/gauges/SportClusterGauge';
import { MatrixGridGauge } from './components/gauges/MatrixGridGauge';
import { MinimalHudGauge } from './components/gauges/MinimalHudGauge';
import { DtcDiagnosticView } from './components/diagnostics/DtcDiagnosticView';
import { AccelerationTimerView } from './components/performance/AccelerationTimerView';
import { ObdTerminalView } from './components/terminal/ObdTerminalView';
import { SettingsView } from './components/settings/SettingsView';
import { ShieldCheck, WifiOff } from 'lucide-react';

export default function App() {
  const allVehicles = vehiclesJson as VehicleProfile[];
  
  // App preferences
  const [preferences, setPreferences] = useState<UserPreferences>({
    language: 'fa',
    theme: 'cyber-cyan',
    gaugeMode: 'minimal-hud',
    speedUnit: 'km/h',
    tempUnit: '°C',
    pressureUnit: 'bar',
    speedAlert: 120,
    highEctAlert: 108,
    redlineAlert: 6200,
    lowVoltageAlert: 11.8,
    soundAlerts: true,
    selectedVehicleId: allVehicles[0].id,
    activeLayout: 'default'
  });

  // Active vehicle profile (default to universal OBD-II profile)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleProfile>(allVehicles[0]);
  const [detectedInfo, setDetectedInfo] = useState<DetectedVehicleInfo | null>(null);
  const [detectionNotice, setDetectionNotice] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // Monitor Offline/Online status for car environments
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Current view tab
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'diagnostics' | 'performance' | 'terminal' | 'settings'>('dashboard');
  const [gaugeMode, setGaugeMode] = useState<GaugeMode>('cyber-hud');

  // Connection & OBD stack
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionType, setConnectionType] = useState<ConnectionType>('bluetooth');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);

  // Engine & Simulator controls
  const [simThrottle, setSimThrottle] = useState<number>(25);
  const [simGear, setSimGear] = useState<number>(2);
  const [isEngineOn, setIsEngineOn] = useState<boolean>(true);

  // Telemetry state - clean initial static state (no movement)
  const [telemetry, setTelemetry] = useState<Record<string, TelemetryValue>>({});
  const [tripStats, setTripStats] = useState(() => ({
    distanceKm: 0,
    durationSeconds: 0,
    maxSpeed: 0,
    avgSpeed: 0,
    maxRpm: 0,
    maxEct: 0,
    fuelConsumedLiters: 0,
    startTimestamp: Date.now()
  }));
  const [accelState, setAccelState] = useState({
    isArmed: true,
    isRunning: false,
    currentSpeed: 0,
    elapsedTime: 0,
    bestTime: null as number | null
  });

  // OBD stack instances stored in state and refs for safe access
  const simulatorRef = useRef<SimulatorTransport | null>(null);
  const driverRef = useRef<OBDAdapterDriver | null>(null);
  const protocolRef = useRef<DiagnosticProtocol | null>(null);
  const pidEngineRef = useRef<PIDEngine | null>(null);

  const [driverInstance, setDriverInstance] = useState<OBDAdapterDriver | null>(null);
  const [protocolInstance, setProtocolInstance] = useState<DiagnosticProtocol | null>(null);

  // Setup theme styles
  const themeStyles = useMemo(() => {
    switch (preferences.theme) {
      case 'sport-red':
        return {
          glowColor: 'rgba(239, 68, 68, 0.4)',
          primaryColor: '#ef4444',
          accentColor: '#dc2626'
        };
      case 'racing-amber':
        return {
          glowColor: 'rgba(245, 158, 11, 0.4)',
          primaryColor: '#f59e0b',
          accentColor: '#d97706'
        };
      case 'lime-matrix':
        return {
          glowColor: 'rgba(16, 185, 129, 0.4)',
          primaryColor: '#10b981',
          accentColor: '#059669'
        };
      case 'arctic-ice':
        return {
          glowColor: 'rgba(56, 189, 248, 0.4)',
          primaryColor: '#38bdf8',
          accentColor: '#0284c7'
        };
      case 'stealth-dark':
        return {
          glowColor: 'rgba(148, 163, 184, 0.2)',
          primaryColor: '#94a3b8',
          accentColor: '#475569'
        };
      case 'cyber-cyan':
      default:
        return {
          glowColor: 'rgba(6, 182, 212, 0.4)',
          primaryColor: '#06b6d4',
          accentColor: '#3b82f6'
        };
    }
  }, [preferences.theme]);

  // Connect helper
  const handleConnect = async (type: ConnectionType, wifiConfig?: { ip: string; port: number }) => {
    setIsConnecting(true);
    try {
      if (pidEngineRef.current) {
        pidEngineRef.current.stopPolling();
      }
      if (driverRef.current) {
        await driverRef.current.getTransport().disconnect();
      }

      let transport;
      if (type === 'simulator') {
        const sim = new SimulatorTransport();
        simulatorRef.current = sim;
        transport = sim;
      } else if (type === 'bluetooth') {
        transport = new WebBluetoothTransport();
      } else {
        transport = new WiFiTransport(wifiConfig?.ip || '192.168.0.10', wifiConfig?.port || 35000);
      }

      await transport.connect();

      const driver = new OBDAdapterDriver(transport);
      driverRef.current = driver;
      setDriverInstance(driver);
      await driver.initialize();

      const protocol = new DiagnosticProtocol(driver);
      protocolRef.current = protocol;
      setProtocolInstance(protocol);

      // Automatically Detect Connected Vehicle and Supported PIDs
      let activeProfile = selectedVehicle;
      try {
        const detected = await protocol.detectVehicle(allVehicles);
        setDetectedInfo(detected);
        activeProfile = detected.matchedVehicle;
        setSelectedVehicle(activeProfile);
        
        const toastMsg = preferences.language === 'fa'
          ? `اتصال با موفقیت برقرار شد (${detected.detectedSupportedPIDs.length} پارامتر فعال ECU شناسایی گردید)`
          : `Connected successfully (${detected.detectedSupportedPIDs.length} active ECU sensors identified)`;
        setDetectionNotice(toastMsg);
        setTimeout(() => setDetectionNotice(null), 6000);
      } catch (detectErr) {
        console.warn('Auto vehicle detection error:', detectErr);
      }

      const engine = new PIDEngine(protocol);
      pidEngineRef.current = engine;
      engine.setVehicleProfile(activeProfile.supportedPID, activeProfile.unsupportedPID);
      engine.setSoundEnabled(preferences.soundAlerts);

      const listener: PIDEngineListener = {
        onTelemetryUpdate: (data) => {
          setTelemetry(data);
        },
        onTripUpdate: (stats) => {
          setTripStats(stats);
        },
        onAlertTriggered: (alertType, val, label) => {
          console.warn(`[VEHICLE ALERT] ${alertType}: ${label} (${val})`);
        },
        onAccelerationUpdate: (accel) => {
          setAccelState(accel);
        },
        onConnectionStatus: (connected) => {
          setIsConnected(connected);
        }
      };

      engine.addListener(listener);
      engine.startPolling();

      setConnectionType(type);
      setIsConnected(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isUserCancel = (err as { isCancelled?: boolean })?.isCancelled || errMsg.toLowerCase().includes('cancel');
      if (!isUserCancel) {
        console.error('Failed to initialize OBD engine:', err);
      }
      
      // Stop polling and set disconnected state - DO NOT silently fallback to a moving simulator
      if (pidEngineRef.current) {
        pidEngineRef.current.stopPolling();
      }
      setDriverInstance(null);
      setProtocolInstance(null);
      setIsConnected(false);

      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (pidEngineRef.current) {
      pidEngineRef.current.stopPolling();
    }
    if (driverRef.current) {
      try {
        await driverRef.current.getTransport().disconnect();
      } catch {}
    }
    if (simulatorRef.current) {
      try {
        await simulatorRef.current.disconnect();
      } catch {}
      simulatorRef.current = null;
    }
    setDriverInstance(null);
    setProtocolInstance(null);
    setIsConnected(false);
    // Reset telemetry values to static zero/offline
    setTelemetry({
      '010C': { pid: '010C', rawHex: '41 0C 00 00', value: 0, displayValue: '0', unit: 'RPM', isSupported: true, timestamp: Date.now() },
      '010D': { pid: '010D', rawHex: '41 0D 00', value: 0, displayValue: '0', unit: 'km/h', isSupported: true, timestamp: Date.now() }
    });
  };

  // Clean mount without fake moving simulator
  useEffect(() => {
    return () => {
      if (pidEngineRef.current) pidEngineRef.current.stopPolling();
      if (driverRef.current) driverRef.current.getTransport().disconnect();
    };
  }, []);

  // Update PIDEngine when vehicle changes
  useEffect(() => {
    if (pidEngineRef.current) {
      pidEngineRef.current.setVehicleProfile(selectedVehicle.supportedPID, selectedVehicle.unsupportedPID);
    }
  }, [selectedVehicle]);

  // Update preferences in PIDEngine
  const handleUpdatePreferences = (updated: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const next = { ...prev, ...updated };
      if (pidEngineRef.current && updated.soundAlerts !== undefined) {
        pidEngineRef.current.setSoundEnabled(updated.soundAlerts);
      }
      return next;
    });
  };

  // Simulator controls handlers
  const handleThrottleChange = (val: number) => {
    setSimThrottle(val);
    if (simulatorRef.current) {
      simulatorRef.current.setThrottle(val);
    }
  };

  const handleGearChange = (val: number) => {
    setSimGear(val);
    if (simulatorRef.current) {
      if (val === 0) {
        simulatorRef.current.setScenario('idle');
      } else {
        simulatorRef.current.setThrottle(simThrottle || 30);
      }
    }
  };

  const handleToggleEngine = () => {
    if (simulatorRef.current) {
      const running = simulatorRef.current.toggleEngine();
      setIsEngineOn(running);
    }
  };

  const handleInjectFault = (code: string) => {
    if (simulatorRef.current) {
      simulatorRef.current.injectFault(code);
    }
  };

  const isRtl = preferences.language === 'fa';

  return (
    <div 
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans ${isRtl ? 'rtl' : 'ltr'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Main Navigation Header */}
      <HeaderBar
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        gaugeMode={gaugeMode}
        onChangeGaugeMode={setGaugeMode}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
        selectedVehicle={selectedVehicle}
        isConnected={isConnected}
        isConnecting={isConnecting}
        connectionType={connectionType}
        isOffline={isOffline}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onDisconnect={handleDisconnect}
      />

      {/* Auto-Detection Notification Banner */}
      {detectionNotice && (
        <div className="w-full max-w-7xl mx-auto px-4 pt-2">
          <div className="bg-emerald-950/90 border border-emerald-500/80 rounded-2xl p-3 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg shadow-emerald-950/50 animate-in fade-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{detectionNotice}</span>
            </div>
            <button 
              onClick={() => setDetectionNotice(null)}
              className="text-emerald-400 hover:text-white px-2 py-0.5 rounded bg-emerald-900/60 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Offline Alert Indicator Banner */}
      {isOffline && (
        <div className="w-full max-w-7xl mx-auto px-4 pt-2">
          <div className="bg-amber-950/80 border border-amber-600/70 rounded-2xl p-2.5 text-amber-200 text-xs font-medium flex items-center gap-2 shadow-md">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {isRtl 
                ? 'حالت آفلاین فعال است: نرم‌افزار به صورت کاملاً مستقل و PWA در حافظه گوشی ذخیره شده و نیازی به اتصال اینترنت ندارد.' 
                : 'Offline Mode: Application is running locally cached via PWA and works seamlessly without internet.'}
            </span>
          </div>
        </div>
      )}

      {/* Disconnected Vehicle Notice */}
      {!isConnected && (
        <div className="w-full max-w-7xl mx-auto px-4 pt-2">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-slate-300 text-xs font-semibold flex flex-col sm:flex-row items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span>
                {isRtl 
                  ? 'خودرو متصل نیست (حالت آماده‌باش) — برای دریافت اطلاعات زنده و دیاگ، دانگل بلوتوثی یا وای‌فای OBD را متصل نمایید.' 
                  : 'Vehicle is not connected (Standby) — Connect your Bluetooth or WiFi OBD-II adapter to stream live telemetry.'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition shadow-md whitespace-nowrap"
              >
                {isRtl ? 'اتصال به خودرو (OBD-II)' : 'Connect OBD-II'}
              </button>
              <button
                onClick={() => handleConnect('simulator')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs border border-slate-700 transition whitespace-nowrap"
              >
                {isRtl ? 'تست با شبیه‌ساز مجازی' : 'Test Virtual Simulator'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main App Content Body */}
      <main className="flex-1 flex flex-col justify-start items-center py-2 sm:py-4 px-1 sm:px-4 max-w-7xl w-full mx-auto">
        {currentTab === 'dashboard' && (
          <>
            {gaugeMode === 'minimal-hud' && (
              <MinimalHudGauge
                telemetry={telemetry}
                preferences={preferences}
                vehicle={selectedVehicle}
                tripStats={tripStats}
              />
            )}
            {gaugeMode === 'cyber-hud' && (
              <CyberHudGauge
                telemetry={telemetry}
                preferences={preferences}
                vehicle={selectedVehicle}
                tripStats={tripStats}
                themeStyles={themeStyles}
              />
            )}
            {gaugeMode === 'sport-race' && (
              <SportClusterGauge
                telemetry={telemetry}
                preferences={preferences}
                vehicle={selectedVehicle}
                tripStats={tripStats}
                themeStyles={themeStyles}
              />
            )}
            {gaugeMode === 'matrix-grid' && (
              <MatrixGridGauge
                telemetry={telemetry}
                preferences={preferences}
                vehicle={selectedVehicle}
                onResetPeaks={() => {
                  if (pidEngineRef.current) pidEngineRef.current.resetPeaks();
                }}
              />
            )}
          </>
        )}

        {currentTab === 'diagnostics' && (
          <DtcDiagnosticView
            protocol={protocolInstance}
            preferences={preferences}
            vehicle={selectedVehicle}
            telemetry={telemetry}
            isConnected={isConnected}
          />
        )}

        {currentTab === 'performance' && (
          <AccelerationTimerView
            preferences={preferences}
            vehicle={selectedVehicle}
            accelState={accelState}
            onReset={() => {
              if (pidEngineRef.current) pidEngineRef.current.resetAccelerationTest();
            }}
          />
        )}

        {currentTab === 'terminal' && (
          <ObdTerminalView
            driver={driverInstance}
            preferences={preferences}
            isConnected={isConnected}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
            detectedInfo={detectedInfo}
          />
        )}
      </main>

      {/* Docked Car Simulator Remote Bar (active when in simulator connection mode) */}
      {connectionType === 'simulator' && (
        <SimulatorControlPanel
          preferences={preferences}
          throttle={simThrottle}
          gear={simGear}
          isEngineOn={isEngineOn}
          onThrottleChange={handleThrottleChange}
          onGearChange={handleGearChange}
          onToggleEngine={handleToggleEngine}
          onInjectFault={handleInjectFault}
        />
      )}

      {/* Connection Modal Wizard */}
      <ConnectionModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnect={handleConnect}
        isConnecting={isConnecting}
        preferences={preferences}
      />
    </div>
  );
}
