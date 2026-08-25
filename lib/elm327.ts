import type { OBDTransport } from './transports/transport';

export class ELM327Driver {
  constructor(private transport: OBDTransport) {}
  async initialize() {
    await this.transport.write('ATZ');
    for (const command of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']) await this.transport.write(command);
  }
  query(service: string, pid?: string) { return this.transport.write(`${service}${pid ?? ''}`); }
  async close() { await this.transport.disconnect(); }
}
