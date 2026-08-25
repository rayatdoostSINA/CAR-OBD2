import { BaseTransport } from './Transport';

interface BluetoothDeviceLike {
  name?: string;
  gatt?: {
    connected?: boolean;
    connect: () => Promise<BluetoothRemoteGATTServerLike>;
    disconnect: () => void;
  };
  addEventListener: (type: string, listener: () => void) => void;
}

interface BluetoothRemoteGATTServerLike {
  getPrimaryService: (service: string) => Promise<BluetoothRemoteGATTServiceLike>;
  getPrimaryServices: () => Promise<BluetoothRemoteGATTServiceLike[]>;
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristicLike[]>;
}

interface BluetoothRemoteGATTCharacteristicLike {
  properties: {
    write?: boolean;
    writeWithoutResponse?: boolean;
    notify?: boolean;
    indicate?: boolean;
    read?: boolean;
  };
  startNotifications: () => Promise<BluetoothRemoteGATTCharacteristicLike>;
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  writeValueWithoutResponse?: (data: BufferSource) => Promise<void>;
  writeValueWithResponse?: (data: BufferSource) => Promise<void>;
  writeValue: (data: BufferSource) => Promise<void>;
}

interface QueuedCommand {
  command: string;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}

export class WebBluetoothTransport extends BaseTransport {
  private device: BluetoothDeviceLike | null = null;
  private server: BluetoothRemoteGATTServerLike | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;
  private receiveBuffer: string = '';
  private pendingResolver: ((value: string) => void) | null = null;
  private pendingRejecter: ((reason?: unknown) => void) | null = null;
  private responseTimeout: ReturnType<typeof setTimeout> | null = null;

  // Queue to serialize commands and prevent buffer clobbering
  private commandQueue: QueuedCommand[] = [];
  private isProcessingQueue: boolean = false;
  private isExplicitDisconnect: boolean = false;
  private isAutoReconnecting: boolean = false;
  private autoReconnectAttempts: number = 0;

  // Well known BLE ELM327 Services
  private static readonly BLE_SERVICES = [
    '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard BLE OBD (Vgate, Viecar, generic ELM327)
    '0000fff0-0000-1000-8000-00805f9b34fb',
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // OBDLink MX+
    '000018f0-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455'  // ISSC BLE
  ];

  public async connect(): Promise<boolean> {
    if (!navigator || !('bluetooth' in navigator)) {
      this.updateStatus('error', 'Web Bluetooth API is not supported in this browser. On iPhone/iOS, please open this app inside Bluefy Browser. On Android/PC, use Chrome or Edge.');
      throw new Error('Web Bluetooth not supported');
    }

    try {
      this.isExplicitDisconnect = false;
      this.autoReconnectAttempts = 0;
      this.updateStatus('connecting', 'Searching for Bluetooth ELM327 OBD-II...');

      // Use acceptAllDevices with optionalServices to allow finding any ELM327 BLE device
      const nav = navigator as unknown as { bluetooth: { requestDevice: (options: { acceptAllDevices: boolean; optionalServices: string[] }) => Promise<BluetoothDeviceLike> } };
      this.device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: WebBluetoothTransport.BLE_SERVICES
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.handleGattDisconnected();
      });

