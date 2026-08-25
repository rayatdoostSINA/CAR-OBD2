import type { OBDTransport } from './transport';

export class WifiTransport implements OBDTransport {
  readonly name = 'WiFi ELM327';
  private socket?: WebSocket;
  constructor(private endpoint = 'ws://192.168.0.10:35000') {}
  connect() { return new Promise<void>((resolve, reject) => { this.socket = new WebSocket(this.endpoint); this.socket.onopen = () => resolve(); this.socket.onerror = () => reject(new Error('Could not connect to the WiFi adapter')); }); }
  async disconnect() { this.socket?.close(); this.socket = undefined; }
  isConnected() { return this.socket?.readyState === WebSocket.OPEN; }
  write(command: string) { return new Promise<string>((resolve, reject) => { if (!this.socket || !this.isConnected()) return reject(new Error('WiFi adapter is not connected')); const timeout = window.setTimeout(() => reject(new Error('Adapter response timed out')), 3000); this.socket.addEventListener('message', (event) => { window.clearTimeout(timeout); resolve(String(event.data)); }, { once: true }); this.socket.send(`${command}\r`); }); }
}
