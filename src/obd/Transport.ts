export interface TransportEvents {
  onData?: (data: string) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting', message?: string) => void;
  onError?: (error: Error) => void;
}

export abstract class BaseTransport {
  protected status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting' = 'disconnected';
  protected events: TransportEvents = {};

  public setEventListeners(events: TransportEvents): void {
    this.events = { ...this.events, ...events };
  }

  public getStatus(): 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting' {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === 'connected';
  }

  protected updateStatus(status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting', message?: string): void {
    this.status = status;
    if (this.events.onStatusChange) {
      this.events.onStatusChange(status, message);
    }
  }

  public abstract connect(): Promise<boolean>;
  public abstract disconnect(): Promise<void>;
  public abstract send(command: string): Promise<string>;
}
