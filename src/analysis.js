import { convertGpsCoordinates, matchesTimeRange } from './utils.js';

// Constants
const TIMESTAMP_GAP_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Extracts basic activity timing and distance information from sessions and records
 */
export function extractActivityTimes(sessions, records) {
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
export function findTimestampGaps(records) {
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
export function processSlowSequence(currentSlowSequence, selectedRanges) {
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