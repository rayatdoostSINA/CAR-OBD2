export type ConnectionType = 'simulator' | 'bluetooth' | 'wifi';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export type Language = 'fa' | 'en';
export type GaugeMode = 'cyber-hud' | 'sport-race' | 'matrix-grid' | 'minimal-hud' | 'cyber' | 'sport' | 'matrix' | 'minimal';
export type ThemeColor = 'cyber-cyan' | 'sport-red' | 'racing-amber' | 'lime-matrix' | 'arctic-ice' | 'stealth-dark';

export type PollingPriority = 'high' | 'medium' | 'low';
export type ParameterStatus = 'normal' | 'warning' | 'critical' | 'unsupported';
export type DTCSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface PIDDefinition {
  id: string; // e.g. "010C"
  name: string; // e.g. "RPM"
  englishName: string;
  persianName: string;
  service: string; // e.g. "01"
  pid: string; // e.g. "0C"
  bytes?: number;
  formula: string;
  unit: string;
  min: number;
  max: number;
  category: string;
  pollingPriority: PollingPriority;
  warningThreshold?: number;
  criticalThreshold?: number;
  description?: string;
}

export interface TelemetryValue {
  value: number | null;
  displayValue: string;
  unit: string;
  rawHex: string;
  timestamp: number;
  isSupported: boolean;
  status: ParameterStatus;
  minPeak: number | null;
  maxPeak: number | null;
}

export interface DTCRecord {
  code: string;
  system: string;
  persianSystem: string;
  englishDescription: string;
  persianDescription: string;
  severity: DTCSeverity;
  persianSeverity: string;
  possibleCauses: string[];
  persianPossibleCauses: string[];
  symptoms: string[];
  persianSymptoms: string[];
  recommendedAction: string;
  persianRecommendedAction: string;
  status?: 'stored' | 'pending' | 'permanent';
  timestamp?: number;
  freezeFrame?: FreezeFrameData;
}

export interface FreezeFrameData {
  rpm?: number;
  speed?: number;
  ect?: number;
  load?: number;
  fuelPressure?: number;
  timeSinceStart?: number;
}

export interface ModuleDTCGroup {
  moduleId: string; // 'ECM' | 'TCM' | 'ABS' | 'SRS' | 'BCM' | '4WD';
  moduleName: string;
  persianModuleName: string;
  header: string;
  dtcs: string[];
  status?: 'healthy' | 'faults_found' | 'no_response' | 'error';
}

export interface VehicleProfile {
  id: string;
  manufacturer: string;
  persianManufacturer: string;
  model: string;
  persianModel: string;
  year: string;
  engine: string;
  ecu: string;
  protocol: string;
  fuelTankCapacity: number;
  redlineRpm: number;
  normalEctRange: [number, number];
  supportedPID: string[];
  unsupportedPID: string[];
  notes?: string;
  isAutoDetected?: boolean;
  vin?: string;
  gearRatios?: number[]; // [1st, 2nd, 3rd, 4th, 5th, 6th]
  reverseRatio?: number;
  finalDriveRatio?: number;
  isTurbocharged?: boolean;
  engineDisplacementL?: number;
}

export interface DetectedVehicleInfo {
  isAutoDetected: boolean;
  vin: string;
  ecuName: string;
  protocol: string;
  matchedVehicle: VehicleProfile;
  detectedSupportedPIDs: string[];
  confidence: 'high' | 'medium' | 'fallback';
  timestamp: number;
}

export interface TripStats {
  distanceKm: number;
  durationSeconds: number;
  maxSpeed: number;
  avgSpeed: number;
  maxRpm: number;
  maxEct: number;
  fuelConsumedLiters: number;
  startTimestamp: number;
}

export interface AccelerationRun {
  date: string;
  targetSpeed: number; // 100
  timeSeconds: number;
  maxGForce: number;
  dataPoints: { time: number; speed: number; rpm: number }[];
}

export interface BrakingRun {
  date: string;
  startSpeed: number; // 100 or 60
  timeSeconds: number;
  distanceMeters: number;
  maxDecelG: number;
  dataPoints: { time: number; speed: number; distance: number }[];
}

export interface InclinometerTelemetry {
  pitch: number; // -45 to +45
  roll: number;  // -45 to +45
  altitude: number; // meters
  heading: number; // 0-360 degrees
  gForceX: number; // lateral
  gForceY: number; // longitudinal
  peakG: number;
}

export interface DashboardWidgetConfig {
  id: string;
  pidId: string;
  customLabel?: string;
  gaugeType: 'digital' | 'radial' | 'bar' | 'compact' | 'graph';
  size: 'sm' | 'md' | 'lg' | 'xl';
  showPeaks?: boolean;
}

export interface CustomDashboardLayout {
  id: string;
  name: string;
  widgets: DashboardWidgetConfig[];
}

export interface PIDEngineListener {
  onTelemetryUpdate?: (telemetry: Record<string, TelemetryValue>) => void;
  onAlertTriggered?: (type: 'redline' | 'overheat' | 'low_voltage' | 'speed', value: number, label: string) => void;
  onTripUpdate?: (trip: TripStats) => void;
  onAccelerationUpdate?: (accel: { isArmed: boolean; isRunning: boolean; currentSpeed: number; elapsedTime: number; bestTime: number | null }) => void;
  onConnectionStatus?: (connected: boolean) => void;
}

export interface UserPreferences {
  language: Language;
  theme: ThemeColor;
  gaugeMode: GaugeMode;
  speedUnit: 'km/h' | 'mph';
  tempUnit: '°C' | '°F';
  pressureUnit: 'kPa' | 'psi' | 'bar';
  soundAlerts: boolean;
  highEctAlert: number;
  redlineAlert: number;
  lowVoltageAlert: number;
  speedAlert: number;
  selectedVehicleId: string;
  activeLayout: string;
}
