import { BaseTransport } from './Transport';

export type DrivingScenario = 'idle' | 'city' | 'highway' | 'sport' | 'overheat' | 'manual';

export class SimulatorTransport extends BaseTransport {
  // Vehicle physics state
  private isEngineRunning: boolean = true;
  private scenario: DrivingScenario = 'city';
  private throttleInput: number = 25; // 0-100%
  private brakeInput: number = 0; // 0-100%
  private currentGear: number = 2; // 1-6
  
  // Realtime physical telemetry
  private rpm: number = 850;
  private speed: number = 0;
  private ect: number = 89; // °C
  private load: number = 20; // %
  private iat: number = 34; // °C
  private mapKpa: number = 38; // kPa
  private mafGps: number = 3.5; // g/s
  private batteryVolts: number = 14.2; // V
  private stft: number = 1.5; // %
  private ltft: number = -0.8; // %
  private timingAdvance: number = 12.0; // deg
  private o2Voltage: number = 0.45; // V
  private fuelLevel: number = 68; // %
  private baroKpa: number = 98; // kPa
  private runTimeSeconds: number = 120;
  private transTemp: number = 88; // °C Transmission fluid temp
  private fuelRateLh: number = 2.4; // L/h

  
  // Inclinometer / G-Force state
  private pitch: number = 0;
  private roll: number = 0;
  private altitude: number = 1250; // meters (e.g. Tehran altitude)
  private heading: number = 180;
  private gForceX: number = 0;
  private gForceY: number = 0;

  // CAN header tracking (e.g. 7DF broadcast, 7E0 ECM, 7E1 TCM, 7E2 ABS, etc.)
  private currentCanHeader: string = '7DF';

  // Stored DTC codes in simulator (clean by default)
  private storedDTCs: string[] = [];
  private pendingDTCs: string[] = [];

  private loopInterval: number | null = null;
  private lastUpdate: number = Date.now();

  constructor() {
    super();
  }

  public async connect(): Promise<boolean> {
    this.updateStatus('connecting', 'Initializing Virtual OBD-II ECU (ELM327 v1.5)...');
    await new Promise(r => setTimeout(r, 600));
    this.updateStatus('connected', 'Connected to Virtual ELM327 Simulator');
    this.startPhysicsLoop();
    return true;
  }

  public async disconnect(): Promise<void> {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
    this.updateStatus('disconnected', 'Disconnected from simulator');
  }

  public setScenario(scenario: DrivingScenario): void {
    this.scenario = scenario;
    if (scenario === 'overheat') {
      this.ect = 114;
      if (!this.storedDTCs.includes('P0118')) {
        this.storedDTCs.push('P0118');
      }
    } else if (scenario === 'sport') {
      this.throttleInput = 85;
      this.currentGear = 3;
    } else if (scenario === 'idle') {
      this.throttleInput = 0;
      this.speed = 0;
      this.currentGear = 0;
    }
  }

  public getScenario(): DrivingScenario {
    return this.scenario;
  }

  public setThrottle(percent: number): void {
    this.throttleInput = Math.max(0, Math.min(100, percent));
    this.scenario = 'manual';
  }

  public setBrake(percent: number): void {
    this.brakeInput = Math.max(0, Math.min(100, percent));
  }

  public toggleEngine(): boolean {
    this.isEngineRunning = !this.isEngineRunning;
    if (!this.isEngineRunning) {
      this.rpm = 0;
      this.speed = 0;
      this.batteryVolts = 12.4;
      this.mapKpa = this.baroKpa;
      this.mafGps = 0;
    } else {
      this.rpm = 850;
      this.batteryVolts = 14.2;
    }
    return this.isEngineRunning;
  }

  public getEngineRunning(): boolean {
    return this.isEngineRunning;
  }

  public injectFault(code: string): void {
    if (!this.storedDTCs.includes(code)) {
      this.storedDTCs.push(code);
    }
  }

  public clearAllFaults(): void {
    this.storedDTCs = [];
    this.pendingDTCs = [];
  }

  public getStoredDTCs(): string[] {
    return [...this.storedDTCs];
  }

  public getInclinometerData() {
    return {
      pitch: Number(this.pitch.toFixed(1)),
      roll: Number(this.roll.toFixed(1)),
      altitude: Math.round(this.altitude),
      heading: Math.round(this.heading),
      gForceX: Number(this.gForceX.toFixed(2)),
      gForceY: Number(this.gForceY.toFixed(2)),
      peakG: Number(Math.max(Math.abs(this.gForceX), Math.abs(this.gForceY)).toFixed(2))
    };
  }

