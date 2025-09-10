import { Decoder, Stream } from '@garmin/fitsdk';
import './styles.css';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface FitRecord {
  timestamp?: Date;
  speed?: number;
  enhancedSpeed?: number;
  distance?: number;
  positionLat?: number;
  positionLong?: number;
  [key: string]: any;
}

interface FitSession {
  startTime?: Date;
  totalTimerTime?: number;
  totalElapsedTime?: number;
  totalDistance?: number;
  [key: string]: any;
}

interface FitActivity {
  [key: string]: any;
}

interface FitData {
  sessionMesgs?: FitSession[];
  recordMesgs?: FitRecord[];
  activityMesgs?: FitActivity[];
  [key: string]: any;
}

interface ActivityTimes {
  startTime: Date | null;
  endTime: Date | null;
  movingTime: number | null;
  totalDistance: number | null;
}

interface TimestampGap {
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

interface SlowPeriod {
  startTime: Date;
  endTime: Date;
  recordCount: number;
  startDistance: number;
  endDistance: number;
  gpsPoints: [number, number][];
  isGap?: boolean;
  gapData?: TimestampGap;
}

type TimeRange = '2to5' | '5to10' | '10to30' | '30to60' | '1to2hours' | 'over2hours';

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const RANGE_LABELS: Record<TimeRange, string> = {
  '2to5': '2-5 minutes',
  '5to10': '5-10 minutes',
  '10to30': '10-30 minutes', 
  '30to60': '30-60 minutes',
  '1to2hours': '1-2 hours',
  'over2hours': 'Over 2 hours'
};

const SPEED_THRESHOLD: number = 0.75; // m/s threshold for slow periods

// =============================================================================
// DOM ELEMENTS & GLOBAL STATE
// =============================================================================

const fileInput = document.getElementById('fitFile') as HTMLInputElement | null;
const screenshot = document.getElementById('screenshot') as HTMLElement | null;
const parseButton = document.getElementById('parseButton') as HTMLButtonElement | null;
const activityDataElement = document.getElementById('activityData') as HTMLElement | null;
const timestampGapDataElement = document.getElementById('timestampGapData') as HTMLElement | null;
const analysisControlsElement = document.getElementById('analysisControls') as HTMLElement | null;
const mapContainerElement = document.getElementById('mapContainer') as HTMLElement | null;
const showPeriodsOnMapCheckbox = document.getElementById('showPeriodsOnMap') as HTMLInputElement | null;
const loadExampleFileLink = document.getElementById('loadExampleFile') as HTMLAnchorElement | null;
const timestampGapThresholdSelect = document.getElementById('timestampGapThreshold') as HTMLSelectElement | null;

const thresholdCheckboxes: Record<TimeRange, HTMLInputElement | null> = {
  '2to5': document.getElementById('threshold_2to5') as HTMLInputElement | null,
  '5to10': document.getElementById('threshold_5to10') as HTMLInputElement | null,
  '10to30': document.getElementById('threshold_10to30') as HTMLInputElement | null,
  '30to60': document.getElementById('threshold_30to60') as HTMLInputElement | null,
  '1to2hours': document.getElementById('threshold_1to2hours') as HTMLInputElement | null,
  'over2hours': document.getElementById('threshold_over2hours') as HTMLInputElement | null
};

// Global State
let currentFitData: FitData | null = null;
let currentFileName: string | null = null;
let activityMap: L.Map | null = null;
let currentSlowPeriods: SlowPeriod[] | null = null;

// =============================================================================
// APPLICATION ENTRY POINTS (EVENT HANDLERS & INITIALIZATION)
// =============================================================================

// Only initialize DOM-dependent code if we're in a browser environment
if (typeof window !== 'undefined' && fileInput) {

// File input change handler
fileInput?.addEventListener('change', function(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (parseButton) {
    parseButton.disabled = !file;
  }
});

// Example file load handler
loadExampleFileLink?.addEventListener('click', async function(event: Event) {
  event.preventDefault();
  await loadExampleFile();
});

// Main file parsing handler
parseButton?.addEventListener('click', async function() {
  if (screenshot) {
    clearElement(screenshot);
  }

  const file = fileInput?.files?.[0];
  if (!file) return;

  try {
    clearElement(activityDataElement);
    const loadingElement = createElementFromTemplate('loading-template', {
      message: '📊 Parsing FIT file...'
    });
    activityDataElement.appendChild(loadingElement);

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Create stream from ArrayBuffer
    const fileStream = Stream.fromByteArray(new Uint8Array(arrayBuffer));

    // Create decoder and parse
    const fileDecoder = new Decoder(fileStream);
    const { messages: fitData, errors: fitErrors } = fileDecoder.read();

    // Display any errors
    if (fitErrors.length > 0) {
      console.warn('FIT parsing errors:', fitErrors);
    }

    // Store data for reanalysis
    currentFitData = fitData;
    currentFileName = file.name;

    // Show analysis controls
    analysisControlsElement.style.display = 'block';

    // Extract activity information
    displayActivityData(fitData, file.name);

    // Initialize map with GPS data
    initializeMap(fitData);

  } catch (error) {
    clearElement(activityDataElement);
    const errorElement = createElementFromTemplate('error-template', {
      message: `❌ Error parsing FIT file: ${error.message}`
    });
    activityDataElement.appendChild(errorElement);
    console.error('FIT parsing error:', error);
  }
});

// Threshold filter change handlers
Object.values(thresholdCheckboxes).forEach(checkbox => {
  checkbox?.addEventListener('change', function() {
    if (currentFitData && currentFileName) {
      displayActivityData(currentFitData, currentFileName);
    }
  });
});

// Map overlay toggle handler
showPeriodsOnMapCheckbox?.addEventListener('change', function() {
  if (activityMap && currentSlowPeriods) {
    updateMapOverlays();
  }
});

// Timestamp gap threshold change handler
timestampGapThresholdSelect?.addEventListener('change', function() {
  if (currentFitData && currentFileName) {
    displayActivityData(currentFitData, currentFileName);
  }
});

} // End of browser environment check

// =============================================================================
// HIGH-LEVEL ORCHESTRATION FUNCTIONS
// =============================================================================

/**
 * Loads and processes the example FIT file from the server
 */
async function loadExampleFile(): Promise<void> {
  try {
    // Clear screenshot and show loading message
    clearElement(screenshot);
    clearElement(activityDataElement);
    const loadingElement = createElementFromTemplate('loading-template', {
      message: '📊 Loading example file...'
    });
    activityDataElement.appendChild(loadingElement);

    // Fetch the example file
    const response = await fetch('GreatBritishEscapades2025.fit');
    if (!response.ok) {
      throw new Error(`Failed to load example file: ${response.status}`);
    }

    // Get the file as array buffer
    const arrayBuffer = await response.arrayBuffer();

    // Create stream from ArrayBuffer
    const fileStream = Stream.fromByteArray(new Uint8Array(arrayBuffer));

    // Create decoder and parse
    const fileDecoder = new Decoder(fileStream);
    const { messages: fitData, errors: fitErrors } = fileDecoder.read();

    // Display any errors
    if (fitErrors.length > 0) {
      console.warn('FIT parsing errors:', fitErrors);
    }

    // Store data for reanalysis
    currentFitData = fitData;
    currentFileName = 'GreatBritishEscapades2025.fit';

    // Show analysis controls
    analysisControlsElement.style.display = 'block';

    // Extract activity information
    displayActivityData(fitData, 'GreatBritishEscapades2025.fit');

    // Initialize map with GPS data
    initializeMap(fitData);

    // Clear file input and enable parse button for future use
    fileInput.value = '';
    parseButton.disabled = false;

  } catch (error) {
    clearElement(activityDataElement);
    const errorElement = createElementFromTemplate('error-template', {
      message: `❌ Error loading example file: ${error.message}`
    });
    activityDataElement.appendChild(errorElement);
    console.error('Example file loading error:', error);
  }
}

/**
 * Main function to process FIT data and update the UI
 * Orchestrates data extraction, analysis, and display
 */
function displayActivityData(fitData: FitData, fileName: string): void {
  // Find session and record data
  const sessions = fitData.sessionMesgs || [];
  const records = fitData.recordMesgs || [];
  const activities = fitData.activityMesgs || [];

  const { startTime, endTime, movingTime, totalDistance } = extractActivityTimes(sessions, records);

  // Analyze for timestamp gaps (do this early so it's available throughout the function)
  const timestampGaps = findTimestampGaps(records);

  // Display the results
  const activitySummaryElement = createElementFromTemplate('activity-summary-template', {
    title: `📁 FIT File Analysis: ${fileName}`
  });
  let slowPeriodsDataElement = null;

  if (startTime && endTime) {
    const duration = Math.round((endTime - startTime) / 1000);
    const formattedDuration = formatDuration(duration);

    const selectedRanges = getSelectedRanges();
    
    // Analyze for slow/stopped periods and recording gaps
    const slowPeriods = findSlowPeriodsWithRanges(records, selectedRanges);
    currentSlowPeriods = slowPeriods; // Store for map overlay
    
    const selectedRangeText = getSelectedRangeText(selectedRanges);
    slowPeriodsDataElement = createSlowPeriodsDisplay(slowPeriods, selectedRangeText);

    if (slowPeriods.length > 0) {
      // Initialize mini maps after DOM is updated
      setTimeout(() => {
        initializeCombinedMiniMaps(slowPeriods);
      }, 100);
    } else {
      currentSlowPeriods = []; // No periods found
    }

    // Calculate estimated moving time
    let estimatedMovingTime = duration;
    let totalSlowDuration = 0;
    if (slowPeriods.length > 0) {
      totalSlowDuration = slowPeriods.reduce((total, period) => {
        return total + Math.round((period.endTime - period.startTime) / 1000);
      }, 0);
      estimatedMovingTime = Math.max(0, duration - totalSlowDuration);
    }
    const formattedEstimatedMovingTime = formatDuration(estimatedMovingTime);
    const formattedTotalSlowDurationTime = formatDuration(totalSlowDuration);

    // Create activity times element
    const activityTimesData = {
      'start-time': startTime.toLocaleString(),
      'end-time': endTime.toLocaleString(),
      'duration': formattedDuration,
      'stopped-time': formattedTotalSlowDurationTime,
      'moving-time': formattedEstimatedMovingTime
    };

    // Add distance if available
    if (totalDistance != null) {
      const distanceKm = (totalDistance / 1000).toFixed(2);
      const distanceMiles = (totalDistance * 0.000621371).toFixed(2);
      activityTimesData.distance = `${distanceKm} km (${distanceMiles} miles)`;
    }

    const activityTimesElement = createElementFromTemplate('activity-times-template', activityTimesData);
    
    // Show/hide distance info based on availability
    const distanceInfo = activityTimesElement.querySelector('[data-field="distance-info"]');
    if (totalDistance != null) {
      distanceInfo.style.display = 'block';
    }
    
    // Append to activity summary
    activitySummaryElement.appendChild(activityTimesElement);

    
    // Update map overlays if map is initialized
    if (activityMap) {
      updateMapOverlays();
    }
  } else {
    const warningElement = createElementFromTemplate('warning-message-template', {
      message: '⚠️ Could not determine start/end times from this FIT file.'
    });
    activitySummaryElement.appendChild(warningElement);
  }

  // Clear and populate elements
  const activitySummaryDOMElement = document.getElementById('activitySummary');
  clearElement(activitySummaryDOMElement);
  activitySummaryDOMElement.appendChild(activitySummaryElement);
  
  const slowPeriodDOMElement = document.getElementById('slowPeriodData');
  clearElement(slowPeriodDOMElement);
  if (slowPeriodsDataElement) {
    slowPeriodDOMElement.appendChild(slowPeriodsDataElement);
  }
  
  // Clear the timestamp gap section since it's now combined
  clearElement(timestampGapDataElement);

  // Show some additional info
  const fileSummaryElement = createElementFromTemplate('file-summary-template', {
    'total-records': records.length,
    'sessions-found': sessions.length,
    'timestamp-gaps': timestampGaps.length
  });
  
  clearElement(activityDataElement);
  activityDataElement.appendChild(fileSummaryElement);
}

// =============================================================================
// MID-LEVEL PROCESSING FUNCTIONS (UI & MAP COORDINATION)
// =============================================================================

/**
 * Initializes the main activity map with GPS route and markers
 */
function initializeMap(fitData: FitData): void {
  const records = fitData.recordMesgs || [];
  const gpsPoints = convertGpsCoordinates(records);

  if (gpsPoints.length === 0) {
    console.log('No GPS data found in FIT file');
    return;
  }

  // Show map container
  mapContainerElement.style.display = 'block';

  // Initialize map if not already created
  if (!activityMap) {
    // Center map on first GPS point
    activityMap = L.map('map').setView(gpsPoints[0], 13);

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(activityMap);
  } else {
    // Clear existing layers
    activityMap.eachLayer(layer => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker) {
        activityMap.removeLayer(layer);
      }
    });
  }

  // Add activity route as polyline
  const polyline = L.polyline(gpsPoints, { color: 'red', weight: 3 }).addTo(activityMap);

  // Add start marker
  if (gpsPoints.length > 0) {
    L.marker(gpsPoints[0])
      .addTo(activityMap)
      .bindPopup('Start');
  }

  // Add end marker if different from start
  if (gpsPoints.length > 1) {
    const endPoint = gpsPoints[gpsPoints.length - 1];
    L.marker(endPoint)
      .addTo(activityMap)
      .bindPopup('End');
  }

  // Fit map to show entire route
  activityMap.fitBounds(polyline.getBounds(), { padding: [10, 10] });

  // Add slow periods and gaps overlay if enabled
  updateMapOverlays();
}

