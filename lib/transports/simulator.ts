import type { OBDTransport } from './transport';

const dtcResponse = '43 01 33 04 20 00 00';

export class SimulatorTransport implements OBDTransport {
  readonly name = 'ELM327 Simulator';
  private connected = false;
  private started = Date.now();

  async connect() { await new Promise((resolve) => setTimeout(resolve, 500)); this.connected = true; this.started = Date.now(); }
  async disconnect() { this.connected = false; }
  isConnected() { return this.connected; }
  async write(command: string) {
    if (!this.connected) throw new Error('Transport is not connected');
    const clean = command.replace(/\s/g, '').toUpperCase();
    if (clean === 'ATZ') return 'ELM327 v1.5';
    if (clean.startsWith('AT')) return 'OK';
    if (clean === '0100') return '41 00 BE 3E B8 13';
    if (clean === '0120') return '41 20 80 01 A0 01';
    if (clean === 'ATRV') return '14.2V';
    if (clean === '03' || clean === '07') return dtcResponse;
    if (clean === '04') return '44';
    const t = (Date.now() - this.started) / 1000;
    const values: Record<string, number[]> = {
      '010C': [Math.floor((2050 + Math.sin(t * 1.7) * 380) * 4 / 256), Math.floor((2050 + Math.sin(t * 1.7) * 380) * 4) % 256],
      '010D': [Math.max(0, Math.round(62 + Math.sin(t / 2) * 24))],
      '0105': [129], '0104': [Math.round((38 + Math.sin(t) * 8) * 2.55)],
      '0111': [Math.round((21 + Math.sin(t / 1.3) * 6) * 2.55)],
      '010F': [72], '010B': [92], '0110': [1, 122],
      '0106': [132], '0107': [125],
    };
    const bytes = values[clean];
    if (!bytes) return 'NO DATA';
    return `41 ${clean.slice(2)} ${bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')}`.toUpperCase();
  }
}
