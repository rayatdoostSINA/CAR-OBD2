import { DiagnosticProtocol } from './DiagnosticProtocol';
import { PIDDefinition, TelemetryValue, TripStats, PIDEngineListener } from '../types';
import standardPidsJson from '../database/standard_pid.json';

export type { PIDEngineListener };

export class PIDEngine {
  private protocol: DiagnosticProtocol;
  private pids: Map<string, PIDDefinition> = new Map();
  private telemetryState: Record<string, TelemetryValue> = {};
  private listeners: PIDEngineListener[] = [];
  private isPolling: boolean = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private highIndex: number = 0;
  private medIndex: number = 0;
  private lowIndex: number = 0;
  private tickCounter: number = 0;
  private lastTickTime: number = performance.now();

  // Active Vehicle Supported PID Filter
  private vehicleSupportedPids: Set<string> = new Set();
  private vehicleUnsupportedPids: Set<string> = new Set();

  // Peak trackers
  private minPeaks: Record<string, number> = {};
  private maxPeaks: Record<string, number> = {};

  // Trip tracking
  private tripStats: TripStats = {
    distanceKm: 0,
    durationSeconds: 0,
    maxSpeed: 0,
    avgSpeed: 0,
    maxRpm: 0,
    maxEct: 0,
    fuelConsumedLiters: 0,
    startTimestamp: Date.now()
  };
  private speedSamples: number[] = [];

  // 0-100 Acceleration timer
  private accelIsArmed: boolean = true;
  private accelIsRunning: boolean = false;
  private accelStartTime: number = 0;
  private accelElapsedTime: number = 0;
  private accelBestTime: number | null = null;
  private accelDataPoints: { time: number; speed: number; rpm: number }[] = [];

  // Audio synthesizer for alerts
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private lastAlertTimes: Record<string, number> = {};

  constructor(protocol: DiagnosticProtocol) {
    this.protocol = protocol;
    this.loadPids();
  }

  public setProtocol(protocol: DiagnosticProtocol): void {
    this.protocol = protocol;
  }

  private loadPids(): void {
    const list = standardPidsJson as PIDDefinition[];
    for (const pid of list) {
      this.pids.set(pid.id, pid);
      this.telemetryState[pid.id] = {
        value: null,
        displayValue: '---',
        unit: pid.unit,
        rawHex: '',
        timestamp: Date.now(),
        isSupported: true,
        status: 'normal',
        minPeak: null,
        maxPeak: null
      };
    }
  }

  public setVehicleProfile(supported: string[], unsupported: string[]): void {
    this.vehicleSupportedPids = new Set(supported);
    this.vehicleUnsupportedPids = new Set(unsupported);

    // Immediately mark unsupported PIDs
    for (const [pidId, def] of this.pids.entries()) {
      if (this.vehicleUnsupportedPids.has(pidId) || (this.vehicleSupportedPids.size > 0 && !this.vehicleSupportedPids.has(pidId))) {
        this.telemetryState[pidId] = {
          value: null,
          displayValue: 'Not Supported',
          unit: def.unit,
          rawHex: '',
          timestamp: Date.now(),
          isSupported: false,
          status: 'unsupported',
          minPeak: null,
          maxPeak: null
        };
      }
    }
    this.notifyTelemetry();
  }

