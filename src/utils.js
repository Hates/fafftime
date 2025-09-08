/**
 * Formats a duration in seconds to a human-readable string
 */
export function formatDuration(totalSeconds) {
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
 * Checks if a duration matches a specific time range category
 */
export function matchesTimeRange(range, durationMinutes, durationHours) {
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
export function convertGpsCoordinates(records) {
  return records
    .filter(record => record.positionLat && record.positionLong)
    .map(record => [
      record.positionLat * (180 / Math.pow(2, 31)),
      record.positionLong * (180 / Math.pow(2, 31))
    ]);
}

/**
 * Creates a Google Maps link element
 */
export function createGoogleMapsLink(lat, lng, text = '📍 View on Google Maps') {
  const link = document.createElement('a');
  link.href = `https://www.google.com/maps?q=${lat},${lng}`;
  link.target = '_blank';
  link.className = 'google-maps-link';
  link.textContent = text;
  return link;
}

/**
 * Creates a DOM element from a template and populates it with data
 */
export function createElementFromTemplate(templateId, data = {}) {
  const template = document.getElementById(templateId);
  if (!template) {
    console.error(`Template not found: ${templateId}`);
    return null;
  }
  
  const clone = template.content.cloneNode(true);
  
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
export function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}