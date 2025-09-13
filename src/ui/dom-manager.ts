// =============================================================================
// TEMPLATE & DOM HELPER FUNCTIONS
// =============================================================================

import { SlowPeriod, TimestampGap, FitRecord, FitSession } from '../types/app-types';
import { formatDuration } from '../core/time-utils';

/**
 * Creates a DOM element from a template and populates it with data
 */
export function createElementFromTemplate(templateId: string, data: Record<string, any> = {}): DocumentFragment | null {
  const template = document.getElementById(templateId) as HTMLTemplateElement;
  if (!template) {
    console.error(`Template not found: ${templateId}`);
    return null;
  }

  const clone = template.content.cloneNode(true) as DocumentFragment;

  // Fill in data fields
  Object.keys(data).forEach(key => {
    const elements = clone.querySelectorAll(`[data-field="${key}"]`);
    elements.forEach(element => {
      if (key === 'href') {
        element.href = data[key];
      } else if (data[key] instanceof HTMLElement || data[key] instanceof DocumentFragment) {
        element.appendChild(data[key]);
      } else {
        element.textContent = data[key];
      }
    });
  });

  return clone;
}

/**
 * Removes all child elements from a DOM element
 */
export function clearElement(element: HTMLElement | null): void {
  if (element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }
}

/**
 * Creates a Google Maps link element
 */
export function createGoogleMapsLink(lat: number, lng: number, text: string = '📍 View on Google Maps'): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = `https://www.google.com/maps?q=${lat},${lng}`;
  link.target = '_blank';
  link.className = 'google-maps-link';
  link.textContent = text;
  return link;
}

/**
 * Creates the complex slow periods display UI using templates
 */
export function createSlowPeriodsDisplay(slowPeriods: SlowPeriod[], selectedRangeText: string): DocumentFragment | null {
  if (slowPeriods.length === 0) {
    return createNoSlowPeriodsDisplay(selectedRangeText);
  }

  const containerElement = createSlowPeriodsContainer(slowPeriods, selectedRangeText);
  const periodsListContainer = containerElement.querySelector('[data-field="periods-list"]');

  slowPeriods.forEach((period, index) => {
    const periodElement = createPeriodElement(period, index);
    periodsListContainer.appendChild(periodElement);
  });

  return containerElement;
}

/**
 * Creates the "no slow periods found" display
 */
function createNoSlowPeriodsDisplay(selectedRangeText: string): DocumentFragment {
  return createElementFromTemplate('no-slow-periods-template', {
    'range-text': selectedRangeText
  });
}

/**
 * Creates the slow periods container with summary statistics
 */
function createSlowPeriodsContainer(slowPeriods: SlowPeriod[], selectedRangeText: string): DocumentFragment {
  const stats = calculateSlowPeriodStatistics(slowPeriods);

  return createElementFromTemplate('slow-periods-container-template', {
    'total-periods': slowPeriods.length,
    'range-text': selectedRangeText,
    'slow-count': stats.slowCount,
    'gap-count': stats.gapCount,
    'total-duration': stats.formattedTotalDuration
  });
}

/**
 * Calculates statistics for slow periods and gaps
 */
function calculateSlowPeriodStatistics(slowPeriods: SlowPeriod[]): {
  slowCount: number;
  gapCount: number;
  formattedTotalDuration: string;
} {
  const slowCount = slowPeriods.filter(period => !period.isGap).length;
  const gapCount = slowPeriods.filter(period => period.isGap).length;

  const totalSlowDuration = slowPeriods.reduce((total, period) => {
    return total + Math.round((period.endTime - period.startTime) / 1000);
  }, 0);

  return {
    slowCount,
    gapCount,
    formattedTotalDuration: formatDuration(totalSlowDuration)
  };
}

/**
 * Creates a display element for a single period (gap or slow period)
 */
function createPeriodElement(period: SlowPeriod, index: number): DocumentFragment {
  const commonData = extractCommonPeriodData(period, index);

  if (period.isGap) {
    return createGapPeriodElement(period, index, commonData);
  } else {
    return createSlowPeriodElement(period, index, commonData);
  }
}

