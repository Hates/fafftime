import { Decoder, Stream, Profile, Utils } from '@garmin/fitsdk';
import './styles.css';

// Constants
const RANGE_LABELS = {
  '2to5': '2-5 minutes',
  '5to10': '5-10 minutes',
  '10to30': '10-30 minutes', 
  '30to60': '30-60 minutes',
  '1to2hours': '1-2 hours',
  over2hours: 'Over 2 hours'
};

const SPEED_THRESHOLD = 0.75; // m/s threshold for slow periods
const TIMESTAMP_GAP_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

// DOM Elements
const fileInput = document.getElementById('fitFile');
const screenshot = document.getElementById('screenshot');
const parseButton = document.getElementById('parseButton');
const activityDataElement = document.getElementById('activityData');
const activitySummaryElement = document.getElementById('activitySummary');
const slowPeriodDataElement = document.getElementById('slowPeriodData');
const timestampGapDataElement = document.getElementById('timestampGapData');
const analysisControlsElement = document.getElementById('analysisControls');
const mapContainerElement = document.getElementById('mapContainer');
const showPeriodsOnMapCheckbox = document.getElementById('showPeriodsOnMap');
const loadExampleFileLink = document.getElementById('loadExampleFile');

const thresholdCheckboxes = {
  '2to5': document.getElementById('threshold_2to5'),
  '5to10': document.getElementById('threshold_5to10'),
  '10to30': document.getElementById('threshold_10to30'),
  '30to60': document.getElementById('threshold_30to60'),
  '1to2hours': document.getElementById('threshold_1to2hours'),
  over2hours: document.getElementById('threshold_over2hours')
};

// Global State
let currentFitData = null;
let currentFileName = null;
let activityMap = null;
let currentSlowPeriods = null;

// Event Listeners
fileInput.addEventListener('change', function(event) {
  const file = event.target.files[0];
  parseButton.disabled = !file;
});

loadExampleFileLink.addEventListener('click', async function(event) {
  event.preventDefault();
  await loadExampleFile();
});

parseButton.addEventListener('click', async function() {
  screenshot.innerHTML = '';

  const file = fileInput.files[0];
  if (!file) return;

  try {
    activityDataElement.innerHTML = '<p>📊 Parsing FIT file...</p>';

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
    activityDataElement.innerHTML = `<p class="error-message">❌ Error parsing FIT file: ${error.message}</p>`;
    console.error('FIT parsing error:', error);
  }
});

Object.values(thresholdCheckboxes).forEach(checkbox => {
  checkbox.addEventListener('change', function() {
    if (currentFitData && currentFileName) {
      displayActivityData(currentFitData, currentFileName);
    }
  });
});

showPeriodsOnMapCheckbox.addEventListener('change', function() {
  if (activityMap && currentSlowPeriods) {
    updateMapOverlays();
  }
});

// Utility Functions
function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (totalSeconds >= 3600) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else {
    return `${minutes}m ${seconds}s`;
  }
}

function getSelectedRanges() {
  return Object.entries(thresholdCheckboxes)
    .filter(([key, checkbox]) => checkbox.checked)
    .map(([key, checkbox]) => key);
}

function getSelectedRangeText(selectedRanges) {
  return selectedRanges.map(range => RANGE_LABELS[range]).join(', ');
}

