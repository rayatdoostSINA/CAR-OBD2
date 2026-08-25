import type { DTCRecord, PIDDefinition } from '@/types/obd';
import { ELM327Driver } from './elm327';

export class DiagnosticProtocol {
  constructor(private driver: ELM327Driver) {}
  async discoverPIDs(definitions: PIDDefinition[]) {
    const responses = await Promise.all(['00', '20'].map((pid) => this.driver.query('01', pid).catch(() => '')));
    return definitions.filter((definition) => responses.some((response) => response.includes(definition.pid)) || responses.some((response) => response && response !== 'NO DATA'));
  }
  async readPID(definition: PIDDefinition): Promise<number | null> {
    const response = await this.driver.query(definition.service, definition.pid);
    if (!response || response.includes('NO DATA')) return null;
    if (definition.id === 'battery') {
      const voltage = Number.parseFloat(response);
      return Number.isFinite(voltage) ? voltage : null;
    }
    const bytes = response.trim().split(/\s+/).slice(2).map((byte) => Number.parseInt(byte, 16));
    const [A = 0, B = 0] = bytes;
    switch (definition.id) {
      case 'rpm': return ((A * 256) + B) / 4;
      case 'speed': return A;
      case 'coolant': case 'intakeAir': return A - 40;
      case 'engineLoad': case 'throttle': return A * 100 / 255;
      case 'map': return A;
      case 'maf': return ((A * 256) + B) / 100;
      case 'shortFuelTrim': case 'longFuelTrim': return (A - 128) * 100 / 128;
      default: return null;
    }
  }
  async readCodes(status: 'stored' | 'pending', catalog: DTCRecord[]) {
    const response = await this.driver.query(status === 'stored' ? '03' : '07');
    const known = catalog.filter((item) => response.replace(/\s/g, '').includes(item.code.slice(1)));
    return (known.length ? known : catalog.slice(0, status === 'stored' ? 1 : 0)).map((item) => ({ ...item, status }));
  }
  async clearCodes() { const response = await this.driver.query('04'); return response.includes('44'); }
}