/**
 * Extracts common data needed for both gap and slow period displays
 */
function extractCommonPeriodData(period: SlowPeriod, index: number): {
  startTime: string;
  endTime: string;
  durationText: string;
  startDistanceKm: string;
} {
  const startTime = period.startTime.toLocaleString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const endTime = period.endTime.toLocaleTimeString('en-GB');
  const duration = Math.round((period.endTime - period.startTime) / 1000);
  const durationText = formatDuration(duration);
  const startDistanceKm = (period.startDistance / 1000).toFixed(2);

  return { startTime, endTime, durationText, startDistanceKm };
}

/**
 * Creates a display element for a recording gap
 */
function createGapPeriodElement(period: SlowPeriod, index: number, commonData: any): DocumentFragment {
  const endDistanceKm = (period.endDistance / 1000).toFixed(2);
  const locationLinks = createGapLocationLinks(period.gapData);

  const gapElement = createElementFromTemplate('recording-gap-item-template', {
    'title': `⏸️ Recording Gap ${index + 1}:`,
    'time-range': `${commonData.startTime} - ${commonData.endTime}`,
    'duration': commonData.durationText,
    'distance-range': `${commonData.startDistanceKm} km → ${endDistanceKm} km`,
    'location-links': locationLinks
  });

  setupMiniMapElement(gapElement, index);
  return gapElement;
}

/**
 * Creates a display element for a slow period
 */
function createSlowPeriodElement(period: SlowPeriod, index: number, commonData: any): DocumentFragment {
  const locationLink = createSlowPeriodLocationLink(period);

  const slowPeriodElement = createElementFromTemplate('slow-period-item-template', {
    'title': `🐌 Slow Period ${index + 1}:`,
    'time-range': `${commonData.startTime} - ${commonData.endTime}`,
    'duration': commonData.durationText,
    'record-count': period.recordCount,
    'distance': commonData.startDistanceKm,
    'location-link': locationLink
  });

  setupMiniMapElement(slowPeriodElement, index);
  return slowPeriodElement;
}

/**
 * Creates location links for a recording gap
 */
function createGapLocationLinks(gapData: TimestampGap): HTMLSpanElement {
  const locationLinks = document.createElement('span');

  if (gapData.startGpsPoint) {
    const [lat, lng] = gapData.startGpsPoint;
    const startLink = createGoogleMapsLink(lat, lng, '📍 Start location');
    locationLinks.appendChild(startLink);
  }

  if (gapData.endGpsPoint) {
    if (locationLinks.hasChildNodes()) {
      locationLinks.appendChild(document.createTextNode(' | '));
    }
    const [lat, lng] = gapData.endGpsPoint;
    const endLink = createGoogleMapsLink(lat, lng, '📍 End location');
    locationLinks.appendChild(endLink);
  }

  return locationLinks;
}

/**
 * Creates location link for a slow period
 */
function createSlowPeriodLocationLink(period: SlowPeriod): HTMLSpanElement | string {
  if (!period.gpsPoints[0]) {
    return '';
  }

  const [lat, lng] = period.gpsPoints[0];
  const linkElement = createGoogleMapsLink(lat, lng);
  const locationSpan = document.createElement('span');

  locationSpan.appendChild(document.createTextNode('\n'));
  const strongElement = document.createElement('strong');
  strongElement.textContent = 'Location:';
  locationSpan.appendChild(strongElement);
  locationSpan.appendChild(document.createTextNode(' '));
  locationSpan.appendChild(linkElement);

  return locationSpan;
}

/**
 * Sets up the mini-map element for a period
 */
function setupMiniMapElement(element: DocumentFragment, index: number): void {
  const miniMapElement = element.querySelector('[data-field="mini-map"]');
  miniMapElement.id = `miniMap${index}`;
}

/**
 * Prepares the UI for FIT file parsing by clearing existing content and showing loading state
 */
