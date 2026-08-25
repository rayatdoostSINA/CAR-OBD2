import { BaseTransport } from './Transport';

export class WiFiTransport extends BaseTransport {
  private ipAddress: string = '192.168.0.10';
  private port: number = 35000;
  private ws: WebSocket | null = null;
  private receiveBuffer: string = '';
  private pendingResolver: ((value: string) => void) | null = null;
  private responseTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(ipAddress: string = '192.168.0.10', port: number = 35000) {
    super();
    this.ipAddress = ipAddress;
    this.port = port;
  }

  public setEndpoint(ipAddress: string, port: number): void {
    this.ipAddress = ipAddress;
    this.port = port;
  }

  public async connect(): Promise<boolean> {
    this.updateStatus('connecting', `Connecting to WiFi OBD adapter at ${this.ipAddress}:${this.port}...`);

    return new Promise((resolve, reject) => {
      try {
        // Attempt WebSocket bridge connection or fallback to direct TCP proxy
        const wsUrl = `ws://${this.ipAddress}:${this.port}`;
        this.ws = new WebSocket(wsUrl);

        const connectionTimeout = setTimeout(() => {
          if (this.status === 'connecting') {
            this.updateStatus('error', `Connection timed out connecting to ${this.ipAddress}:${this.port}. Note: Direct TCP sockets in browser require a local bridge or WebSocket proxy.`);
            if (this.ws) this.ws.close();
            reject(new Error('WiFi OBD connection timed out'));
          }
        }, 4000);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.updateStatus('connected', `Connected to WiFi ELM327 at ${this.ipAddress}:${this.port}`);
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          const text = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
          this.handleIncomingData(text);
        };

        this.ws.onerror = (err) => {
          clearTimeout(connectionTimeout);
          this.updateStatus('error', `WiFi socket error on ${this.ipAddress}:${this.port}`);
          reject(err);
        };

        this.ws.onclose = () => {
          this.updateStatus('disconnected', 'WiFi connection closed');
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.updateStatus('error', errMsg || 'WiFi connection failed');
        reject(err);
      }
    });
  }

  public async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateStatus('disconnected', 'Disconnected from WiFi adapter');
  }

  public async send(command: string): Promise<string> {
    if (!this.isConnected() || !this.ws) {
      throw new Error('WiFi adapter not connected');
    }

    this.receiveBuffer = '';

    return new Promise((resolve, reject) => {
      this.pendingResolver = resolve;

      this.responseTimeout = setTimeout(() => {
        if (this.pendingResolver) {
          if (this.receiveBuffer.length > 0) {
            resolve(this.receiveBuffer);
          } else {
            reject(new Error(`Timeout waiting for WiFi OBD response: ${command}`));
          }
          this.pendingResolver = null;
        }
      }, 3500);

      this.ws?.send(command.trim() + '\r\n');
    });
  }

  private handleIncomingData(chunk: string): void {
    this.receiveBuffer += chunk;
    if (this.events.onData) {
      this.events.onData(chunk);
    }

    if (this.receiveBuffer.includes('>')) {
      if (this.responseTimeout) {
        clearTimeout(this.responseTimeout);
        this.responseTimeout = null;
      }
      if (this.pendingResolver) {
        const fullResponse = this.receiveBuffer;
        this.receiveBuffer = '';
        const resolver = this.pendingResolver;
        this.pendingResolver = null;
        resolver(fullResponse);
      }
    }
  }
}
