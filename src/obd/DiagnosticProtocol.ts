import { OBDAdapterDriver } from './OBDAdapterDriver';
import { PIDDefinition, TelemetryValue } from '../types';

export class DiagnosticProtocol {
  private driver: OBDAdapterDriver;

  constructor(driver: OBDAdapterDriver) {
    this.driver = driver;
  }

  /**
   * Reads a live parameter (Mode 01)
   */
  public async readPid(pidDef: PIDDefinition): Promise<TelemetryValue> {
    const cmd = `${pidDef.service}${pidDef.pid}`;
    try {
      const response = await this.driver.executeCommand(cmd);
      
      // Check for common OBD error responses
      if (response.includes('NO DATA') || response.includes('UNABLE TO CONNECT') || response.includes('ERROR') || response.includes('?')) {
        return {
          value: null,
          displayValue: 'N/A',
          unit: pidDef.unit,
          rawHex: response,
          timestamp: Date.now(),
          isSupported: false,
          status: 'unsupported',
          minPeak: null,
          maxPeak: null
        };
      }

      // Clean hex bytes
      const cleaned = response.replace(/[^0-9A-Fa-f]/g, '');
      const expectedHeader = `41${pidDef.pid.toUpperCase()}`;
      const headerIdx = cleaned.indexOf(expectedHeader);

      if (headerIdx === -1) {
        return {
          value: null,
          displayValue: 'Not Supported',
          unit: pidDef.unit,
          rawHex: response,
          timestamp: Date.now(),
          isSupported: false,
          status: 'unsupported',
          minPeak: null,
          maxPeak: null
        };
      }

      const dataHex = cleaned.substring(headerIdx + expectedHeader.length);
      const val = this.calculateFormula(pidDef.formula, dataHex);

      let status: 'normal' | 'warning' | 'critical' | 'unsupported' = 'normal';
      if (val !== null) {
        if (pidDef.criticalThreshold !== undefined) {
          if (pidDef.id === '0142') {
            // Voltage: lower is worse
            if (val <= pidDef.criticalThreshold) status = 'critical';
            else if (pidDef.warningThreshold && val <= pidDef.warningThreshold) status = 'warning';
          } else {
            if (val >= pidDef.criticalThreshold) status = 'critical';
            else if (pidDef.warningThreshold && val >= pidDef.warningThreshold) status = 'warning';
          }
        }
      }

      return {
        value: val,
        displayValue: val !== null ? this.formatDisplayValue(val, pidDef.id) : 'N/A',
        unit: pidDef.unit,
        rawHex: dataHex,
        timestamp: Date.now(),
        isSupported: true,
        status,
        minPeak: val,
        maxPeak: val
      };
    } catch {
      return {
        value: null,
        displayValue: 'Error',
        unit: pidDef.unit,
        rawHex: '',
        timestamp: Date.now(),
        isSupported: false,
        status: 'unsupported',
        minPeak: null,
        maxPeak: null
      };
    }
  }

  /**
   * Safe parser for PID formulas: A, B, C, D bytes
   */
  private calculateFormula(formula: string, hexString: string): number | null {
    if (!hexString || hexString.length < 2) return null;

    const A = parseInt(hexString.substring(0, 2), 16) || 0;
    const B = hexString.length >= 4 ? parseInt(hexString.substring(2, 4), 16) || 0 : 0;
    const C = hexString.length >= 6 ? parseInt(hexString.substring(4, 6), 16) || 0 : 0;
    const D = hexString.length >= 8 ? parseInt(hexString.substring(6, 8), 16) || 0 : 0;

    try {
      // Evaluate standard OBD formulas safely
      if (formula === '((A * 256) + B) / 4') {
        return Math.round(((A * 256) + B) / 4);
      }
      if (formula === 'A') {
        return A;
      }
      if (formula === 'A - 40') {
        return A - 40;
      }
      if (formula === '(A * 100) / 255') {
        return Number(((A * 100) / 255).toFixed(1));
      }
      if (formula === '((A * 256) + B) / 100') {
        return Number((((A * 256) + B) / 100).toFixed(1));
      }
      if (formula === '((A * 256) + B) / 1000') {
        return Number((((A * 256) + B) / 1000).toFixed(2));
      }
      if (formula === '((A * 256) + B) * 0.05') {
        return Number((((A * 256) + B) * 0.05).toFixed(2));
      }
      if (formula === '(((A * 256) + B) - 26880) / 128') {
        return Number(((((A * 256) + B) - 26880) / 128).toFixed(2));
      }
      if (formula === '((A * 16777216) + (B * 65536) + (C * 256) + D) / 10') {
        return Number((((A * 16777216) + (B * 65536) + (C * 256) + D) / 10).toFixed(1));
      }
      if (formula === 'A - 125') {
        return A - 125;
      }
      if (formula === '(A - 128) * 100 / 128') {
        return Number(((A - 128) * 100 / 128).toFixed(1));
      }
      if (formula === '(A / 2) - 64') {
        return Number(((A / 2) - 64).toFixed(1));
      }
      if (formula === 'A / 200') {
        return Number((A / 200).toFixed(3));
      }
      if (formula === '((A * 256) + B) / 10 - 40') {
        return Number((((A * 256) + B) / 10 - 40).toFixed(1));
      }
      if (formula === 'A * 3') {
        return A * 3;
      }
      if (formula === '(A * 256) + B') {
        return (A * 256) + B;
      }

      // Safe JS function fallback
      const func = new Function('A', 'B', 'C', 'D', `return ${formula};`);
      const result = func(A, B, C, D);
      return typeof result === 'number' && !isNaN(result) ? Number(result.toFixed(2)) : null;
    } catch (e) {
      console.warn('Formula eval error:', formula, e);
      return null;
    }
  }