/**
 * Updates map overlays to show/hide slow periods and recording gaps
 */
function updateMapOverlays(): void {
  if (!activityMap || !currentSlowPeriods) {
    return;
  }

  // Remove existing overlay markers and lines
  activityMap.eachLayer(layer => {
    if (layer.options && (layer.options.isSlowPeriodOverlay || layer.options.isGapOverlay)) {
      activityMap.removeLayer(layer);
    }
  });

  // Only add overlays if checkbox is checked
  if (!showPeriodsOnMapCheckbox.checked) {
    return;
  }

  // Add markers for each slow period or gap
  currentSlowPeriods.forEach((period, index) => {
    if (period.isGap) {
      // Handle recording gap
      const gap = period.gapData;
      
      if (gap.startGpsPoint) {
        L.marker(gap.startGpsPoint, {
          icon: L.divIcon({
            className: 'gap-overlay-marker',
            html: '<div class="gap-overlay-marker">⏸️</div>',
            iconSize: [20, 20]
          }),
          isGapOverlay: true
        }).addTo(activityMap).bindPopup(`Recording Gap ${index + 1}<br>Duration: ${formatDuration(Math.round((period.endTime - period.startTime) / 1000))}`);
      }
      
      if (gap.endGpsPoint && gap.startGpsPoint) {
        // Add dashed line for gap if both points exist
        L.polyline([gap.startGpsPoint, gap.endGpsPoint], {
          color: '#dc3545',
          weight: 4,
          opacity: 0.8,
          dashArray: '15, 10',
          isGapOverlay: true
        }).addTo(activityMap);
      }
    } else {
      // Handle slow period
      if (period.gpsPoints.length > 0) {
        const centerPoint = period.gpsPoints[Math.floor(period.gpsPoints.length / 2)];
        
        L.marker(centerPoint, {
          icon: L.divIcon({
            className: 'slow-overlay-marker',
            html: '<div class="slow-overlay-marker">🐌</div>',
            iconSize: [20, 20]
          }),
          isSlowPeriodOverlay: true
        }).addTo(activityMap).bindPopup(`Slow Period ${index + 1}<br>Duration: ${formatDuration(Math.round((period.endTime - period.startTime) / 1000))}<br>Records: ${period.recordCount}`);
        
        // Add highlighted route for slow period if multiple points
        if (period.gpsPoints.length > 1) {
          L.polyline(period.gpsPoints, {
            color: '#ffc107',
            weight: 6,
            opacity: 0.9,
            isSlowPeriodOverlay: true
          }).addTo(activityMap);
        }
      }
    }
  });
}

