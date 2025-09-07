import { Decoder, Stream, Profile, Utils } from '@garmin/fitsdk';
import './styles.css';

// File input functionality
const fileInput = document.getElementById('fitFile');
const screenshot = document.getElementById('screenshot');
const parseButton = document.getElementById('parseButton');
const activityDataElement = document.getElementById('activityData');
const activitySummaryElement = document.getElementById('activitySummary');
const slowPeriodDataElement = document.getElementById('slowPeriodData');
const timestampGapDataElement = document.getElementById('timestampGapData');
const analysisControlsElement = document.getElementById('analysisControls');
const mapContainerElement = document.getElementById('mapContainer');

const thresholdCheckboxes = {
  '2to5': document.getElementById('threshold_2to5'),
  '5to10': document.getElementById('threshold_5to10'),
  '10to30': document.getElementById('threshold_10to30'),
  '30to60': document.getElementById('threshold_30to60'),
  '1to2hours': document.getElementById('threshold_1to2hours'),
  over2hours: document.getElementById('threshold_over2hours')
};

// Store parsed data for reanalysis
let currentFitData = null;
let currentFileName = null;
let activityMap = null;

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

// Enable parse button when file is selected
fileInput.addEventListener('change', function(event) {
  const file = event.target.files[0];
  parseButton.disabled = !file;
});

// Parse FIT file when button is clicked
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

// Handle threshold checkbox changes
Object.values(thresholdCheckboxes).forEach(checkbox => {
  checkbox.addEventListener('change', function() {
    if (currentFitData && currentFileName) {
      displayActivityData(currentFitData, currentFileName);
    }
  });
});

// Utility functions
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
  if (!startTime && records.length > 0) {
    startTime = records[0].timestamp;
    endTime = records[records.length - 1].timestamp;
  }

  return { startTime, endTime, movingTime, totalDistance };
}

function processSlowSequence(currentSlowSequence, selectedRanges) {
  if (currentSlowSequence.length === 0) return null;
  
  const startRecord = currentSlowSequence[0];
  const endRecord = currentSlowSequence[currentSlowSequence.length - 1];
  const durationMs = endRecord.timestamp - startRecord.timestamp;
  const durationMinutes = durationMs / (1000 * 60);
  const durationHours = durationMinutes / 60;

  // Check if duration matches any selected range
  const matchesRange = selectedRanges.some(range => 
    matchesTimeRange(range, durationMinutes, durationHours)
  );

  if (matchesRange) {
    const startDistance = startRecord.distance || 0;
    const endDistance = endRecord.distance || startDistance;

    return {
      startTime: startRecord.timestamp,
      endTime: endRecord.timestamp,
      recordCount: currentSlowSequence.length,
      startDistance: startDistance,
      endDistance: endDistance,
      gpsPoints: convertGpsCoordinates(currentSlowSequence)
    };
  }
  
  return null;
}

function displayActivityData(fitData, fileName) {
  // Find session and record data
  const sessions = fitData.sessionMesgs || [];
  const records = fitData.recordMesgs || [];
  const activities = fitData.activityMesgs || [];

  const { startTime, endTime, movingTime, totalDistance } = extractActivityTimes(sessions, records);

  // Analyze for timestamp gaps (do this early so it's available throughout the function)
  const timestampGaps = findTimestampGaps(records);

  // Display the results
  let html = `<h2>📁 FIT File Analysis: ${fileName}</h2>`;
  let slowPeriodsHtml = ``;

  if (startTime && endTime) {
    const duration = Math.round((endTime - startTime) / 1000);
    const formattedDuration = formatDuration(duration);

    html += `
<div class="activity-times">
<h3>⏰ Activity Times</h3>
<p><strong>Start Time:</strong> ${startTime.toLocaleString()}</p>
<p><strong>End Time:</strong> ${endTime.toLocaleString()}</p>
<p><strong>Duration:</strong> ${formattedDuration}</p>
`;

    // Add distance if available
    if (totalDistance != null) {
      const distanceKm = (totalDistance / 1000).toFixed(2);
      const distanceMiles = (totalDistance * 0.000621371).toFixed(2);
      html += `<p><strong>Total Distance:</strong> ${distanceKm} km (${distanceMiles} miles)</p>`;
    }

    html += `</div>`;

    const selectedRanges = getSelectedRanges();
    
    // Analyze for slow/stopped periods and recording gaps
    const slowPeriods = findSlowPeriodsWithRanges(records, selectedRanges);
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

      slowPeriodsHtml += `
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

          slowPeriodsHtml += `
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

          slowPeriodsHtml += `
<div class="slow-period-item">
<strong>🐌 Slow Period ${index + 1}:</strong> ${startTime} - ${endTime}<br>
<strong>Duration:</strong> ${durationText} (${period.recordCount} records)<br>
<strong>Distance marker:</strong> ${startDistanceKm} km${googleMapsLink}<br>
<div id="miniMap${index}" class="mini-map"></div>
</div>
`;
        }
      });

      slowPeriodsHtml += `</div>`;

      // Initialize mini maps after DOM is updated
      setTimeout(() => {
        initializeCombinedMiniMaps(slowPeriods);
      }, 100);
    } else {
      const selectedRangeText = getSelectedRangeText(selectedRanges);
      
      slowPeriodsHtml += `
<div class="no-slow-periods">
<h3>✅ No Slow Periods or Recording Gaps Detected</h3>
<p>No periods found in selected ranges (${selectedRangeText}) where speed was &lt; 1 m/s or where recording gaps occurred.</p>
<p>Great job maintaining your pace and consistent recording! 🚴‍♀️💨</p>
</div>
`;
    }
  } else {
    html += '<p class="warning-message">⚠️ Could not determine start/end times from this FIT file.</p>';
  }

  activitySummaryElement.innerHTML = html;
  slowPeriodDataElement.innerHTML = slowPeriodsHtml;
  
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

