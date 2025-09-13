// =============================================================================
// TIME UTILITY FUNCTIONS
// =============================================================================

import { TimeRange } from '../types/app-types';
import { RANGE_LABELS } from '../utils/constants';

/**
 * Formats a duration in seconds to a human-readable string
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds >= 3600) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else {
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Gets the currently selected time range filters from checkboxes
 */
export function getSelectedRanges(): TimeRange[] {
  const thresholdCheckboxes: Record<TimeRange, HTMLInputElement | null> = {
    '2to5': document.getElementById('threshold_2to5') as HTMLInputElement | null,
    '5to10': document.getElementById('threshold_5to10') as HTMLInputElement | null,
    '10to30': document.getElementById('threshold_10to30') as HTMLInputElement | null,
    '30to60': document.getElementById('threshold_30to60') as HTMLInputElement | null,
    '1to2hours': document.getElementById('threshold_1to2hours') as HTMLInputElement | null,
    'over2hours': document.getElementById('threshold_over2hours') as HTMLInputElement | null
  };

  return Object.entries(thresholdCheckboxes)
    .filter(([key, checkbox]) => checkbox?.checked)
    .map(([key, checkbox]) => key as TimeRange);
}

/**
 * Converts selected time range keys to human-readable text
 */
export function getSelectedRangeText(selectedRanges: TimeRange[]): string {
  return selectedRanges.map(range => RANGE_LABELS[range]).join(', ');
}

/**
 * Checks if a duration matches a specific time range category
 */
export function matchesTimeRange(range: TimeRange, durationMinutes: number, durationHours: number): boolean {
  switch (range) {
    case '2to5': return durationMinutes >= 2 && durationMinutes < 5;
    case '5to10': return durationMinutes >= 5 && durationMinutes < 10;
    case '10to30': return durationMinutes >= 10 && durationMinutes < 30;
    case '30to60': return durationMinutes >= 30 && durationMinutes < 60;
    case '1to2hours': return durationHours >= 1 && durationHours < 2;
    case 'over2hours': return durationHours >= 2;
    default: return false;
  }
}

/**
 * Gets the current timestamp gap threshold from the dropdown selection
 */
export function getCurrentTimestampGapThreshold(): number {
  const timestampGapThresholdSelect = document.getElementById('timestampGapThreshold') as HTMLSelectElement | null;
  return parseInt(timestampGapThresholdSelect?.value || '300000');
}