/**
 * Creates mini-maps for individual slow periods and recording gaps
 */
function initializeCombinedMiniMaps(periods: SlowPeriod[]): void {
  periods.forEach((period, index) => {
    const mapId = `miniMap${index}`;
    const mapElement = document.getElementById(mapId);

    if (!mapElement) {
      return;
    }

    if (period.isGap) {
      // Handle recording gap
      const gap = period.gapData;
      
      // Check if we have GPS data for start or end points
      if (!gap.startGpsPoint && !gap.endGpsPoint) {
        clearElement(mapElement);
        const noGpsElement = createElementFromTemplate('no-gps-message-template', {
          message: 'No GPS data available for this gap'
        });
        mapElement.appendChild(noGpsElement);
        return;
      }

      // Create mini map
      const miniMap = L.map(mapId, {
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true
      });

      // Add tile layer
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ''
      }).addTo(miniMap);

      // Collect available GPS points
      const availablePoints = [];
      if (gap.startGpsPoint) availablePoints.push(gap.startGpsPoint);
      if (gap.endGpsPoint) availablePoints.push(gap.endGpsPoint);

      if (availablePoints.length === 1) {
        // Single point available - center on it
        const point = availablePoints[0];
        miniMap.setView(point, 15);
        
        // Determine if it's start or end point
        if (gap.startGpsPoint && !gap.endGpsPoint) {
          L.marker(point, {
            icon: L.divIcon({
              className: 'gap-start-marker',
              html: '<div class="gap-start-marker">Gap Start</div>',
              iconSize: [70, 25]
            })
          }).addTo(miniMap).bindPopup(`Recording Gap ${index + 1} - Recording stopped here`);
        } else {
          L.marker(point, {
            icon: L.divIcon({
              className: 'gap-end-marker',
              html: '<div class="gap-end-marker">Gap End</div>',
              iconSize: [70, 25]
            })
          }).addTo(miniMap).bindPopup(`Recording Gap ${index + 1} - Recording resumed here`);
        }
      } else {
        // Both start and end points available
        // Add start marker (where recording stopped)
        L.marker(gap.startGpsPoint, {
          icon: L.divIcon({
            className: 'gap-start-marker',
            html: '<div class="gap-start-marker">Stop</div>',
            iconSize: [40, 25]
          })
        }).addTo(miniMap).bindPopup(`Recording Gap ${index + 1} - Recording stopped`);

        // Add end marker (where recording resumed)
        L.marker(gap.endGpsPoint, {
          icon: L.divIcon({
            className: 'gap-end-marker',
            html: '<div class="gap-end-marker">Resume</div>',
            iconSize: [50, 25]
          })
        }).addTo(miniMap).bindPopup(`Recording Gap ${index + 1} - Recording resumed`);

        // Add a dashed line between start and end points to show the gap
        L.polyline([gap.startGpsPoint, gap.endGpsPoint], {
          color: '#dc3545',
          weight: 3,
          opacity: 0.7,
          dashArray: '10, 10'
        }).addTo(miniMap);

        // Fit map to show both points
        const bounds = L.latLngBounds([gap.startGpsPoint, gap.endGpsPoint]);
        miniMap.fitBounds(bounds, { padding: [20, 20] });
      }
    } else {
      // Handle regular slow period (existing logic)
      if (period.gpsPoints.length === 0) {
        clearElement(mapElement);
        const noGpsElement = createElementFromTemplate('no-gps-message-template', {
          message: 'No GPS data for this period'
        });
        mapElement.appendChild(noGpsElement);
        return;
      }

      // Create mini map
      const miniMap = L.map(mapId, {
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true
      });

      // Add tile layer
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ''
      }).addTo(miniMap);

      if (period.gpsPoints.length === 1) {
        // Single point - just show marker
        const point = period.gpsPoints[0];
        miniMap.setView(point, 16);
        L.marker(point)
          .addTo(miniMap)
          .bindPopup(`Slow period ${index + 1}`);
      } else {
        // Multiple points - show route
        const polyline = L.polyline(period.gpsPoints, { 
          color: '#ffc107', 
          weight: 4,
          opacity: 0.8 
        }).addTo(miniMap);

        // Add start and end markers
        L.marker(period.gpsPoints[0], {
          icon: L.divIcon({
            className: 'start-marker',
            html: '<div class="start-marker">S</div>',
            iconSize: [20, 20]
          })
        }).addTo(miniMap);

        L.marker(period.gpsPoints[period.gpsPoints.length - 1], {
          icon: L.divIcon({
            className: 'end-marker',
            html: '<div class="end-marker">E</div>',
            iconSize: [20, 20]
          })
        }).addTo(miniMap);

        // Fit to bounds with padding
        miniMap.fitBounds(polyline.getBounds(), { padding: [10, 10] });
      }
    }
  });
}

