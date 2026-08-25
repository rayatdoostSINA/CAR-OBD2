import type { OBDTransport } from './transport';

type ValueEvent = Event & { target: { value?: DataView } };
type CharacteristicLike = {
  startNotifications(): Promise<CharacteristicLike>;
  stopNotifications?(): Promise<CharacteristicLike>;
  writeValue?(value: BufferSource): Promise<void>;
  writeValueWithResponse?(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  addEventListener(type: 'characteristicvaluechanged', handler: (event: ValueEvent) => void): void;
  removeEventListener(type: 'characteristicvaluechanged', handler: (event: ValueEvent) => void): void;
};
type ServiceLike = { getCharacteristic(id: string): Promise<CharacteristicLike> };
type ServerLike = { getPrimaryService(id: string): Promise<ServiceLike>; disconnect(): void };
type DeviceLike = {
  gatt?: { connected: boolean; connect(): Promise<ServerLike>; disconnect(): void };
  addEventListener(type: 'gattserverdisconnected', handler: () => void): void;
  removeEventListener(type: 'gattserverdisconnected', handler: () => void): void;
};

const PROFILES = [
  { service: '0000ffe0-0000-1000-8000-00805f9b34fb', write: '0000ffe1-0000-1000-8000-00805f9b34fb', notify: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  { service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', write: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', notify: '6e400003-b5a3-f393-e0a9-e50e24dcca9e' },
  { service: '0000fff0-0000-1000-8000-00805f9b34fb', write: '0000fff2-0000-1000-8000-00805f9b34fb', notify: '0000fff1-0000-1000-8000-00805f9b34fb' },
];

export class WebBluetoothTransport implements OBDTransport {
  readonly name = 'Web Bluetooth ELM327 BLE';
  private device?: DeviceLike;
  private server?: ServerLike;
  private writer?: CharacteristicLike;
  private notifier?: CharacteristicLike;
  private buffer = '';
  private pending?: { resolve: (value: string) => void; reject: (reason: Error) => void; timer: number; command: string };
  private queue: Promise<unknown> = Promise.resolve();
  private decoder = new TextDecoder();

  async connect() {
    if (!window.isSecureContext) throw new Error('Bluetooth requires a secure HTTPS connection');
    const bluetooth = (navigator as Navigator & { bluetooth?: { requestDevice(options: unknown): Promise<DeviceLike> } }).bluetooth;
    if (!bluetooth) throw new Error('Web Bluetooth is not available. Use Chrome or Edge on Android/desktop with a BLE adapter.');
    this.device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PROFILES.map((profile) => profile.service),
    });
    this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);
    this.server = await this.device.gatt?.connect();
    if (!this.server) throw new Error('Could not open the adapter GATT connection');

    let lastError: unknown;
    for (const profile of PROFILES) {
      try {
        const service = await this.server.getPrimaryService(profile.service);
        this.writer = await service.getCharacteristic(profile.write);
        this.notifier = profile.notify === profile.write ? this.writer : await service.getCharacteristic(profile.notify);
        await this.notifier.startNotifications();
        this.notifier.addEventListener('characteristicvaluechanged', this.handleNotification);
        return;
      } catch (error) { lastError = error; }
    }
    this.server.disconnect();
    throw new Error(`Compatible BLE serial service was not found${lastError ? '' : '.'}`);
  }

  async disconnect() {
    if (this.pending) {
      window.clearTimeout(this.pending.timer);
      this.pending.reject(new Error('Bluetooth adapter disconnected'));
      this.pending = undefined;
    }
    this.notifier?.removeEventListener('characteristicvaluechanged', this.handleNotification);
    await this.notifier?.stopNotifications?.().catch(() => undefined);
    this.device?.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    this.device?.gatt?.disconnect();
    this.device = undefined; this.server = undefined; this.writer = undefined; this.notifier = undefined; this.buffer = '';
  }

  isConnected() { return Boolean(this.device?.gatt?.connected && this.writer && this.notifier); }

  write(command: string) {
    const exchange = this.queue.then(() => this.exchange(command));
    this.queue = exchange.catch(() => undefined);
    return exchange;
  }

  private exchange(command: string) {
    if (!this.writer || !this.isConnected()) return Promise.reject(new Error('Bluetooth adapter is not connected'));
    return new Promise<string>((resolve, reject) => {
      this.buffer = '';
      const timer = window.setTimeout(() => {
        if (this.pending?.command === command) this.pending = undefined;
        reject(new Error(`ELM327 did not answer ${command}`));
      }, 5000);
      this.pending = { resolve, reject, timer, command };
      const bytes = new TextEncoder().encode(`${command}\r`);
      const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const send = this.writer!.writeValueWithoutResponse ?? this.writer!.writeValueWithResponse ?? this.writer!.writeValue;
      if (!send) {
        window.clearTimeout(timer); this.pending = undefined; reject(new Error('BLE characteristic is not writable')); return;
      }
      send.call(this.writer, payload).catch((error: unknown) => {
        window.clearTimeout(timer); this.pending = undefined;
        reject(error instanceof Error ? error : new Error('Could not write to ELM327'));
      });
    });
  }

  private handleNotification = (event: ValueEvent) => {
    const view = event.target.value;
    if (!view || !this.pending) return;
    this.buffer += this.decoder.decode(view, { stream: true });
    if (!this.buffer.includes('>')) return;
    const pending = this.pending;
    this.pending = undefined;
    window.clearTimeout(pending.timer);
    const commandEcho = pending.command.replace(/\s/g, '').toUpperCase();
    const response = this.buffer
      .replace(/>/g, '').replace(/\0/g, '').replace(/\r/g, '\n')
      .split('\n').map((line) => line.trim()).filter(Boolean)
      .filter((line) => line.replace(/\s/g, '').toUpperCase() !== commandEcho)
      .join(' ').trim();
    pending.resolve(response || 'NO DATA');
  };

  private handleDisconnect = () => {
    if (!this.pending) return;
    window.clearTimeout(this.pending.timer);
    this.pending.reject(new Error('Bluetooth adapter disconnected'));
    this.pending = undefined;
  };
}