  private startPhysicsLoop(): void {
    if (this.loopInterval) clearInterval(this.loopInterval);
    this.lastUpdate = Date.now();

    this.loopInterval = window.setInterval(() => {
      this.updatePhysics();
    }, 50); // 20 Hz update
  }

  private updatePhysics(): void {
    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    if (!this.isEngineRunning) {
      this.rpm = 0;
      this.speed = Math.max(0, this.speed - 15 * dt);
      this.batteryVolts = 12.3 + Math.sin(now / 5000) * 0.1;
      this.gForceX = 0;
      this.gForceY = 0;
      return;
    }

    this.runTimeSeconds += dt;

    // Driving Profile automation
    if (this.scenario === 'idle') {
      this.throttleInput = 0;
      this.rpm = 820 + Math.sin(now / 400) * 25 + (Math.random() - 0.5) * 15;
      this.speed = 0;
      this.load = 18 + Math.sin(now / 800) * 3;
      this.mapKpa = 34 + Math.sin(now / 500) * 2;
      this.ect = Math.min(92, Math.max(88, this.ect + (90 - this.ect) * 0.05 * dt));
    } else if (this.scenario === 'city') {
      // Dynamic stop & go wave
      const phase = (now / 1000) % 30; // 30 sec city cycle
      if (phase < 8) {
        // accelerating
        this.throttleInput = 35 + Math.sin(phase) * 15;
        this.currentGear = phase < 3 ? 1 : 2;
      } else if (phase < 18) {
        // cruising
        this.throttleInput = 20 + Math.sin(phase) * 5;
        this.currentGear = 3;
      } else if (phase < 24) {
        // slowing down / traffic
        this.throttleInput = 5;
        this.currentGear = 2;
      } else {
        // idle at red light
        this.throttleInput = 0;
        this.currentGear = 0;
      }
    } else if (this.scenario === 'highway') {
      // Smooth high-speed cruising
      this.throttleInput = 28 + Math.sin(now / 2000) * 8;
      this.currentGear = 5;
    } else if (this.scenario === 'sport') {
      // Aggressive revving & fast acceleration
      const phase = (now / 1000) % 15;
      if (phase < 6) {
        this.throttleInput = 85 + (Math.random() * 10);
        this.currentGear = phase < 2.5 ? 2 : (phase < 4.5 ? 3 : 4);
      } else if (phase < 10) {
        this.throttleInput = 40;
        this.currentGear = 4;
      } else {
        this.throttleInput = 90;
        this.currentGear = 3;
      }
    } else if (this.scenario === 'overheat') {
      this.throttleInput = 45;
      this.ect = Math.min(118, this.ect + 0.3 * dt);
    }

    // Engine mechanics calculations
    const targetRpm = (this.throttleInput / 100) * 5200 + 800;
    this.rpm += (targetRpm - this.rpm) * Math.min(1, 4 * dt);
    
    // Target Speed from gear and RPM
    const gearRatios = [0, 8.5, 14.2, 22.0, 31.0, 40.0, 48.0];
    const ratio = gearRatios[this.currentGear] || 15;
    const targetSpeed = this.currentGear > 0 ? (this.rpm / 1000) * ratio : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, 2.5 * dt);

    // Calculated Engine Load
    this.load = Math.min(100, Math.max(12, (this.throttleInput * 0.75) + (this.rpm / 6000) * 20));

    // MAP (Manifold Pressure) - under heavy throttle with turbo goes up to 180 kPa
    const baseMap = 32 + (this.throttleInput / 100) * 68;
    const turboBoost = this.throttleInput > 60 && this.rpm > 2200 ? ((this.throttleInput - 60) / 40) * 85 : 0;
    this.mapKpa = Math.min(230, baseMap + turboBoost + (Math.random() - 0.5) * 2);

    // MAF (Airflow)
    this.mafGps = Math.max(2, (this.rpm * this.mapKpa) / 1200);

    // Intake Air Temp
    this.iat = 30 + (this.load / 100) * 12 + (this.scenario === 'sport' ? 8 : 0);

    // ECT Temperature regulation
    if (this.scenario !== 'overheat') {
      const targetEct = 91 + (this.load / 100) * 4;
      this.ect += (targetEct - this.ect) * 0.05 * dt;
    }

    // Transmission Fluid Temperature (TFT) regulation (typically 82°C - 96°C, higher during aggressive sport driving)
    const targetTft = 86 + (this.load / 100) * 12 + (this.speed > 90 ? 4 : 0) + (this.scenario === 'sport' ? 10 : 0);
    this.transTemp += (targetTft - this.transTemp) * 0.04 * dt;