// =============================================================================
// DATA ANALYSIS FUNCTIONS (CORE BUSINESS LOGIC)
// =============================================================================

/**
 * Finds slow periods and recording gaps from FIT file records that match the selected time ranges.
 * This function combines two types of "faff time":
 * 1. Slow periods: Consecutive sequences where speed < 0.75 m/s (rider is moving slowly or stopped)
 * 2. Recording gaps: Periods where no data was recorded (device off/paused) for 5+ minutes
 * 
 * The function uses processSlowSequence() to validate and format speed-based slow periods,
 * and findTimestampGaps() to detect recording interruptions.
 * 
 * @param {Array} records - Array of record messages from FIT file containing timestamps, speeds, GPS, etc.
 * @param {Array} selectedRanges - Array of selected time range strings (e.g., ['5to10', '30to60'])
 * @returns {Array} Array of period objects containing both slow periods and recording gaps, sorted chronologically
 */
function findSlowPeriodsWithRanges(records: FitRecord[], selectedRanges: TimeRange[]): SlowPeriod[] {
  // Early return if no time ranges are selected for analysis
  if (selectedRanges.length === 0) return [];

  const slowPeriods = [];
  let currentSlowSequence = [];

  // PHASE 1: Find consecutive slow periods where speed < SPEED_THRESHOLD (0.75 m/s)
  // Iterate through all records to build sequences of consecutive slow records
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    // Use enhancedSpeed if available, fallback to speed, default to 0
    const speed = record.enhancedSpeed || record.speed || 0;

    if (speed < SPEED_THRESHOLD) {
      // Check if there's a timestamp gap that should break the current slow sequence
      if (currentSlowSequence.length > 0) {
        const previousRecord = currentSlowSequence[currentSlowSequence.length - 1];
        const timeDifference = record.timestamp - previousRecord.timestamp;
        
        // If there's a gap over the threshold, process the current sequence and start a new one  
        const currentThreshold = timestampGapThresholdSelect && timestampGapThresholdSelect.value ? 
          parseInt(timestampGapThresholdSelect.value) : 
          5 * 60 * 1000; // 5 minutes default
        if (timeDifference > currentThreshold) {
          const slowPeriod = processSlowSequence(currentSlowSequence, selectedRanges);
          if (slowPeriod) {
            slowPeriods.push(slowPeriod);
          }
          // Start new sequence with current record
          currentSlowSequence = [record];
        } else {
          // No significant gap, add to current sequence
          currentSlowSequence.push(record);
        }
      } else {
        // First slow record in sequence
        currentSlowSequence.push(record);
      }
    } else {
      // Record is fast, process any accumulated slow sequence
      const slowPeriod = processSlowSequence(currentSlowSequence, selectedRanges);
      if (slowPeriod) {
        slowPeriods.push(slowPeriod);
      }
      // Reset sequence for next potential slow period
      currentSlowSequence = [];
    }
  }

  // Handle the case where the activity ends with slow records
  // (no fast record to trigger processing of the final sequence)
  const finalSlowPeriod = processSlowSequence(currentSlowSequence, selectedRanges);
  if (finalSlowPeriod) {
    slowPeriods.push(finalSlowPeriod);
  }

  // PHASE 2: Find recording gaps (timestamp jumps > 5 minutes) and add matching ones
  const timestampGaps = findTimestampGaps(records);
  timestampGaps.forEach(gap => {
    const gapDurationMinutes = gap.gapDurationMinutes;
    const gapDurationHours = gap.gapDurationHours;
    
    // Check if this gap's duration falls within any of the selected time ranges
    const matchesRange = selectedRanges.some(range => 
      matchesTimeRange(range, gapDurationMinutes, gapDurationHours)
    );

    if (matchesRange) {
      // Convert recording gap to the same format as slow periods for unified handling
      const gapAsPeriod = {
        startTime: gap.startTime,
        endTime: gap.endTime,
        recordCount: 0, // No records exist during a gap
        startDistance: gap.startDistance,
        endDistance: gap.endDistance,
        // Build GPS points array from available start/end coordinates
        gpsPoints: gap.startGpsPoint && gap.endGpsPoint ? [gap.startGpsPoint, gap.endGpsPoint] : 
                  gap.startGpsPoint ? [gap.startGpsPoint] :
                  gap.endGpsPoint ? [gap.endGpsPoint] : [],
        isGap: true, // Flag to distinguish gaps from speed-based slow periods
        gapData: gap // Preserve original gap data for specialized rendering
      };
      slowPeriods.push(gapAsPeriod);
    }
  });

  // Sort all periods (both slow periods and gaps) chronologically by start time
  // This creates a timeline showing when each period of "faff time" occurred
  slowPeriods.sort((a, b) => a.startTime - b.startTime);

  return slowPeriods;
}