function matchesTimeRange(range, durationMinutes, durationHours) {
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

function convertGpsCoordinates(records) {
  return records
    .filter(record => record.positionLat && record.positionLong)
    .map(record => [
      record.positionLat * (180 / Math.pow(2, 31)),
      record.positionLong * (180 / Math.pow(2, 31))
    ]);
}

// Data Processing Functions
function extractActivityTimes(sessions, records) {
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
 * Only gaps longer than TIMESTAMP_GAP_THRESHOLD (5 minutes) are considered significant.
 * 
 * @param {Array} records - Array of record messages from FIT file, each containing timestamp and position data
 * @returns {Array} Array of gap objects with timing, location, and distance information
 */
function findTimestampGaps(records) {
  const gaps = [];
  
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
    
    // Check if the gap exceeds our threshold (5 minutes = 300,000ms)
    if (timeDifference > TIMESTAMP_GAP_THRESHOLD) {
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
function processSlowSequence(currentSlowSequence, selectedRanges) {
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
function findSlowPeriodsWithRanges(records, selectedRanges) {
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
      // Record is slow, add it to the current sequence
      currentSlowSequence.push(record);
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

// File Loading Functions
async function loadExampleFile() {
  try {
    // Clear screenshot and show loading message
    screenshot.innerHTML = '';
    activityDataElement.innerHTML = '<p>📊 Loading example file...</p>';

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
    activityDataElement.innerHTML = `<p class="error-message">❌ Error loading example file: ${error.message}</p>`;
    console.error('Example file loading error:', error);
  }
}

// Display Functions
function displayActivityData(fitData, fileName) {
  // Find session and record data
  const sessions = fitData.sessionMesgs || [];
  const records = fitData.recordMesgs || [];
  const activities = fitData.activityMesgs || [];

  const { startTime, endTime, movingTime, totalDistance } = extractActivityTimes(sessions, records);

  // Analyze for timestamp gaps (do this early so it's available throughout the function)
  const timestampGaps = findTimestampGaps(records);

  // Display the results
  let activitySummaryHtml = `<h2>📁 FIT File Analysis: ${fileName}</h2>`;
  let slowPeriodsDataHtml = ``;

  if (startTime && endTime) {
    const duration = Math.round((endTime - startTime) / 1000);
    const formattedDuration = formatDuration(duration);

    const selectedRanges = getSelectedRanges();
    
    // Analyze for slow/stopped periods and recording gaps
    const slowPeriods = findSlowPeriodsWithRanges(records, selectedRanges);
    currentSlowPeriods = slowPeriods; // Store for map overlay
    
    if (slowPeriods.length > 0) {
      // Separate slow periods and gaps for statistics
      const actualSlowPeriods = slowPeriods.filter(period => !period.isGap);
      const gapPeriods = slowPeriods.filter(period => period.isGap);
      
      // Calculate total duration of all periods
      const totalSlowDuration = slowPeriods.reduce((total, period) => {
        return total + Math.round((period.endTime - period.startTime) / 1000);
      }, 0);

      const totalSlowFormattedDuration = formatDuration(totalSlowDuration);
      const selectedRangeText = getSelectedRangeText(selectedRanges);

      slowPeriodsDataHtml += `
<div class="slow-periods">
<h3>🐌 Slow Periods & Recording Gaps</h3>
<p>Found ${slowPeriods.length} period(s) in selected ranges (${selectedRangeText})</p>
<p><strong>Breakdown:</strong> ${actualSlowPeriods.length} slow period(s) (speed &lt; 1 m/s), ${gapPeriods.length} recording gap(s)</p>
<p><strong>Total duration:</strong> ${totalSlowFormattedDuration}</p>
`;

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

        // Format distance marker
        const startDistanceKm = (period.startDistance / 1000).toFixed(2);

        if (period.isGap) {
          // Recording gap display
          const endDistanceKm = (period.endDistance / 1000).toFixed(2);
          
          // Get GPS coordinates for Google Maps links
          let startGoogleMapsLink = '';
          let endGoogleMapsLink = '';
          if (period.gapData.startGpsPoint) {
            const [lat, lng] = period.gapData.startGpsPoint;
            startGoogleMapsLink = `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" class="google-maps-link">📍 Start location</a>`;
          }
          if (period.gapData.endGpsPoint) {
            const [lat, lng] = period.gapData.endGpsPoint;
            endGoogleMapsLink = `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" class="google-maps-link">📍 End location</a>`;
          }

          slowPeriodsDataHtml += `
<div class="timestamp-gap-item">
<strong>⏸️ Recording Gap ${index + 1}:</strong> ${startTime} - ${endTime}<br>
<strong>Duration:</strong> ${durationText} (no data recorded)<br>
<strong>Distance:</strong> ${startDistanceKm} km → ${endDistanceKm} km<br>
${startGoogleMapsLink} ${endGoogleMapsLink ? '| ' + endGoogleMapsLink : ''}<br>
<div id="miniMap${index}" class="mini-map"></div>
</div>
`;
        } else {
          // Regular slow period display
          let googleMapsLink = '';
          if(period.gpsPoints[0]) {
            const lat = period.gpsPoints[0][0];
            const lng = period.gpsPoints[0][1];
            googleMapsLink = `<br><strong>Location:</strong> <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" class="google-maps-link">📍 View on Google Maps</a>`;
          }

          slowPeriodsDataHtml += `
<div class="slow-period-item">
<strong>🐌 Slow Period ${index + 1}:</strong> ${startTime} - ${endTime}<br>
<strong>Duration:</strong> ${durationText} (${period.recordCount} records)<br>
<strong>Distance marker:</strong> ${startDistanceKm} km${googleMapsLink}<br>
<div id="miniMap${index}" class="mini-map"></div>
</div>
`;
        }
      });

      slowPeriodsDataHtml += `</div>`;

      // Initialize mini maps after DOM is updated
      setTimeout(() => {
        initializeCombinedMiniMaps(slowPeriods);
      }, 100);
    } else {
      currentSlowPeriods = []; // No periods found
      const selectedRangeText = getSelectedRangeText(selectedRanges);
      
      slowPeriodsDataHtml += `
<div class="no-slow-periods">
<h3>✅ No Slow Periods or Recording Gaps Detected</h3>
<p>No periods found in selected ranges (${selectedRangeText}) where speed was &lt; 1 m/s or where recording gaps occurred.</p>
<p>Great job maintaining your pace and consistent recording! 🚴‍♀️💨</p>
</div>
`;
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

    activitySummaryHtml += `
<div class="activity-times">
<h3>⏰ Activity Times</h3>
<p><strong>Start Time:</strong> ${startTime.toLocaleString()}</p>
<p><strong>End Time:</strong> ${endTime.toLocaleString()}</p>
<p><strong>Duration:</strong> ${formattedDuration}</p>
<p><strong>Est. Stopped Time:</strong> ${formattedTotalSlowDurationTime}</p>
<p><strong>Est. Moving Time:</strong> ${formattedEstimatedMovingTime}</p>
`;

    // Add distance if available
    if (totalDistance != null) {
      const distanceKm = (totalDistance / 1000).toFixed(2);
      const distanceMiles = (totalDistance * 0.000621371).toFixed(2);
      activitySummaryHtml += `<p><strong>Total Distance:</strong> ${distanceKm} km (${distanceMiles} miles)</p>`;
    }

    activitySummaryHtml += `</div>`;

    
    // Update map overlays if map is initialized
    if (activityMap) {
      updateMapOverlays();
    }
  } else {
    activitySummaryHtml += '<p class="warning-message">⚠️ Could not determine start/end times from this FIT file.</p>';
  }

  activitySummaryElement.innerHTML = activitySummaryHtml;
  slowPeriodDataElement.innerHTML = slowPeriodsDataHtml;
  
  // Clear the timestamp gap section since it's now combined
  timestampGapDataElement.innerHTML = '';

  // Show some additional info
  let activityHtml = `
<div class="file-summary">
<h3>📊 File Summary</h3>
<p><strong>Message Types Found:</strong> ${Object.keys(fitData).join(', ')}</p>
<p><strong>Sessions:</strong> ${sessions.length}</p>
<p><strong>Records:</strong> ${records.length}</p>
</div>
`;
  activityDataElement.innerHTML = activityHtml;
}

// Map Functions
function initializeMap(fitData) {
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

function updateMapOverlays() {
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

function initializeCombinedMiniMaps(periods) {
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
        mapElement.innerHTML = '<div class="no-gps-message">No GPS data available for this gap</div>';
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
        mapElement.innerHTML = '<div class="no-gps-message">No GPS data for this period</div>';
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