  public addListener(listener: PIDEngineListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public startPolling(): void {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollLoop();
  }

  public stopPolling(): void {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollLoop(): Promise<void> {
    if (!this.isPolling) return;

    try {
      this.tickCounter++;
      
      // Categorize PIDs by priority and vehicle support
      const isPidSupported = (pId: string) => !this.vehicleUnsupportedPids.has(pId) && (this.vehicleSupportedPids.size === 0 || this.vehicleSupportedPids.has(pId));
      const highPids = Array.from(this.pids.values()).filter(p => p.pollingPriority === 'high' && isPidSupported(p.id));
      const medPids = Array.from(this.pids.values()).filter(p => p.pollingPriority === 'medium' && isPidSupported(p.id));
      const lowPids = Array.from(this.pids.values()).filter(p => p.pollingPriority === 'low' && isPidSupported(p.id));

      // Always query 1-2 High Priority PIDs every tick
      if (highPids.length > 0) {
        const p1 = highPids[this.highIndex % highPids.length];
        this.highIndex++;
        await this.queryAndProcessPid(p1);
      }

      // Query Medium Priority PID every 3 ticks
      if (this.tickCounter % 3 === 0 && medPids.length > 0) {
        const p2 = medPids[this.medIndex % medPids.length];
        this.medIndex++;
        await this.queryAndProcessPid(p2);
      }

      // Query Low Priority PID every 12 ticks
      if (this.tickCounter % 12 === 0 && lowPids.length > 0) {
        const p3 = lowPids[this.lowIndex % lowPids.length];
        this.lowIndex++;
        await this.queryAndProcessPid(p3);
      }

      this.updateTripAndMetrics();
    } catch (err) {
      console.warn('Poll tick error:', err);
    }

    if (this.isPolling) {
      // Loop with adaptive speed (~40-60ms between queries)
      this.pollTimer = setTimeout(() => this.pollLoop(), 45);
    }
  }

  private async queryAndProcessPid(pidDef: PIDDefinition): Promise<void> {
    const result = await this.protocol.readPid(pidDef);
    
    if (result.value !== null) {
      // Update peaks
      if (this.minPeaks[pidDef.id] === undefined || result.value < this.minPeaks[pidDef.id]) {
        this.minPeaks[pidDef.id] = result.value;
      }
      if (this.maxPeaks[pidDef.id] === undefined || result.value > this.maxPeaks[pidDef.id]) {
        this.maxPeaks[pidDef.id] = result.value;
      }

      result.minPeak = this.minPeaks[pidDef.id];
      result.maxPeak = this.maxPeaks[pidDef.id];

      // Check alerts
      this.checkAlarms(pidDef, result.value);
    }

    this.telemetryState[pidDef.id] = result;
    this.notifyTelemetry();
  }

  private checkAlarms(pidDef: PIDDefinition, value: number): void {
    const now = Date.now();

    // Redline shift alert
    if (pidDef.id === '010C' && value >= (pidDef.criticalThreshold || 6500)) {
      if (!this.lastAlertTimes['redline'] || now - this.lastAlertTimes['redline'] > 1200) {
        this.lastAlertTimes['redline'] = now;
        this.playBeep(880, 0.15, 'sawtooth');
        this.notifyAlert('redline', value, 'SHIFT NOW / REDLINE');
      }
    }

    // Overheating ECT alert (> 108°C)
    if (pidDef.id === '0105' && value >= (pidDef.criticalThreshold || 110)) {
      if (!this.lastAlertTimes['overheat'] || now - this.lastAlertTimes['overheat'] > 3000) {
        this.lastAlertTimes['overheat'] = now;
        this.playBeep(650, 0.4, 'triangle');
        this.notifyAlert('overheat', value, 'COOLANT OVERHEAT');
      }
    }

    // Low battery voltage (< 11.5V)
    if (pidDef.id === '0142' && value <= (pidDef.criticalThreshold || 11.4)) {
      if (!this.lastAlertTimes['low_voltage'] || now - this.lastAlertTimes['low_voltage'] > 5000) {
        this.lastAlertTimes['low_voltage'] = now;
        this.playBeep(440, 0.3, 'sine');
        this.notifyAlert('low_voltage', value, 'LOW BATTERY VOLTAGE');
      }
    }
  }

  private updateTripAndMetrics(): void {
    const speed = this.telemetryState['010D']?.value || 0;
    const rpm = this.telemetryState['010C']?.value || 0;
    const ect = this.telemetryState['0105']?.value || 0;

    const now = performance.now();
    const dt = Math.max(0.001, (now - this.lastTickTime) / 1000);
    this.lastTickTime = now;

    // Trip calculations
    this.speedSamples.push(speed);
    if (this.speedSamples.length > 500) this.speedSamples.shift();

    const sum = this.speedSamples.reduce((a, b) => a + b, 0);
    this.tripStats.avgSpeed = Math.round(sum / (this.speedSamples.length || 1));
    this.tripStats.maxSpeed = Math.max(this.tripStats.maxSpeed, speed);
    this.tripStats.maxRpm = Math.max(this.tripStats.maxRpm, rpm);
    this.tripStats.maxEct = Math.max(this.tripStats.maxEct, ect);
    this.tripStats.durationSeconds = Math.round((Date.now() - this.tripStats.startTimestamp) / 1000);
    
    // Distance = speed (km/h) * dt (h)
    this.tripStats.distanceKm += (speed / 3600) * dt;

    // --- 1. Dynamic Smart Gear Estimation (1-6, P, N, R) ---
    let estimatedGear = 'P';
    let gearNum = 0;
    if (speed < 2) {
      estimatedGear = rpm > 400 ? 'P / N' : 'P';
      gearNum = 0;
    } else if (rpm > 500 && speed >= 2) {
      // RPM to Speed ratio
      const ratio = rpm / speed;
      // Max Motor Kalut / Standard 6AT gear ratio thresholds
      if (ratio > 88) {
        estimatedGear = '1';
        gearNum = 1;
      } else if (ratio > 54) {
        estimatedGear = '2';
        gearNum = 2;
      } else if (ratio > 38) {
        estimatedGear = '3';
        gearNum = 3;
      } else if (ratio > 27) {
        estimatedGear = '4';
        gearNum = 4;
      } else if (ratio > 20.5) {
        estimatedGear = '5';
        gearNum = 5;
      } else {
        estimatedGear = '6';
        gearNum = 6;
      }
    }

    const gearTelemetry: TelemetryValue = {
      value: gearNum,
      displayValue: estimatedGear,
      unit: 'Gear',
      rawHex: gearNum.toString(16),
      timestamp: Date.now(),
      isSupported: true,
      status: 'normal',
      minPeak: 1,
      maxPeak: 6
    };
    this.telemetryState['GEAR'] = gearTelemetry;
    this.telemetryState['CURRENT_GEAR'] = gearTelemetry;

    // --- 2. Radiator Cooling Fan Status ---
    let fanStatus: 'OFF' | 'LOW' | 'HIGH' = 'OFF';
    let fanDisplay = 'خاموش (OFF)';
    let fanVal = 0;
    if (ect >= 102) {
      fanStatus = 'HIGH';
      fanDisplay = 'دور تند (HIGH)';
      fanVal = 2;
    } else if (ect >= 96) {
      fanStatus = 'LOW';
      fanDisplay = 'دور کند (LOW)';
      fanVal = 1;
    }

    this.telemetryState['FAN_STATUS'] = {
      value: fanVal,
      displayValue: fanDisplay,
      unit: 'FAN',
      rawHex: fanVal.toString(),
      timestamp: Date.now(),
      isSupported: true,
      status: fanStatus === 'HIGH' ? 'warning' : 'normal',
      minPeak: 0,
      maxPeak: 2
    };

    // --- 3. Turbo Boost Pressure (MAP - BARO) ---
    const mapVal = this.telemetryState['010B']?.value;
    const baroVal = this.telemetryState['0133']?.value || 100;
    if (mapVal !== null && mapVal !== undefined) {
      const boostKpa = Math.max(0, mapVal - baroVal);
      const boostBar = Number((boostKpa / 100).toFixed(2));
      const boostPsi = Number((boostKpa * 0.145038).toFixed(1));
      const boostTelemetry: TelemetryValue = {
        value: boostBar,
        displayValue: `${boostBar} bar (${boostPsi} psi)`,
        unit: 'bar',
        rawHex: '',
        timestamp: Date.now(),
        isSupported: true,
        status: boostBar > 1.4 ? 'warning' : 'normal',
        minPeak: 0,
        maxPeak: boostBar
      };
      this.telemetryState['BOOST'] = boostTelemetry;
      this.telemetryState['TURBO_BOOST_BAR'] = boostTelemetry;
    }

    // --- 4. Estimated Output Torque & Horsepower ---
    const loadVal = this.telemetryState['0104']?.value || 0;
    if (rpm > 0) {
      // 4K22D4T reference: 320 Nm max torque, 215 hp max power
      const estTorque = Math.round((loadVal / 100) * 320);
      const estHp = Math.round((estTorque * rpm) / 7127); // (Torque Nm * RPM) / 7127 = HP
      this.telemetryState['CALC_TORQUE'] = {
        value: estTorque,
        displayValue: `${estTorque} N·m`,
        unit: 'N·m',
        rawHex: '',
        timestamp: Date.now(),
        isSupported: true,
        status: 'normal',
        minPeak: 0,
        maxPeak: 320
      };
      this.telemetryState['CALC_HP'] = {
        value: estHp,
        displayValue: `${estHp} hp`,
        unit: 'hp',
        rawHex: '',
        timestamp: Date.now(),
        isSupported: true,
        status: 'normal',
        minPeak: 0,
        maxPeak: 215
      };
    }

    // --- 5. Fuel Consumption (L/h and L/100km) ---
    let mafVal = this.telemetryState['0110']?.value;
    if (mafVal === null || mafVal === undefined) {
      if (rpm > 0) {
        const load = (loadVal || 20) / 100;
        mafVal = Number(((rpm * 2.0 * load * 1.18) / 120).toFixed(2));
      } else {
        mafVal = 0;
      }
    }

    const fuelRateLph = rpm > 0 ? Number((mafVal * 0.3309).toFixed(2)) : 0;
    let instantL100km = 0;
    let instantDisplay = '0.0 L/100km';
    if (speed > 5) {
      instantL100km = Number(((fuelRateLph / speed) * 100).toFixed(1));
      instantDisplay = `${instantL100km} L/100km`;
    } else if (rpm > 0) {
      instantL100km = 0;
      instantDisplay = `${fuelRateLph} L/h`;
    }

    this.tripStats.fuelConsumedLiters += (fuelRateLph / 3600) * dt;
    const avgL100km = this.tripStats.distanceKm > 0.1 
      ? Number(((this.tripStats.fuelConsumedLiters / this.tripStats.distanceKm) * 100).toFixed(1))
      : 8.5;

    this.telemetryState['FUEL_L100KM'] = {
      value: speed > 5 ? instantL100km : fuelRateLph,
      displayValue: instantDisplay,
      unit: speed > 5 ? 'L/100km' : 'L/h',
      rawHex: '',
      timestamp: Date.now(),
      isSupported: true,
      status: (instantL100km > 18 && speed > 5) ? 'warning' : 'normal',
      minPeak: 0,
      maxPeak: 30
    };

    this.telemetryState['FUEL_RATE_LPH'] = {
      value: fuelRateLph,
      displayValue: `${fuelRateLph} L/h`,
      unit: 'L/h',
      rawHex: '',
      timestamp: Date.now(),
      isSupported: true,
      status: 'normal',
      minPeak: 0,
      maxPeak: 45
    };

    this.telemetryState['AVG_FUEL_L100KM'] = {
      value: avgL100km,
      displayValue: `${avgL100km} L/100km`,
      unit: 'L/100km',
      rawHex: '',
      timestamp: Date.now(),
      isSupported: true,
      status: 'normal',
      minPeak: 0,
      maxPeak: 25
    };

    this.notifyTelemetry();

    for (const listener of this.listeners) {
      if (listener.onTripUpdate) listener.onTripUpdate({ ...this.tripStats });
    }

    // 0-100 Acceleration test state machine
    if (this.accelIsArmed && !this.accelIsRunning) {
      if (speed === 0) {
        // Ready at standstill
      } else if (speed > 1) {
        // Launch detected!
        this.accelIsRunning = true;
        this.accelStartTime = Date.now();
        this.accelDataPoints = [{ time: 0, speed: 0, rpm }];
      }
    } else if (this.accelIsRunning) {
      this.accelElapsedTime = (Date.now() - this.accelStartTime) / 1000;
      this.accelDataPoints.push({ time: Number(this.accelElapsedTime.toFixed(2)), speed, rpm });

      if (speed >= 100) {
        // Target reached!
        this.accelIsRunning = false;
        this.accelIsArmed = false;
        if (!this.accelBestTime || this.accelElapsedTime < this.accelBestTime) {
          this.accelBestTime = Number(this.accelElapsedTime.toFixed(2));
        }
        this.playBeep(1200, 0.5, 'sine');
      }
    }

    for (const listener of this.listeners) {
      if (listener.onAccelerationUpdate) {
        listener.onAccelerationUpdate({
          isArmed: this.accelIsArmed,
          isRunning: this.accelIsRunning,
          currentSpeed: speed,
          elapsedTime: Number(this.accelElapsedTime.toFixed(2)),
          bestTime: this.accelBestTime
        });
      }
    }
  }

  public resetAccelerationTest(): void {
    this.accelIsArmed = true;
    this.accelIsRunning = false;
    this.accelElapsedTime = 0;
    this.accelDataPoints = [];
  }

  public resetPeaks(): void {
    this.minPeaks = {};
    this.maxPeaks = {};
    for (const pidId of Object.keys(this.telemetryState)) {
      if (this.telemetryState[pidId].value !== null) {
        this.minPeaks[pidId] = this.telemetryState[pidId].value!;
        this.maxPeaks[pidId] = this.telemetryState[pidId].value!;
        this.telemetryState[pidId].minPeak = this.telemetryState[pidId].value;
        this.telemetryState[pidId].maxPeak = this.telemetryState[pidId].value;
      }
    }
    this.notifyTelemetry();
  }

  public resetTrip(): void {
    this.tripStats = {
      distanceKm: 0,
      durationSeconds: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      maxRpm: 0,
      maxEct: 0,
      fuelConsumedLiters: 0,
      startTimestamp: Date.now()
    };
    this.speedSamples = [];
  }

  public getTelemetry(): Record<string, TelemetryValue> {
    return { ...this.telemetryState };
  }

  public getPidDefinition(id: string): PIDDefinition | undefined {
    return this.pids.get(id);
  }

  public getAllPidDefinitions(): PIDDefinition[] {
    return Array.from(this.pids.values());
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  private notifyTelemetry(): void {
    for (const listener of this.listeners) {
      if (listener.onTelemetryUpdate) {
        listener.onTelemetryUpdate({ ...this.telemetryState });
      }
    }
  }

  private notifyAlert(type: 'redline' | 'overheat' | 'low_voltage' | 'speed', value: number, label: string): void {
    for (const listener of this.listeners) {
      if (listener.onAlertTriggered) {
        listener.onAlertTriggered(type, value, label);
      }
    }
  }

  private playBeep(freq: number, duration: number, type: OscillatorType = 'sine'): void {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // Audio not permitted or background
    }
  }
}