/**
 * Extracts basic activity timing and distance information from sessions and records
 */
function extractActivityTimes(sessions: FitSession[], records: FitRecord[]): ActivityTimes {
  let startTime = null;
  let endTime = null;
  let movingTime = null;
  let totalDistance = null;

  if (sessions.length > 0) {
    const session = sessions[0];
    startTime = session.startTime;
    movingTime = session.totalTimerTime;
    totalDistance = session.totalDistance;

    if (session.totalElapsedTime) {
      endTime = new Date(startTime.getTime() + (session.totalElapsedTime * 1000));
    }
  }

  // If no session data, try to get from records
  if (records.length > 0) {
    startTime = records[0].timestamp;
    endTime = records[records.length - 1].timestamp;
  }

  return { startTime, endTime, movingTime, totalDistance };
}

/**
 * Detects recording gaps in FIT file data by analyzing timestamp differences between consecutive records.
 * Recording gaps occur when a GPS device is turned off, paused, or loses signal for extended periods.
 * Only gaps longer than the specified threshold are considered significant.
 * 
 * @param {Array} records - Array of record messages from FIT file, each containing timestamp and position data
 * @param {Number} threshold - Optional threshold in milliseconds. Defaults to current UI setting or 5 minutes
 * @returns {Array} Array of gap objects with timing, location, and distance information
 */
