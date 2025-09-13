// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

import { TimeRange } from '../types/app-types';

export const RANGE_LABELS: Record<TimeRange, string> = {
  '2to5': '2-5 minutes',
  '5to10': '5-10 minutes',
  '10to30': '10-30 minutes',
  '30to60': '30-60 minutes',
  '1to2hours': '1-2 hours',
  'over2hours': 'Over 2 hours'
};

export const SPEED_THRESHOLD: number = 0.75; // m/s threshold for slow periods