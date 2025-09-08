import '@testing-library/jest-dom';

// Mock DOM elements that main.js expects
const mockElements = {
  'fitFile': { addEventListener: vi.fn(), files: [], value: '' },
  'screenshot': { innerHTML: '' },
  'parseButton': { addEventListener: vi.fn(), disabled: false },
  'activityData': { innerHTML: '', appendChild: vi.fn() },
  'activitySummary': { innerHTML: '', appendChild: vi.fn() },
  'slowPeriodData': { innerHTML: '', appendChild: vi.fn() },
  'timestampGapData': { innerHTML: '', appendChild: vi.fn() },
  'analysisControls': { style: { display: 'none' } },
  'mapContainer': { style: { display: 'none' } },
  'showPeriodsOnMap': { addEventListener: vi.fn(), checked: true },
  'loadExampleFile': { addEventListener: vi.fn() },
  'threshold_2to5': { addEventListener: vi.fn(), checked: true },
  'threshold_5to10': { addEventListener: vi.fn(), checked: true },
  'threshold_10to30': { addEventListener: vi.fn(), checked: true },
  'threshold_30to60': { addEventListener: vi.fn(), checked: true },
  'threshold_1to2hours': { addEventListener: vi.fn(), checked: true },
  'threshold_over2hours': { addEventListener: vi.fn(), checked: true }
};

// Mock Leaflet since it's not available in jsdom
global.L = {
  map: vi.fn(() => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
    eachLayer: vi.fn(),
    removeLayer: vi.fn()
  })),
  tileLayer: vi.fn(() => ({
    addTo: vi.fn()
  })),
  polyline: vi.fn(() => ({
    addTo: vi.fn(),
    getBounds: vi.fn()
  })),
  marker: vi.fn(() => ({
    addTo: vi.fn(),
    bindPopup: vi.fn()
  })),
  divIcon: vi.fn(),
  latLngBounds: vi.fn()
};

// Mock document.getElementById
global.document.getElementById = vi.fn((id) => {
  return mockElements[id] || { innerHTML: '', appendChild: vi.fn(), style: {} };
});

// Mock template system
global.document.querySelector = vi.fn();
global.document.querySelectorAll = vi.fn(() => []);

// Create a mock template element
const createMockTemplate = () => ({
  content: {
    cloneNode: vi.fn(() => ({
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      appendChild: vi.fn()
    }))
  }
});

// Override getElementById for template elements
const originalGetElementById = global.document.getElementById;
global.document.getElementById = vi.fn((id) => {
  if (id.includes('-template')) {
    return createMockTemplate();
  }
  return originalGetElementById(id);
});

// Mock fetch for example file loading
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console.warn = vi.fn();
global.console.log = vi.fn();
global.console.error = vi.fn();