function findTimestampGaps(records: FitRecord[], threshold: number | null = null): TimestampGap[] {
  const gaps = [];
  
  // Use provided threshold or fall back to UI setting or default
  const gapThreshold = threshold || 
    (timestampGapThresholdSelect && timestampGapThresholdSelect.value ? 
      parseInt(timestampGapThresholdSelect.value) : 
      5 * 60 * 1000); // 5 minutes default
  
  // Iterate through consecutive record pairs to find timestamp jumps
  for (let i = 1; i < records.length; i++) {
    const previousRecord = records[i - 1];
    const currentRecord = records[i];
    
    // Skip records that don't have valid timestamps
    if (!previousRecord.timestamp || !currentRecord.timestamp) {
      continue;
    }
    
    // Calculate the time difference between consecutive records
    const timeDifference = currentRecord.timestamp - previousRecord.timestamp;
    
    // Check if the gap exceeds our threshold
    if (timeDifference > gapThreshold) {
      // Convert gap duration to more readable units
      const gapDurationMinutes = Math.round(timeDifference / (1000 * 60));
      const gapDurationHours = gapDurationMinutes / 60;
      
      // Create gap object with comprehensive information for analysis and display
      gaps.push({
        startTime: previousRecord.timestamp,  // When recording stopped
        endTime: currentRecord.timestamp,     // When recording resumed
        gapDuration: timeDifference,          // Gap duration in milliseconds
        gapDurationMinutes: gapDurationMinutes,
        gapDurationHours: gapDurationHours,
        startDistance: previousRecord.distance || 0,  // Distance when recording stopped
        endDistance: currentRecord.distance || 0,     // Distance when recording resumed
        // Convert GPS coordinates from Garmin's semicircle format to decimal degrees
        // Semicircles are stored as 32-bit signed integers where 2^31 semicircles = 180 degrees
        startGpsPoint: previousRecord.positionLat && previousRecord.positionLong ? 
          [previousRecord.positionLat * (180 / Math.pow(2, 31)), 
           previousRecord.positionLong * (180 / Math.pow(2, 31))] : null,
        endGpsPoint: currentRecord.positionLat && currentRecord.positionLong ? 
          [currentRecord.positionLat * (180 / Math.pow(2, 31)), 
           currentRecord.positionLong * (180 / Math.pow(2, 31))] : null
      });
    }
  }
  
  return gaps;
}

