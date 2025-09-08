// Import the functions we want to test
import { 
  formatDuration, 
  matchesTimeRange, 
  convertGpsCoordinates, 
  createElementFromTemplate, 
  clearElement, 
  createGoogleMapsLink 
} from '../src/utils.js';

describe('Utility Functions', () => {
  describe('formatDuration', () => {
    it('formats seconds correctly', () => {
      expect(formatDuration(45)).toBe('0m 45s');
    });

    it('formats minutes and seconds correctly', () => {
      expect(formatDuration(125)).toBe('2m 5s');
      expect(formatDuration(3600)).toBe('1h 0m 0s');
    });

    it('formats hours, minutes and seconds correctly', () => {
      expect(formatDuration(3665)).toBe('1h 1m 5s');
      expect(formatDuration(7322)).toBe('2h 2m 2s');
    });

    it('handles zero correctly', () => {
      expect(formatDuration(0)).toBe('0m 0s');
    });
  });

  describe('matchesTimeRange', () => {
    it('correctly identifies 2-5 minute range', () => {
      expect(matchesTimeRange('2to5', 3, 0.05)).toBe(true);
      expect(matchesTimeRange('2to5', 1.5, 0.025)).toBe(false);
      expect(matchesTimeRange('2to5', 5.5, 0.092)).toBe(false);
    });

    it('correctly identifies 5-10 minute range', () => {
      expect(matchesTimeRange('5to10', 7, 0.117)).toBe(true);
      expect(matchesTimeRange('5to10', 4, 0.067)).toBe(false);
      expect(matchesTimeRange('5to10', 11, 0.183)).toBe(false);
    });

    it('correctly identifies hour ranges', () => {
      expect(matchesTimeRange('1to2hours', 90, 1.5)).toBe(true);
      expect(matchesTimeRange('1to2hours', 45, 0.75)).toBe(false);
      expect(matchesTimeRange('1to2hours', 130, 2.17)).toBe(false);
    });

    it('correctly identifies over 2 hours', () => {
      expect(matchesTimeRange('over2hours', 150, 2.5)).toBe(true);
      expect(matchesTimeRange('over2hours', 90, 1.5)).toBe(false);
    });

    it('returns false for unknown ranges', () => {
      expect(matchesTimeRange('unknown', 30, 0.5)).toBe(false);
    });
  });

  describe('convertGpsCoordinates', () => {
    it('converts semicircle coordinates to decimal degrees', () => {
      const records = [
        {
          positionLat: 612553967, // Convert to decimal degrees for testing
          positionLong: -2193335
        },
        {
          positionLat: 612553968,
          positionLong: -2193336
        }
      ];

      const result = convertGpsCoordinates(records);
      
      expect(result).toHaveLength(2);
      // Test the actual conversion formula
      const expectedLat = 612553967 * (180 / Math.pow(2, 31));
      const expectedLng = -2193335 * (180 / Math.pow(2, 31));
      expect(result[0][0]).toBeCloseTo(expectedLat, 6);
      expect(result[0][1]).toBeCloseTo(expectedLng, 6);
    });

    it('filters out records without GPS coordinates', () => {
      const records = [
        { positionLat: 612553967, positionLong: -2193335 },
        { positionLat: null, positionLong: -2193335 },
        { positionLat: 612553967, positionLong: null },
        { timestamp: new Date() } // No GPS at all
      ];

      const result = convertGpsCoordinates(records);
      expect(result).toHaveLength(1);
    });

    it('handles empty array', () => {
      expect(convertGpsCoordinates([])).toEqual([]);
    });
  });

  describe('createElementFromTemplate', () => {
    beforeEach(() => {
      // Reset mocks before each test
      vi.clearAllMocks();
    });

    it('creates element from template with data', () => {
      const mockTemplate = {
        content: {
          cloneNode: vi.fn(() => ({
            querySelectorAll: vi.fn(() => [{
              textContent: ''
            }]),
            appendChild: vi.fn()
          }))
        }
      };

      global.document.getElementById = vi.fn(() => mockTemplate);

      const result = createElementFromTemplate('test-template', {
        'test-field': 'test value'
      });

      expect(global.document.getElementById).toHaveBeenCalledWith('test-template');
      expect(mockTemplate.content.cloneNode).toHaveBeenCalledWith(true);
      expect(result).toBeDefined();
    });

    it('returns null when template not found', () => {
      global.document.getElementById = vi.fn(() => null);
      global.console.error = vi.fn();

      const result = createElementFromTemplate('missing-template', {});

      expect(result).toBeNull();
      expect(global.console.error).toHaveBeenCalledWith('Template not found: missing-template');
    });

    it('handles href data field specially', () => {
      const mockElement = { href: '' };
      const mockTemplate = {
        content: {
          cloneNode: vi.fn(() => ({
            querySelectorAll: vi.fn(() => [mockElement]),
            appendChild: vi.fn()
          }))
        }
      };

      global.document.getElementById = vi.fn(() => mockTemplate);

      createElementFromTemplate('test-template', {
        'href': 'https://example.com'
      });

      expect(mockElement.href).toBe('https://example.com');
    });
  });

  describe('clearElement', () => {
    it('removes all child elements', () => {
      const mockChild1 = { remove: vi.fn() };
      const mockChild2 = { remove: vi.fn() };
      
      const mockElement = {
        firstChild: mockChild1,
        removeChild: vi.fn(() => {
          // Simulate removing first child
          mockElement.firstChild = mockElement.firstChild === mockChild1 ? mockChild2 : null;
        })
      };

      clearElement(mockElement);

      expect(mockElement.removeChild).toHaveBeenCalled();
    });

    it('handles empty element', () => {
      const mockElement = {
        firstChild: null,
        removeChild: vi.fn()
      };

      clearElement(mockElement);

      expect(mockElement.removeChild).not.toHaveBeenCalled();
    });
  });

  describe('createGoogleMapsLink', () => {
    it('creates link with correct attributes', () => {
      const result = createGoogleMapsLink(51.5074, -0.1278);

      expect(result.href).toBe('https://www.google.com/maps?q=51.5074,-0.1278');
      expect(result.target).toBe('_blank');
      expect(result.className).toBe('google-maps-link');
      expect(result.textContent).toBe('📍 View on Google Maps');
    });

    it('uses custom text when provided', () => {
      const result = createGoogleMapsLink(51.5074, -0.1278, 'Custom Text');

      expect(result.textContent).toBe('Custom Text');
    });

    it('handles negative coordinates', () => {
      const result = createGoogleMapsLink(-33.8688, 151.2093); // Sydney

      expect(result.href).toBe('https://www.google.com/maps?q=-33.8688,151.2093');
    });
  });
});