  private formatDisplayValue(val: number, pidId: string): string {
    if (pidId === '010C') return Math.round(val).toString(); // RPM integer
    if (pidId === '010D') return Math.round(val).toString(); // Speed integer
    if (pidId === '0105' || pidId === '010F' || pidId === '0146' || pidId === '015C') return Math.round(val).toString(); // Temp integer
    if (pidId === '01A6') return Math.round(val).toLocaleString(); // Odometer km
    if (pidId === '015D') return val.toFixed(1); // Injection timing °
    if (pidId === '0142') return val.toFixed(1); // 14.2 V
    if (pidId === '0114') return val.toFixed(2); // 0.45 V
    return val.toFixed(1);
  }

  /**
   * Reads Mode 03 (Confirmed Stored DTCs)
   */
  public async readStoredDTCs(): Promise<string[]> {
    const raw = await this.driver.executeCommand('03');
    return this.parseDTCResponse(raw, '43');
  }

  /**
   * Reads Mode 07 (Pending DTCs)
   */
  public async readPendingDTCs(): Promise<string[]> {
    const raw = await this.driver.executeCommand('07');
    return this.parseDTCResponse(raw, '47');
  }

  /**
   * Scans multiple electronic control units (ECUs) on the CAN network:
   * - 7E0: Engine ECM (موتور)
   * - 7E1: Transmission TCM (گیربکس اتوماتیک)
   * - 7E2: ABS / ESC (ترمز ضدقفل و پایداری)
   * - 7E3: SRS Airbag (کیسه هوا و ایمنی)
   * - 7E4 / 720: BCM (کامپیوتر بدنه و کنترل مرکزی)
   * - 7E6: 4WD Transfer Case (کنترلر سیستم دو دیفرانسیل)
   */
  public async readMultiModuleDTCs(): Promise<import('../types').ModuleDTCGroup[]> {
    const modules = [
      { moduleId: 'ECM', moduleName: 'Engine Control Module (ECM)', persianModuleName: 'یونیت کنترل موتور (ECM)', header: '7E0' },
      { moduleId: 'TCM', moduleName: 'Transmission Control Module (TCM / 6AT)', persianModuleName: 'یونیت گیربکس اتوماتیک (TCM)', header: '7E1' },
      { moduleId: 'ABS', moduleName: 'Anti-Lock Braking System (ABS / ESC)', persianModuleName: 'سیستم ترمز ABS و پایداری ESC', header: '7E2' },
      { moduleId: 'SRS', moduleName: 'Supplemental Restraint System (SRS Airbag)', persianModuleName: 'یونیت کیسه هوا (SRS / Airbag)', header: '7E3' },
      { moduleId: 'BCM', moduleName: 'Body Control Module (BCM)', persianModuleName: 'کامپیوتر کنترل بدنه (BCM)', header: '7E4' },
      { moduleId: '4WD', moduleName: '4WD Transfer Case Controller', persianModuleName: 'کنترلر ترنسفرکیس دو دیفرانسیل (4WD)', header: '7E6' }
    ];

    const results: import('../types').ModuleDTCGroup[] = [];

    for (const mod of modules) {
      let dtcs: string[] = [];
      let status: 'healthy' | 'faults_found' | 'no_response' | 'error' = 'no_response';

      try {
        // Set CAN target header
        await this.driver.executeCommand(`AT SH ${mod.header}`);
        // Query stored DTCs
        const rawStored = await this.driver.executeCommand('03');
        const storedClean = rawStored.replace(/[\r\n\s>]/g, '').toUpperCase();

        if (storedClean.includes('NODATA') || storedClean.includes('UNABLE') || storedClean.includes('ERROR') || storedClean.includes('?')) {
          status = 'no_response';
        } else {
          const storedList = this.parseDTCResponse(rawStored, '43');
          // Query pending DTCs
          const rawPending = await this.driver.executeCommand('07');
          const pendingList = this.parseDTCResponse(rawPending, '47');

          const combined = Array.from(new Set([...storedList, ...pendingList]));
          dtcs = combined;

          if (dtcs.length > 0) {
            status = 'faults_found';
          } else if (storedClean.includes('4300') || storedClean.includes('43 00') || rawStored.includes('43 00')) {
            status = 'healthy';
          } else {
            status = 'healthy';
          }
        }
      } catch {
        status = 'no_response';
      }

      results.push({
        moduleId: mod.moduleId,
        moduleName: mod.moduleName,
        persianModuleName: mod.persianModuleName,
        header: mod.header,
        dtcs,
        status
      });
    }

    // Reset CAN header back to broadcast/standard
    try {
      await this.driver.executeCommand('AT CRA');
      await this.driver.executeCommand('AT SH 7DF');
    } catch {}

    return results;
  }