/**
 * Processes a sequence of consecutive slow records to create a slow period object.
 * This function validates that the sequence duration matches the user's selected time ranges,
 * and extracts relevant information like GPS coordinates, distances, and timing.
 * 
 * @param {Array} currentSlowSequence - Array of consecutive FIT records where speed < SPEED_THRESHOLD
 * @param {Array} selectedRanges - Array of user-selected time range filters (e.g., ['5to10', '30to60'])
 * @returns {Object|null} Slow period object with timing and location data, or null if no match
 */
function processSlowSequence(currentSlowSequence: FitRecord[], selectedRanges: TimeRange[]): SlowPeriod | null {
  // Early return for empty sequences - no slow period to process
  if (currentSlowSequence.length === 0) return null;
  
  // Extract boundary records to calculate the overall duration of this slow period
  const startRecord = currentSlowSequence[0];
  const endRecord = currentSlowSequence[currentSlowSequence.length - 1];
  const durationMs = endRecord.timestamp - startRecord.timestamp;
  const durationMinutes = durationMs / (1000 * 60);
  const durationHours = durationMinutes / 60;

  // Check if this slow period's duration falls within any of the user's selected time ranges
  // This filtering allows users to focus on specific types of stops (e.g., only long breaks)
  const matchesRange = selectedRanges.some(range => 
    matchesTimeRange(range, durationMinutes, durationHours)
  );

  // Only create a period object if it matches the user's filtering criteria
  if (matchesRange) {
    // Extract distance information to show where in the ride this slow period occurred
    const startDistance = startRecord.distance || 0;
    const endDistance = endRecord.distance || startDistance; // Fallback if no end distance

    // Return comprehensive slow period object for display and map rendering
    return {
      startTime: startRecord.timestamp,    // When the slow period began
      endTime: endRecord.timestamp,        // When the slow period ended
      recordCount: currentSlowSequence.length,  // Number of GPS records in this period
      startDistance: startDistance,        // Distance marker at start of slow period
      endDistance: endDistance,           // Distance marker at end of slow period
      gpsPoints: convertGpsCoordinates(currentSlowSequence)  // GPS trail during slow period
    };
  }
  
  // Return null if this slow period doesn't match the user's selected time ranges
  return null;
}

// =============================================================================
// UTILITY FUNCTIONS (PURE FUNCTIONS)
// =============================================================================

/**
 * Gets the current timestamp gap threshold from the dropdown selection
 */
function getCurrentTimestampGapThreshold(): number {
  return parseInt(timestampGapThresholdSelect?.value || '300000');
}

/**
 * Formats a duration in seconds to a human-readable string
 */