    // Fuel Rate (L/h)
    this.fuelRateLh = (this.rpm / 1000) * (this.load / 100) * 3.8 + 0.85;

    // Battery alternator charging
    this.batteryVolts = 14.15 + Math.sin(now / 1500) * 0.15 - (this.load > 80 ? 0.2 : 0);

    // Fuel trims (closed loop oscillation)
    this.stft = Math.sin(now / 600) * 4.5 + (Math.random() - 0.5) * 1.5;
    this.ltft = -1.2 + Math.sin(now / 10000) * 0.8;

    // Timing advance
    this.timingAdvance = Math.max(4, 38 - (this.load * 0.25) + (this.rpm / 400));

    // O2 Sensor Switching Voltage (0.1V - 0.9V closed loop wave)
    this.o2Voltage = 0.5 + Math.sin(now / 400) * 0.38 + (Math.random() - 0.5) * 0.04;
    this.o2Voltage = Math.max(0.05, Math.min(0.95, this.o2Voltage));

    // Inclinometer / Dynamic G-Force
    const accelG = (targetSpeed - this.speed) / 35;
    this.pitch = Math.max(-25, Math.min(25, -accelG * 12 + Math.sin(now / 1200) * 1.5));
    const turnRate = Math.sin(now / 3500) * (this.speed / 70);
    this.roll = Math.max(-30, Math.min(30, turnRate * 18));
    this.gForceX = turnRate * (this.speed / 60);
    this.gForceY = accelG;
    this.heading = (this.heading + turnRate * 25 * dt + 360) % 360;
  }

  public async send(command: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('ELM327 Simulator not connected');
    }

    const cmd = command.trim().toUpperCase().replace(/\s+/g, '');

    // Small realistic delay (15-30ms) to emulate UART/CAN latency
    await new Promise(r => setTimeout(r, 18));

    // Handle AT commands
    if (cmd === 'ATZ' || cmd === 'ATWS') {
      this.currentCanHeader = '7DF';
      return 'ELM327 v1.5\r\n>';
    }
    if (cmd.startsWith('ATSH')) {
      this.currentCanHeader = cmd.substring(4) || '7DF';
      return 'OK\r\n>';
    }
    if (cmd === 'ATCRA') {
      this.currentCanHeader = '7DF';
      return 'OK\r\n>';
    }
    if (cmd.startsWith('ATE') || cmd.startsWith('ATL') || cmd.startsWith('ATS') || cmd.startsWith('ATH') || cmd.startsWith('ATSP') || cmd.startsWith('ATCAF')) {
      return 'OK\r\n>';
    }
    if (cmd === 'ATDP' || cmd === 'ATDPN') {
      return 'ISO 15765-4 (CAN 11/500)\r\n>';
    }
    if (cmd === 'ATRV') {
      return `${this.batteryVolts.toFixed(1)}V\r\n>`;
    }

    // Handle OBD-II Modes
    // Mode 01: Live PIDs
    if (cmd.startsWith('01')) {
      const pid = cmd.substring(2, 4);

      // Supported PIDs bitmasks
      if (pid === '00') {
        // Bitmask 01-20: Supports 01, 04, 05, 06, 07, 0A, 0B, 0C, 0D, 0E, 0F, 10, 11, 14, 1F, 20
        return '41 00 BE 3F B8 13\r\n>';
      }
      if (pid === '20') {
        // Bitmask 21-40: Supports 2F, 33, 3C, 40
        return '41 20 80 04 20 01\r\n>';
      }
      if (pid === '40') {
        // Bitmask 41-60: Supports 42, 46, 5C, 5D, 5E
        return '41 40 44 08 00 38\r\n>';
      }
      if (pid === 'A0') {
        // Bitmask A1-C0: Supports A6
        return '41 A0 04 00 00 00\r\n>';
      }

      // Live PID data conversions to Hex
      if (pid === '0C') {
        // RPM = ((A*256)+B)/4  =>  Value * 4
        const raw = Math.round(this.rpm * 4);
        const a = (raw >> 8) & 0xFF;
        const b = raw & 0xFF;
        return `41 0C ${this.toHex(a)} ${this.toHex(b)}\r\n>`;
      }
      if (pid === '0D') {
        // Speed = A km/h
        const a = Math.round(Math.max(0, Math.min(255, this.speed)));
        return `41 0D ${this.toHex(a)}\r\n>`;
      }
      if (pid === '05') {
        // ECT = A - 40  =>  A = ECT + 40
        const a = Math.round(Math.max(0, Math.min(255, this.ect + 40)));
        return `41 05 ${this.toHex(a)}\r\n>`;
      }
      if (pid === '04') {
        // Load = (A * 100) / 255  =>  A = (Load * 255) / 100
        const a = Math.round(Math.max(0, Math.min(255, (this.load * 255) / 100)));
        return `41 04 ${this.toHex(a)}\r\n>`;
      }
      if (pid === '11') {
        // Throttle = (A * 100) / 255
        const a = Math.round(Math.max(0, Math.min(255, (this.throttleInput * 255) / 100)));
        return `41 11 ${this.toHex(a)}\r\n>`;
      }
      if (pid === '0F') {
        // IAT = A - 40
        const a = Math.round(Math.max(0, Math.min(255, this.iat + 40)));
        return `41 0F ${this.toHex(a)}\r\n>`;
      }
      if (pid === '0B') {
        // MAP = A kPa
        const a = Math.round(Math.max(0, Math.min(255, this.mapKpa)));
        return `41 0B ${this.toHex(a)}\r\n>`;
      }
      if (pid === '10') {
        // MAF = ((A*256)+B)/100  =>  Value * 100
        const raw = Math.round(this.mafGps * 100);
        const a = (raw >> 8) & 0xFF;
        const b = raw & 0xFF;
        return `41 10 ${this.toHex(a)} ${this.toHex(b)}\r\n>`;
      }
      if (pid === '42') {
        // Battery Voltage = ((A*256)+B)/1000  =>  Value * 1000
        const raw = Math.round(this.batteryVolts * 1000);
        const a = (raw >> 8) & 0xFF;
        const b = raw & 0xFF;
        return `41 42 ${this.toHex(a)} ${this.toHex(b)}\r\n>`;
      }
      if (pid === '06') {
        // STFT1 = (A - 128) * 100 / 128  =>  A = (STFT * 128 / 100) + 128
        const a = Math.round(Math.max(0, Math.min(255, (this.stft * 128) / 100 + 128)));
        return `41 06 ${this.toHex(a)}\r\n>`;
      }
      if (pid === '07') {
        // LTFT1
        const a = Math.round(Math.max(0, Math.min(255, (this.ltft * 128) / 100 + 128)));
        return `41 07 ${this.toHex(a)}\r\n>`;
      }
      if (pid === '0E') {
        // Timing Advance = (A / 2) - 64  =>  A = (Timing + 64) * 2
        const a = Math.round(Math.max(0, Math.min(255, (this.timingAdvance + 64) * 2)));
        return `41 0E ${this.toHex(a)}\r\n>`;
      }
      if (pid === '14') {
        // O2 Sensor 1 = A / 200, B = STFT
        const a = Math.round(Math.max(0, Math.min(255, this.o2Voltage * 200)));
        const b = 128;
        return `41 14 ${this.toHex(a)} ${this.toHex(b)}\r\n>`;
      }
      if (pid === '33') {
        // Barometric Pressure = A kPa
        const a = Math.round(this.baroKpa);
        return `41 33 ${this.toHex(a)}\r\n>`;
      }
      if (pid === '2F') {
        // Fuel Tank Level %
        const a = Math.round((this.fuelLevel * 255) / 100);
        return `41 2F ${this.toHex(a)}\r\n>`;
      }
      if (pid === '1F') {
        // Run Time Seconds
        const raw = Math.round(this.runTimeSeconds) & 0xFFFF;
        const a = (raw >> 8) & 0xFF;
        const b = raw & 0xFF;
        return `41 1F ${this.toHex(a)} ${this.toHex(b)}\r\n>`;
      }
      if (pid === '3C') {
        // Catalyst Temp Bank 1
        const temp = 450 + (this.load / 100) * 350;
        const raw = Math.round((temp + 40) * 10);
        const a = (raw >> 8) & 0xFF;
        const b = raw & 0xFF;
        return `41 3C ${this.toHex(a)} ${this.toHex(b)}\r\n>`;
      }
      if (pid === '46') {
        // Ambient Air Temp
        const a = Math.round(28 + 40);
        return `41 46 ${this.toHex(a)}\r\n>`;
      }
      if (pid === '5C') {
        // Engine Oil Temp
        const a = Math.round(92 + 40);
        return `41 5C ${this.toHex(a)}\r\n>`;
      }
      if (pid === 'A6') {
        // SAE J1979-DA: Odometer (km) - Formula: ((A*16777216)+(B*65536)+(C*256)+D)/10
        // Simulate ~14,250.0 km + trip distance
        const totalKm = 14250.0 + (this.runTimeSeconds * 0.015);
        const raw = Math.round(totalKm * 10) & 0xFFFFFFFF;
        const a = (raw >>> 24) & 0xFF;
        const b = (raw >>> 16) & 0xFF;
        const c = (raw >>> 8) & 0xFF;
        const d = raw & 0xFF;
        return `41 A6 ${this.toHex(a)} ${this.toHex(b)} ${this.toHex(c)} ${this.toHex(d)}\r\n>`;
      }
      if (pid === '5D') {
        // SAE J1979-DA: Fuel Injection Timing (°) - Formula: (((A*256)+B)-26880)/128
        const timingDeg = 8.5 + (this.load / 100) * 12.0;
        const raw = Math.round(timingDeg * 128 + 26880) & 0xFFFF;
        const a = (raw >> 8) & 0xFF;
        const b = raw & 0xFF;
        return `41 5D ${this.toHex(a)} ${this.toHex(b)}\r\n>`;
      }
      if (pid === '5E') {
        // Fuel Rate (L/h) - Formula: ((A*256)+B)*0.05
        const raw = Math.round(this.fuelRateLh / 0.05);
        const a = (raw >> 8) & 0xFF;
        const b = raw & 0xFF;
        return `41 5E ${this.toHex(a)} ${this.toHex(b)}\r\n>`;
      }

      return 'NO DATA\r\n>';
    }

    // Mode 03: Read Stored Trouble Codes
    if (cmd === '03') {
      // If querying unequipped optional module (e.g. 7E6 4WD on 2WD vehicle)
      if (this.currentCanHeader === '7E6') {
        return 'NO DATA\r\n>';
      }

      // If querying non-ECM module with no faults, return 43 00
      if (this.currentCanHeader !== '7E0' && this.currentCanHeader !== '7DF') {
        return '43 00\r\n>';
      }

      if (this.storedDTCs.length === 0) {
        return '43 00\r\n>';
      }
      let hexOutput = '43 ';
      for (const code of this.storedDTCs) {
        hexOutput += this.dtcToHex(code) + ' ';
      }
      return hexOutput.trim() + '\r\n>';
    }

    // Mode 07: Read Pending Trouble Codes
    if (cmd === '07') {
      if (this.currentCanHeader === '7E6') {
        return 'NO DATA\r\n>';
      }
      if (this.currentCanHeader !== '7E0' && this.currentCanHeader !== '7DF') {
        return '47 00\r\n>';
      }
      if (this.pendingDTCs.length === 0) {
        return '47 00\r\n>';
      }
      let hexOutput = '47 ';
      for (const code of this.pendingDTCs) {
        hexOutput += this.dtcToHex(code) + ' ';
      }
      return hexOutput.trim() + '\r\n>';
    }

    // Mode 04: Clear Trouble Codes
    if (cmd === '04') {
      this.clearAllFaults();
      return '44\r\n>';
    }

    // Mode 09: Vehicle Info (0902 = VIN)
    if (cmd === '0902') {
      // Simulated VIN: Universal OBD2 Vehicle (OBD2024UNIV88990)
      return '49 02 01 4F 42 44 32 30 32 34 55 4E 49 56 38 38 39 39 30\r\n>';
    }

    return 'OK\r\n>';
  }

  private toHex(val: number): string {
    return val.toString(16).toUpperCase().padStart(2, '0');
  }

  private dtcToHex(code: string): string {
    // SAE J2012 Standard 2-byte DTC encoding:
    // Byte 1: [System (2-bits: P=00, C=01, B=10, U=11)][Digit 1 (2-bits: 0-3)][Digit 2 (4-bits: 0-F)]
    // Byte 2: [Digit 3 (4-bits: 0-F)][Digit 4 (4-bits: 0-F)]
    if (!code || code.length < 5) return '00 00';
    const prefix = code.charAt(0).toUpperCase();
    const d1 = parseInt(code.charAt(1), 16) || 0;
    const d2 = parseInt(code.charAt(2), 16) || 0;
    const d3 = parseInt(code.charAt(3), 16) || 0;
    const d4 = parseInt(code.charAt(4), 16) || 0;

    let sys = 0; // P
    if (prefix === 'C') sys = 1;
    else if (prefix === 'B') sys = 2;
    else if (prefix === 'U') sys = 3;

    const byte1 = (sys << 6) | ((d1 & 0x03) << 4) | (d2 & 0x0F);
    const byte2 = ((d3 & 0x0F) << 4) | (d4 & 0x0F);

    return `${this.toHex(byte1)} ${this.toHex(byte2)}`;
  }
}