  /**
   * Mode 04: Clear Diagnostic Trouble Codes (Requires explicit user confirmation!)
   * Returns true ONLY if ECU positively acknowledges with 44 or OK
   */
  public async clearDTCs(): Promise<boolean> {
    try {
      const raw = await this.driver.executeCommand('04');
      const cleaned = raw.replace(/[\r\n\s>]/g, '').toUpperCase();
      if (cleaned.includes('7F04') || cleaned.includes('ERROR') || cleaned.includes('NODATA') || cleaned.includes('?')) {
        return false;
      }
      return cleaned.includes('44') || cleaned.includes('OK');
    } catch {
      return false;
    }
  }

  /**
   * Mode 09: Read VIN (Vehicle Identification Number)
   */
  public async readVIN(): Promise<string> {
    try {
      const raw = await this.driver.executeCommand('0902');
      const cleaned = raw.replace(/[^0-9A-Fa-f]/g, '');
      const idx = cleaned.indexOf('4902');
      if (idx === -1) return '';

      const hexData = cleaned.substring(idx + 4);
      let vin = '';
      for (let i = 0; i < hexData.length; i += 2) {
        const charCode = parseInt(hexData.substring(i, i + 2), 16);
        if (charCode >= 32 && charCode <= 126) {
          vin += String.fromCharCode(charCode);
        }
      }
      return vin.replace(/[^A-Z0-9]/gi, '').trim();
    } catch {
      return '';
    }
  }

  /**
   * Mode 01: Query Supported PIDs Bitmaps (0100, 0120, 0140, 0160)
   */
  public async readSupportedPIDsBitmap(): Promise<string[]> {
    const supported: string[] = [];
    const ranges = [
      { cmd: '0100', offset: 0 },
      { cmd: '0120', offset: 32 },
      { cmd: '0140', offset: 64 },
      { cmd: '0160', offset: 96 }
    ];

    for (const range of ranges) {
      try {
        const raw = await this.driver.executeCommand(range.cmd);
        const cleaned = raw.replace(/[^0-9A-Fa-f]/g, '');
        const expectedHeader = `41${range.cmd.substring(2)}`;
        const headerIdx = cleaned.indexOf(expectedHeader);
        if (headerIdx === -1) break;

        const dataHex = cleaned.substring(headerIdx + expectedHeader.length, headerIdx + expectedHeader.length + 8);
        if (dataHex.length < 8) break;

        const val32 = parseInt(dataHex, 16);
        let hasNextRange = false;

        for (let bit = 1; bit <= 32; bit++) {
          const isSupported = (val32 & (1 << (32 - bit))) !== 0;
          if (isSupported) {
            const pidNum = range.offset + bit;
            const pidHex = pidNum.toString(16).toUpperCase().padStart(2, '0');
            const fullPid = `01${pidHex}`;
            supported.push(fullPid);
            if (bit === 32) {
              hasNextRange = true;
            }
          }
        }

        if (!hasNextRange) {
          break;
        }
      } catch {
        break;
      }
    }

    return supported;
  }

