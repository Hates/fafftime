// =============================================================================
// MAIN APPLICATION ENTRY POINT
// =============================================================================

import './styles.css';

// Type imports
import { FitData } from './types/app-types';

// Core functionality imports
import { decodeFitFile, extractActivityTimes } from './core/fit-parser';
import { findSlowPeriodsWithRanges, findTimestampGaps, processSlowSequence } from './core/data-analyzer';
import { formatDuration, getSelectedRanges, getSelectedRangeText, matchesTimeRange, getCurrentTimestampGapThreshold } from './core/time-utils';

// UI functionality imports
import {
  prepareUIForParsing,
  handleFitParsingError,
  createActivitySummaryHeader,
  createActivityTimesElement,
  handleMissingTimeData,
  updateDOMWithResults,
  displayFileSummary,
  createSlowPeriodsDisplay
} from './ui/dom-manager';

import {
  initializeMap,
  updateMapOverlays,
  setCurrentSlowPeriods,
  initializeCombinedMiniMaps,
  getActivityMap
} from './ui/map-manager';

import {
  initializeEventHandlers,
  setCurrentFitData,
  getCurrentFitData,
  updateUIForExampleFile
} from './ui/event-handlers';

// Utility imports
import { convertGpsCoordinates } from './utils/gps-utils';

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

// Only initialize DOM-dependent code if we're in a browser environment
if (typeof window !== 'undefined') {
  // Initialize event handlers with callback functions
  initializeEventHandlers(parseFitFile, displayActivityData, loadExampleFile);
}

// =============================================================================
// HIGH-LEVEL ORCHESTRATION FUNCTIONS
// =============================================================================

/**
 * Helper function to parse FIT file
 */
async function parseFitFile(file: File): Promise<void> {
  try {
    prepareUIForParsing();
    const fitData = await decodeFitFile(file);
    processSuccessfulFitParsing(fitData, file.name);
  } catch (error) {
    handleFitParsingError(error);
  }
}

/**
 * Processes successfully parsed FIT data and updates the application state
 */
function processSuccessfulFitParsing(fitData: FitData, fileName: string): void {
  // Store data for reanalysis
  setCurrentFitData(fitData, fileName);

  // Show analysis controls
  const analysisControlsElement = document.getElementById('analysisControls') as HTMLElement | null;
  if (analysisControlsElement) analysisControlsElement.style.display = 'block';

  // Extract activity information
  displayActivityData(fitData, fileName);

  // Initialize map with GPS data
  initializeMap(fitData);
}

/**
 * Loads and processes the example FIT file from the server
 */
async function loadExampleFile(): Promise<void> {
  try {
    // Clear screenshot and show loading message
    const screenshot = document.getElementById('screenshot') as HTMLElement | null;
    const activityDataElement = document.getElementById('activityData') as HTMLElement | null;

    if (screenshot) {
      while (screenshot.firstChild) {
        screenshot.removeChild(screenshot.firstChild);
      }
    }

    if (activityDataElement) {
      while (activityDataElement.firstChild) {
        activityDataElement.removeChild(activityDataElement.firstChild);
      }
    }

    // Show loading state
    prepareUIForParsing();

    // Fetch the example file
    const response = await fetch('GreatBritishEscapades2025.fit');
    if (!response.ok) {
      throw new Error(`Failed to load example file: ${response.status}`);
    }

    // Get the file as array buffer and decode
    const arrayBuffer = await response.arrayBuffer();
    const file = new File([arrayBuffer], 'GreatBritishEscapades2025.fit', { type: 'application/octet-stream' });
    const fitData = await decodeFitFile(file);

    processSuccessfulFitParsing(fitData, 'GreatBritishEscapades2025.fit');

    // Update UI to show example file loaded
    updateUIForExampleFile('GreatBritishEscapades2025.fit');

  } catch (error) {
    handleFitParsingError(error);
  }
}

/**
 * Main function to process FIT data and update the UI
 * Orchestrates data extraction, analysis, and display
 */
function displayActivityData(fitData: FitData, fileName: string): void {
  const sessions = fitData.sessionMesgs || [];
  const records = fitData.recordMesgs || [];
  const timestampGaps = findTimestampGaps(records);

  const { startTime, endTime, movingTime, totalDistance } = extractActivityTimes(sessions, records);
  const activitySummaryElement = createActivitySummaryHeader(fileName);

  if (startTime && endTime) {
    const slowPeriodsData = processSlowPeriodsAnalysis(records, startTime, endTime);
    const activityTimesElement = createActivityTimesElement(
      startTime, endTime, totalDistance, slowPeriodsData.totalSlowDuration
    );

    activitySummaryElement.appendChild(activityTimesElement);
    updateDOMWithResults(activitySummaryElement, slowPeriodsData.slowPeriodsDataElement);

    const activityMap = getActivityMap();
    if (activityMap) {
      updateMapOverlays();
    }
  } else {
    handleMissingTimeData(activitySummaryElement);
    updateDOMWithResults(activitySummaryElement, null);
  }

  displayFileSummary(records, sessions, timestampGaps);
}

/**
 * Processes slow periods analysis and returns structured data
 */
function processSlowPeriodsAnalysis(records: any[], startTime: Date, endTime: Date): {
  slowPeriodsDataElement: DocumentFragment | null;
  totalSlowDuration: number;
} {
  const selectedRanges = getSelectedRanges();
  const slowPeriods = findSlowPeriodsWithRanges(records, selectedRanges);

  setCurrentSlowPeriods(slowPeriods);

  const selectedRangeText = getSelectedRangeText(selectedRanges);
  const slowPeriodsDataElement = createSlowPeriodsDisplay(slowPeriods, selectedRangeText);

  if (slowPeriods.length > 0) {
    setTimeout(() => {
      initializeCombinedMiniMaps(slowPeriods);
    }, 100);
  }

  const totalSlowDuration = slowPeriods.reduce((total, period) => {
    return total + Math.round((period.endTime - period.startTime) / 1000);
  }, 0);

  return { slowPeriodsDataElement, totalSlowDuration };
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export {
  extractActivityTimes,
  findTimestampGaps,
  findSlowPeriodsWithRanges,
  processSlowSequence,
  formatDuration,
  matchesTimeRange,
  convertGpsCoordinates
};