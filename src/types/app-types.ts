// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface FitRecord {
  timestamp?: Date;
  speed?: number;
  enhancedSpeed?: number;
  distance?: number;
  positionLat?: number;
  positionLong?: number;
  [key: string]: any;
}

export interface FitSession {
  startTime?: Date;
  totalTimerTime?: number;
  totalElapsedTime?: number;
  totalDistance?: number;
  [key: string]: any;
}

export interface FitActivity {
  [key: string]: any;
}

export interface FitData {
  sessionMesgs?: FitSession[];
  recordMesgs?: FitRecord[];
  activityMesgs?: FitActivity[];
  [key: string]: any;
}

export interface ActivityTimes {
  startTime: Date | null;
  endTime: Date | null;
  movingTime: number | null;
  totalDistance: number | null;
}

export interface TimestampGap {
  startTime: Date;
  endTime: Date;
  gapDuration: number;
  gapDurationMinutes: number;
  gapDurationHours: number;
  startDistance: number;
  endDistance: number;
  startGpsPoint: [number, number] | null;
  endGpsPoint: [number, number] | null;
}

export interface SlowPeriod {
  startTime: Date;
  endTime: Date;
  recordCount: number;
  startDistance: number;
  endDistance: number;
  gpsPoints: [number, number][];
  isGap?: boolean;
  gapData?: TimestampGap;
}

export type TimeRange = '2to5' | '5to10' | '10to30' | '30to60' | '1to2hours' | 'over2hours';