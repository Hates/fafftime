// =============================================================================
// GPS UTILITY FUNCTIONS
// =============================================================================

import { FitRecord } from '../types/app-types';

/**
 * Converts GPS coordinates from Garmin's semicircle format to decimal degrees
 */
export function convertGpsCoordinates(records: FitRecord[]): [number, number][] {
  return records
    .filter(record => record.positionLat && record.positionLong)
    .map(record => [
      record.positionLat * (180 / Math.pow(2, 31)),
      record.positionLong * (180 / Math.pow(2, 31))
    ]);
}