function findTimestampGaps(records) {
  const gaps = [];
  
  for (let i = 1; i < records.length; i++) {
    const previousRecord = records[i - 1];
    const currentRecord = records[i];
    
    if (!previousRecord.timestamp || !currentRecord.timestamp) {
      continue;
    }
    
    const timeDifference = currentRecord.timestamp - previousRecord.timestamp;
    
    if (timeDifference > TIMESTAMP_GAP_THRESHOLD) {
      const gapDurationMinutes = Math.round(timeDifference / (1000 * 60));
      const gapDurationHours = gapDurationMinutes / 60;
      
      gaps.push({
        startTime: previousRecord.timestamp,
        endTime: currentRecord.timestamp,
        gapDuration: timeDifference,
        gapDurationMinutes: gapDurationMinutes,
        gapDurationHours: gapDurationHours,
        startDistance: previousRecord.distance || 0,
        endDistance: currentRecord.distance || 0,
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

function findSlowPeriodsWithRanges(records, selectedRanges) {
  if (selectedRanges.length === 0) return [];

  const slowPeriods = [];
  let currentSlowSequence = [];

  // Iterate through records to find consecutive slow periods
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const speed = record.enhancedSpeed || record.speed || 0;

    if (speed < SPEED_THRESHOLD) {
      currentSlowSequence.push(record);
    } else {
      const slowPeriod = processSlowSequence(currentSlowSequence, selectedRanges);
      if (slowPeriod) {
        slowPeriods.push(slowPeriod);
      }
      currentSlowSequence = [];
    }
  }

  // Check final sequence in case it ends with slow records
  const finalSlowPeriod = processSlowSequence(currentSlowSequence, selectedRanges);
  if (finalSlowPeriod) {
    slowPeriods.push(finalSlowPeriod);
  }

  // Add timestamp gaps that match the selected ranges
  const timestampGaps = findTimestampGaps(records);
  timestampGaps.forEach(gap => {
    const gapDurationMinutes = gap.gapDurationMinutes;
    const gapDurationHours = gap.gapDurationHours;
    
    // Check if gap duration matches any selected range
    const matchesRange = selectedRanges.some(range => 
      matchesTimeRange(range, gapDurationMinutes, gapDurationHours)
    );

    if (matchesRange) {
      // Convert gap to slow period format
      const gapAsPeriod = {
        startTime: gap.startTime,
        endTime: gap.endTime,
        recordCount: 0, // No records during gap
        startDistance: gap.startDistance,
        endDistance: gap.endDistance,
        gpsPoints: gap.startGpsPoint && gap.endGpsPoint ? [gap.startGpsPoint, gap.endGpsPoint] : 
                  gap.startGpsPoint ? [gap.startGpsPoint] :
                  gap.endGpsPoint ? [gap.endGpsPoint] : [],
        isGap: true, // Flag to identify this as a recording gap
        gapData: gap // Store original gap data for map rendering
      };
      slowPeriods.push(gapAsPeriod);
    }
  });

  // Sort all periods by start time
  slowPeriods.sort((a, b) => a.startTime - b.startTime);

  return slowPeriods;
}

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
}

function initializeSlowPeriodMiniMaps(slowPeriods) {
  slowPeriods.forEach((period, index) => {
    const mapId = `miniMap${index}`;
    const mapElement = document.getElementById(mapId);

    if (!mapElement || period.gpsPoints.length === 0) {
      // If no GPS data, show message in mini map container
      if (mapElement) {
        mapElement.innerHTML = '<div class="no-gps-message">No GPS data for this period</div>';
      }
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
