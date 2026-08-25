export type ConnectionMode = 'bluetooth' | 'wifi' | 'simulator';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PIDDefinition {
  id: string; name: string; englishName: string; persianName: string;
  service: string; pid: string; formula: string; unit: string;
  min: number; max: number; category: string; pollingPriority: number;
}

export interface LiveReading { pid: string; value: number | null; supported: boolean; timestamp: number; }
export interface DTCRecord { code: string; englishDescription: string; persianDescription: string; possibleCauses: { en: string; fa: string }[]; severity: 'low' | 'medium' | 'high'; status?: 'stored' | 'pending'; }
export interface VehicleProfile { manufacturer: string; model: string; year: string; engine: string; protocol: string; supportedPID: string[]; customPID: unknown[]; }
