import { BaseTransport } from './Transport';

export interface AdapterInfo {
  elmVersion: string;
  protocol: string;
  voltage: string;
  supportedPids: Set<string>;
}

export class OBDAdapterDriver {
  private transport: BaseTransport;
  private isInitialized: boolean = false;
  private adapterInfo: AdapterInfo = {
    elmVersion: 'Unknown',
    protocol: 'Auto',
    voltage: '0.0V',
    supportedPids: new Set<string>()
  };

  constructor(transport: BaseTransport) {
    this.transport = transport;
  }

  public setTransport(transport: BaseTransport): void {
    this.transport = transport;
    this.isInitialized = false;
  }

  public getTransport(): BaseTransport {
    return this.transport;
  }

  public async initialize(): Promise<AdapterInfo> {
    if (!this.transport.isConnected()) {
      throw new Error('Transport must be connected before initializing OBD adapter');
    }

    try {
      // 1. Reset ELM327
      const atz = await this.executeCommand('ATZ');
      this.adapterInfo.elmVersion = atz.replace(/[>\r\n]/g, '').trim() || 'ELM327 v1.5';

      // 2. Set basic parameters
      await this.executeCommand('ATE0'); // Echo off
      await this.executeCommand('ATL0'); // Linefeeds off
      await this.executeCommand('ATS0'); // Spaces off
      await this.executeCommand('ATH0'); // Headers off
      await this.executeCommand('ATAT1'); // Adaptive timing normal

      // 3. Set protocol to Auto
      await this.executeCommand('ATSP0');

      // 4. Read battery voltage
      try {
        const atrv = await this.executeCommand('ATRV');
        this.adapterInfo.voltage = atrv.replace(/[>\r\n]/g, '').trim();
      } catch {
        this.adapterInfo.voltage = '12.0V';
      }

      // 5. Read active protocol description
      try {
        const atdp = await this.executeCommand('ATDP');
        this.adapterInfo.protocol = atdp.replace(/[>\r\n]/g, '').trim();
      } catch {
        this.adapterInfo.protocol = 'ISO 15765-4 CAN';
      }

      // 6. Query Supported PIDs Bitmasks (0100, 0120, 0140)
      this.adapterInfo.supportedPids = await this.scanSupportedPids();

      this.isInitialized = true;
      return this.adapterInfo;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`OBD Adapter initialization failed: ${errMsg}`);
    }
  }

  public async scanSupportedPids(): Promise<Set<string>> {
    const supported = new Set<string>();

    try {
      // Query Mode 01 PID 00 (01 to 20)
      const res00 = await this.executeCommand('0100');
      this.parsePidBitmask(res00, 0x01, supported);

      // If PID 20 is supported, query 21 to 40
      if (supported.has('0120')) {
        const res20 = await this.executeCommand('0120');
        this.parsePidBitmask(res20, 0x21, supported);
      }

      // If PID 40 is supported, query 41 to 60
      if (supported.has('0140')) {
        const res40 = await this.executeCommand('0140');
        this.parsePidBitmask(res40, 0x41, supported);
      }
    } catch (e) {
      console.warn('Could not complete full PID bitmask scan:', e);
    }

    return supported;
  }

  private parsePidBitmask(rawResponse: string, startPid: number, set: Set<string>): void {
    const cleaned = rawResponse.replace(/[^0-9A-Fa-f]/g, '');
    // Expecting response starting with 41 xx [4 bytes bitmask]
    const matchIndex = cleaned.indexOf('41');
    if (matchIndex === -1 || cleaned.length < matchIndex + 12) return;

    const bitmaskHex = cleaned.substring(matchIndex + 4, matchIndex + 12);
    const bitmask = parseInt(bitmaskHex, 16);

    for (let i = 0; i < 32; i++) {
      if ((bitmask & (1 << (31 - i))) !== 0) {
        const pidNum = startPid + i;
        const hexPid = '01' + pidNum.toString(16).toUpperCase().padStart(2, '0');
        set.add(hexPid);
      }
    }
  }

  public async executeCommand(cmd: string): Promise<string> {
    const raw = await this.transport.send(cmd);
    // Sanitize response
    return raw.replace(/[\r\n>]/g, ' ').trim();
  }

  public isPidSupported(pidId: string): boolean {
    if (!this.isInitialized || this.adapterInfo.supportedPids.size === 0) {
      // In early stage or if bitmask wasn't returned, allow default check
      return true;
    }
    return this.adapterInfo.supportedPids.has(pidId);
  }

  public getAdapterInfo(): AdapterInfo {
    return this.adapterInfo;
  }
}