function formatDuration(totalSeconds: number): string {
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
function getSelectedRanges(): TimeRange[] {
  return Object.entries(thresholdCheckboxes)
    .filter(([key, checkbox]) => checkbox?.checked)
    .map(([key, checkbox]) => key as TimeRange);
}

/**
 * Converts selected time range keys to human-readable text
 */
function getSelectedRangeText(selectedRanges: TimeRange[]): string {
  return selectedRanges.map(range => RANGE_LABELS[range]).join(', ');
}

/**
 * Checks if a duration matches a specific time range category
 */
function matchesTimeRange(range: TimeRange, durationMinutes: number, durationHours: number): boolean {
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
 * Converts GPS coordinates from Garmin's semicircle format to decimal degrees
 */
function convertGpsCoordinates(records: FitRecord[]): [number, number][] {
  return records
    .filter(record => record.positionLat && record.positionLong)
    .map(record => [
      record.positionLat * (180 / Math.pow(2, 31)),
      record.positionLong * (180 / Math.pow(2, 31))
    ]);
}

// =============================================================================
// TEMPLATE & DOM HELPER FUNCTIONS
// =============================================================================

/**
 * Creates a DOM element from a template and populates it with data
 */
function createElementFromTemplate(templateId: string, data: Record<string, any> = {}): DocumentFragment | null {
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
function clearElement(element: HTMLElement | null): void {
  if (element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }
}

/**
 * Creates a Google Maps link element
 */
function createGoogleMapsLink(lat: number, lng: number, text: string = '📍 View on Google Maps'): HTMLAnchorElement {
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
function createSlowPeriodsDisplay(slowPeriods: SlowPeriod[], selectedRangeText: string): DocumentFragment | null {
  if (slowPeriods.length === 0) {
    return createElementFromTemplate('no-slow-periods-template', {
      'range-text': selectedRangeText
    });
  }

  // Separate slow periods and gaps for statistics
  const actualSlowPeriods = slowPeriods.filter(period => !period.isGap);
  const gapPeriods = slowPeriods.filter(period => period.isGap);
  
  // Calculate total duration of all periods
  const totalSlowDuration = slowPeriods.reduce((total, period) => {
    return total + Math.round((period.endTime - period.startTime) / 1000);
  }, 0);

  const totalSlowFormattedDuration = formatDuration(totalSlowDuration);

  // Create the container
  const containerElement = createElementFromTemplate('slow-periods-container-template', {
    'total-periods': slowPeriods.length,
    'range-text': selectedRangeText,
    'slow-count': actualSlowPeriods.length,
    'gap-count': gapPeriods.length,
    'total-duration': totalSlowFormattedDuration
  });

  // Create individual period elements
  const periodsListContainer = containerElement.querySelector('[data-field="periods-list"]');
  
  slowPeriods.forEach((period, index) => {
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

    if (period.isGap) {
      // Recording gap display
      const endDistanceKm = (period.endDistance / 1000).toFixed(2);
      
      // Create location links
      const locationLinks = document.createElement('span');
      if (period.gapData.startGpsPoint) {
        const [lat, lng] = period.gapData.startGpsPoint;
        const startLink = createGoogleMapsLink(lat, lng, '📍 Start location');
        locationLinks.appendChild(startLink);
      }
      if (period.gapData.endGpsPoint) {
        if (locationLinks.hasChildNodes()) {
          locationLinks.appendChild(document.createTextNode(' | '));
        }
        const [lat, lng] = period.gapData.endGpsPoint;
        const endLink = createGoogleMapsLink(lat, lng, '📍 End location');
        locationLinks.appendChild(endLink);
      }

      const gapElement = createElementFromTemplate('recording-gap-item-template', {
        'title': `⏸️ Recording Gap ${index + 1}:`,
        'time-range': `${startTime} - ${endTime}`,
        'duration': durationText,
        'distance-range': `${startDistanceKm} km → ${endDistanceKm} km`,
        'location-links': locationLinks
      });

      // Set up mini map
      const miniMapElement = gapElement.querySelector('[data-field="mini-map"]');
      miniMapElement.id = `miniMap${index}`;

      periodsListContainer.appendChild(gapElement);
    } else {
      // Regular slow period display
      let locationLink = '';
      if (period.gpsPoints[0]) {
        const lat = period.gpsPoints[0][0];
        const lng = period.gpsPoints[0][1];
        const linkElement = createGoogleMapsLink(lat, lng);
        const locationSpan = document.createElement('span');
        locationSpan.appendChild(document.createTextNode('\n'));
        const strongElement = document.createElement('strong');
        strongElement.textContent = 'Location:';
        locationSpan.appendChild(strongElement);
        locationSpan.appendChild(document.createTextNode(' '));
        locationSpan.appendChild(linkElement);
        locationLink = locationSpan;
      }

      const slowPeriodElement = createElementFromTemplate('slow-period-item-template', {
        'title': `🐌 Slow Period ${index + 1}:`,
        'time-range': `${startTime} - ${endTime}`,
        'duration': durationText,
        'record-count': period.recordCount,
        'distance': startDistanceKm,
        'location-link': locationLink
      });

      // Set up mini map
      const miniMapElement = slowPeriodElement.querySelector('[data-field="mini-map"]');
      miniMapElement.id = `miniMap${index}`;

      periodsListContainer.appendChild(slowPeriodElement);
    }
  });

  return containerElement;
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export { 
  extractActivityTimes,
  findTimestampGaps,
  processSlowSequence,
  formatDuration,
  matchesTimeRange,
  convertGpsCoordinates
};