export function prepareUIForParsing(): void {
  const screenshot = document.getElementById('screenshot') as HTMLElement | null;
  const activityDataElement = document.getElementById('activityData') as HTMLElement | null;

  if (screenshot) {
    clearElement(screenshot);
  }

  clearElement(activityDataElement);
  const loadingElement = createElementFromTemplate('loading-template', {
    message: '📊 Parsing FIT file...'
  });
  activityDataElement.appendChild(loadingElement);
}

/**
 * Handles errors that occur during FIT file parsing
 */
export function handleFitParsingError(error: Error): void {
  const activityDataElement = document.getElementById('activityData') as HTMLElement | null;

  clearElement(activityDataElement);
  const errorElement = createElementFromTemplate('error-template', {
    message: `❌ Error parsing FIT file: ${error.message}`
  });
  if (activityDataElement) activityDataElement.appendChild(errorElement);
  console.error('FIT parsing error:', error);
}

/**
 * Creates the activity summary header element
 */
export function createActivitySummaryHeader(fileName: string): DocumentFragment {
  return createElementFromTemplate('activity-summary-template', {
    title: `📁 FIT File Analysis: ${fileName}`
  });
}

/**
 * Creates the activity times display element
 */
export function createActivityTimesElement(
  startTime: Date,
  endTime: Date,
  totalDistance: number | null,
  totalSlowDuration: number
): DocumentFragment {
  const duration = Math.round((endTime - startTime) / 1000);
  const estimatedMovingTime = Math.max(0, duration - totalSlowDuration);

  const activityTimesData = {
    'start-time': startTime.toLocaleString(),
    'end-time': endTime.toLocaleString(),
    'duration': formatDuration(duration),
    'stopped-time': formatDuration(totalSlowDuration),
    'moving-time': formatDuration(estimatedMovingTime)
  };

  if (totalDistance != null) {
    const distanceKm = (totalDistance / 1000).toFixed(2);
    const distanceMiles = (totalDistance * 0.000621371).toFixed(2);
    activityTimesData.distance = `${distanceKm} km (${distanceMiles} miles)`;
  }

  const activityTimesElement = createElementFromTemplate('activity-times-template', activityTimesData);

  const distanceInfo = activityTimesElement.querySelector('[data-field="distance-info"]');
  if (totalDistance != null) {
    distanceInfo.style.display = 'block';
  }

  return activityTimesElement;
}

/**
 * Handles the case where timing data is missing from the FIT file
 */
export function handleMissingTimeData(activitySummaryElement: DocumentFragment): void {
  const warningElement = createElementFromTemplate('warning-message-template', {
    message: '⚠️ Could not determine start/end times from this FIT file.'
  });
  activitySummaryElement.appendChild(warningElement);
}

/**
 * Updates the DOM with the analysis results
 */
export function updateDOMWithResults(
  activitySummaryElement: DocumentFragment,
  slowPeriodsDataElement: DocumentFragment | null
): void {
  const activitySummaryDOMElement = document.getElementById('activitySummary');
  const slowPeriodDOMElement = document.getElementById('slowPeriodData');
  const timestampGapDataElement = document.getElementById('timestampGapData');

  clearElement(activitySummaryDOMElement);
  activitySummaryDOMElement.appendChild(activitySummaryElement);

  clearElement(slowPeriodDOMElement);
  if (slowPeriodsDataElement) {
    slowPeriodDOMElement.appendChild(slowPeriodsDataElement);
  }

  clearElement(timestampGapDataElement);
}

/**
 * Displays file summary information
 */
export function displayFileSummary(records: FitRecord[], sessions: FitSession[], timestampGaps: TimestampGap[]): void {
  const activityDataElement = document.getElementById('activityData') as HTMLElement | null;

  const fileSummaryElement = createElementFromTemplate('file-summary-template', {
    'total-records': records.length,
    'sessions-found': sessions.length,
    'timestamp-gaps': timestampGaps.length
  });

  clearElement(activityDataElement);
  activityDataElement.appendChild(fileSummaryElement);
}