  /**
   * Auto-Detects Vehicle, reads VIN, Supported PIDs and matches vehicle database
   */
  public async detectVehicle(allVehicles: import('../types').VehicleProfile[]): Promise<import('../types').DetectedVehicleInfo> {
    let vin = '';
    let ecuName = '';
    let protocol = 'ISO 15765-4 (CAN)';
    let detectedPIDs: string[] = [];

    try {
      // 1. Query Protocol
      const dp = await this.driver.executeCommand('ATDP');
      if (dp && !dp.includes('ERROR') && !dp.includes('?')) {
        protocol = dp.replace(/[\r\n>]/g, '').trim() || protocol;
      }
    } catch {}

    try {
      // 2. Query VIN
      vin = await this.readVIN();
    } catch {}

    try {
      // 3. Query ECU / Adapter Name
      const ati = await this.driver.executeCommand('ATI');
      if (ati && !ati.includes('ERROR')) {
        ecuName = ati.replace(/[\r\n>]/g, '').trim();
      }
    } catch {}

    try {
      // 4. Query supported PIDs bitmap
      detectedPIDs = await this.readSupportedPIDsBitmap();
    } catch {}

    // Fallback if no PIDs discovered
    if (detectedPIDs.length === 0) {
      detectedPIDs = ['010C', '010D', '0105', '0104', '0111', '010F', '010B', '0142', '0106', '010E', '0114', '012F', '0133', '011F'];
    }

    const baseVehicle = allVehicles[0] || {
      id: 'universal_obd2',
      manufacturer: 'Universal OBD-II / EOBD',
      persianManufacturer: 'استاندارد جهانی OBD-II',
      model: 'Universal OBD-II Vehicle',
      persianModel: 'پروتکل جهانی استاندارد OBD-II',
      year: 'Universal',
      engine: 'All Gasoline, Diesel & Hybrid Engines',
      ecu: 'Standard SAE J1979 / ISO 15765-4',
      protocol: 'ISO 15765-4 (CAN 11bit 500kbaud)',
      fuelTankCapacity: 60,
      redlineRpm: 6500,
      normalEctRange: [85, 98],
      supportedPID: detectedPIDs,
      unsupportedPID: []
    };

    // Build optimized profile with the actual detected PIDs from ECU
    const autoProfile: import('../types').VehicleProfile = {
      ...baseVehicle,
      id: 'auto_universal_obd2',
      model: 'Universal OBD-II Protocol (SAE J1979)',
      persianModel: 'پروتکل جهانی استاندارد OBD-II (SAE J1979)',
      supportedPID: detectedPIDs,
      unsupportedPID: [],
      isAutoDetected: true,
      vin: vin || undefined
    };

    return {
      isAutoDetected: true,
      vin: vin || 'OBD2-ECU-CONNECTED',
      ecuName: ecuName || 'Universal OBD-II ECU',
      protocol,
      matchedVehicle: autoProfile,
      detectedSupportedPIDs: detectedPIDs,
      confidence: vin ? 'high' : 'medium',
      timestamp: Date.now()
    };
  }

  private parseDTCResponse(rawResponse: string, expectedHeader: string): string[] {
    const dtcs: string[] = [];
    const cleaned = rawResponse.replace(/[^0-9A-Fa-f]/g, '');
    const headerIdx = cleaned.indexOf(expectedHeader);
    if (headerIdx === -1) return dtcs;

    // After header e.g. 43 0420 0171 0000
    const dtcData = cleaned.substring(headerIdx + 2);
    for (let i = 0; i < dtcData.length; i += 4) {
      if (i + 4 > dtcData.length) break;
      const byteHex = dtcData.substring(i, i + 4);
      if (byteHex === '0000') continue;

      const firstByte = parseInt(byteHex.substring(0, 2), 16);
      const secondByte = parseInt(byteHex.substring(2, 4), 16);

      // OBD-II DTC decoder
      const systemNum = (firstByte & 0xC0) >> 6;
      let systemChar = 'P';
      if (systemNum === 1) systemChar = 'C';
      else if (systemNum === 2) systemChar = 'B';
      else if (systemNum === 3) systemChar = 'U';

      const digit1 = (firstByte & 0x30) >> 4;
      const digit2 = (firstByte & 0x0F).toString(16).toUpperCase();
      const digit3_4 = secondByte.toString(16).toUpperCase().padStart(2, '0');

      const dtcCode = `${systemChar}${digit1}${digit2}${digit3_4}`;
      if (!dtcs.includes(dtcCode)) {
        dtcs.push(dtcCode);
      }
    }

    return dtcs;
  }
}
