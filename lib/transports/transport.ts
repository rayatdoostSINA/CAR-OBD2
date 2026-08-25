export interface OBDTransport {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(command: string): Promise<string>;
  isConnected(): boolean;
}