      return await this.setupGattConnection();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotFoundError' || errMsg.toLowerCase().includes('cancel') || errMsg.toLowerCase().includes('user cancelled')) {
        this.updateStatus('disconnected', 'Bluetooth device selection was cancelled.');
        const cancelErr = new Error('Bluetooth device selection was cancelled.');
        (cancelErr as unknown as { isCancelled: boolean }).isCancelled = true;
        throw cancelErr;
      }
      this.updateStatus('error', errMsg || 'Bluetooth connection failed');
      throw err;
    }
  }

  private async setupGattConnection(): Promise<boolean> {
    if (!this.device || !this.device.gatt) {
      throw new Error('Bluetooth device GATT server not available');
    }
    this.updateStatus('connecting', `Connecting to ${this.device.name || 'OBD Adapter'}...`);
    this.server = await this.device.gatt.connect();

    // Discover supported service
    let service: BluetoothRemoteGATTServiceLike | null = null;
    for (const serviceUuid of WebBluetoothTransport.BLE_SERVICES) {
      try {
        service = await this.server.getPrimaryService(serviceUuid);
        if (service) break;
      } catch {
        // continue checking
      }
    }

    if (!service) {
      try {
        const services = await this.server.getPrimaryServices();
        if (services && services.length > 0) {
          service = services[0];
        }
      } catch {}
    }

    if (!service) {
      throw new Error('No compatible OBD BLE UART service found on device.');
    }

    const characteristics = await service.getCharacteristics();
    for (const char of characteristics) {
      const props = char.properties;
      if (props.write || props.writeWithoutResponse) {
        this.txCharacteristic = char;
      }
      if (props.notify || props.indicate || props.read) {
        this.rxCharacteristic = char;
      }
    }

    if (!this.txCharacteristic && this.rxCharacteristic) {
      this.txCharacteristic = this.rxCharacteristic;
    }
    if (!this.rxCharacteristic && this.txCharacteristic) {
      this.rxCharacteristic = this.txCharacteristic;
    }

    if (!this.rxCharacteristic || !this.txCharacteristic) {
      throw new Error('Could not resolve RX/TX characteristics on ELM327 adapter.');
    }

    await this.rxCharacteristic.startNotifications();
    this.rxCharacteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
      const target = event.target as unknown as { value?: DataView };
      const value = target?.value;
      if (value) {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(value);
        this.handleIncomingData(text);
      }
    });

    this.autoReconnectAttempts = 0;
    this.isAutoReconnecting = false;
    this.updateStatus('connected', `Connected to ${this.device.name || 'ELM327 BLE Adapter'}`);
    return true;
  }

  private async handleGattDisconnected(): Promise<void> {
    if (this.isExplicitDisconnect) {
      this.updateStatus('disconnected', 'Disconnected');
      return;
    }

    // Unexpected disconnect - attempt silent auto-reconnect without prompting user
    if (this.device && this.device.gatt && !this.isAutoReconnecting && this.autoReconnectAttempts < 5) {
      this.isAutoReconnecting = true;
      this.autoReconnectAttempts++;
      this.updateStatus('connecting', `Bluetooth link lost. Auto-reconnecting (attempt ${this.autoReconnectAttempts}/5)...`);

      // Flush queue error
      this.flushQueue(new Error('Bluetooth connection interrupted'));

      try {
        await new Promise(r => setTimeout(r, 1200));
        await this.setupGattConnection();
        return;
      } catch (err) {
        console.warn('Auto-reconnect failed:', err);
      } finally {
        this.isAutoReconnecting = false;
      }
    }

    this.updateStatus('disconnected', 'Bluetooth disconnected. Tap Reconnect to resume.');
  }

  public async disconnect(): Promise<void> {
    this.isExplicitDisconnect = true;
    this.flushQueue(new Error('Connection closed by user'));

    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      try {
        this.device.gatt.disconnect();
      } catch {}
    }
    this.device = null;
    this.server = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.updateStatus('disconnected', 'Disconnected');
  }

  public async send(command: string): Promise<string> {
    if (!this.isConnected() || !this.txCharacteristic) {
      throw new Error('Bluetooth adapter not connected');
    }

    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const item = this.commandQueue.shift()!;

    try {
      const response = await this.executeSingleCommand(item.command);
      item.resolve(response);
    } catch (err) {
      item.reject(err);
    } finally {
      this.isProcessingQueue = false;
      // Process next item immediately if available
      if (this.commandQueue.length > 0) {
        setTimeout(() => this.processQueue(), 10);
      }
    }
  }

  private executeSingleCommand(command: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      if (!this.isConnected() || !this.txCharacteristic) {
        reject(new Error('Bluetooth adapter disconnected'));
        return;
      }

      this.receiveBuffer = '';
      this.pendingResolver = resolve;
      this.pendingRejecter = reject;

      // Safe timeout for OBD responses (2200ms)
      this.responseTimeout = setTimeout(() => {
        if (this.pendingResolver) {
          if (this.receiveBuffer.length > 0) {
            resolve(this.receiveBuffer);
          } else {
            reject(new Error(`Timeout waiting for response to: ${command}`));
          }
          this.pendingResolver = null;
          this.pendingRejecter = null;
        }
      }, 2200);

      try {
        const encoder = new TextEncoder();
        const fullPayload = encoder.encode(command.trim() + '\r');
        
        // Chunk write to max 20 bytes (iOS BLE MTU safe)
        const CHUNK_SIZE = 20;
        for (let i = 0; i < fullPayload.length; i += CHUNK_SIZE) {
          const chunk = fullPayload.slice(i, i + CHUNK_SIZE);
          if (this.txCharacteristic.writeValueWithoutResponse) {
            try {
              await this.txCharacteristic.writeValueWithoutResponse(chunk);
            } catch {
              await this.txCharacteristic.writeValue(chunk);
            }
          } else if (this.txCharacteristic.writeValueWithResponse) {
            await this.txCharacteristic.writeValueWithResponse(chunk);
          } else {
            await this.txCharacteristic.writeValue(chunk);
          }
          if (i + CHUNK_SIZE < fullPayload.length) {
            await new Promise(r => setTimeout(r, 12));
          }
        }
      } catch (err) {
        if (this.responseTimeout) {
          clearTimeout(this.responseTimeout);
          this.responseTimeout = null;
        }
        this.pendingResolver = null;
        this.pendingRejecter = null;
        reject(err);
      }
    });
  }

  private handleIncomingData(chunk: string): void {
    this.receiveBuffer += chunk;
    if (this.events.onData) {
      this.events.onData(chunk);
    }

    // ELM327 terminates responses with prompt '>'
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
        this.pendingRejecter = null;
        resolver(fullResponse);
      }
    }
  }

  private flushQueue(err: Error): void {
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    if (this.pendingRejecter) {
      this.pendingRejecter(err);
      this.pendingResolver = null;
      this.pendingRejecter = null;
    }
    while (this.commandQueue.length > 0) {
      const item = this.commandQueue.shift();
      if (item) item.reject(err);
    }
    this.isProcessingQueue = false;
  }
}

