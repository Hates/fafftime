// Tests for core utility functions
import { describe, expect, it } from 'vitest';
import {
  extractActivityTimes,
  findTimestampGaps,
  findSlowPeriodsWithRanges,
  processSlowSequence,
  formatDuration,
  matchesTimeRange,
  convertGpsCoordinates
} from '../src/main';

// Type definitions for test data
interface TestFitRecord {
  timestamp?: Date;
  speed?: number;
  enhancedSpeed?: number;
  distance?: number;
  positionLat?: number;
  positionLong?: number;
}

interface TestFitSession {
  startTime?: Date;
  totalTimerTime?: number;
  totalElapsedTime?: number;
  totalDistance?: number;
}

type TestTimeRange = '2to5' | '5to10' | '10to30' | '30to60' | '1to2hours' | 'over2hours';

describe('Core Logic Functions', () => {
  // Tests ordered to match main.js function order
  describe('findSlowPeriodsWithRanges', () => {
    const createTestRecord = (timestamp: Date, speed: number, distance: number = 0): TestFitRecord => ({
      timestamp,
      speed,
      distance
    });

    it('returns empty array when no ranges selected', () => {
      const records: TestFitRecord[] = [
        createTestRecord(new Date('2024-01-01T10:00:00Z'), 0.5),
        createTestRecord(new Date('2024-01-01T10:05:00Z'), 0.5)
      ];

      const result = findSlowPeriodsWithRanges(records, []);
      expect(result).toEqual([]);
    });

    it('finds slow periods that match selected time ranges', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const records: TestFitRecord[] = [
        // Fast period
        createTestRecord(new Date(baseTime.getTime()), 2.0, 0),
        createTestRecord(new Date(baseTime.getTime() + 60000), 2.0, 100),
        // 6-minute slow period (should match 5to10 range)
        createTestRecord(new Date(baseTime.getTime() + 120000), 0.5, 200),
        createTestRecord(new Date(baseTime.getTime() + 180000), 0.5, 220),
        createTestRecord(new Date(baseTime.getTime() + 240000), 0.5, 240),
        createTestRecord(new Date(baseTime.getTime() + 300000), 0.5, 260),
        createTestRecord(new Date(baseTime.getTime() + 360000), 0.5, 280),
        createTestRecord(new Date(baseTime.getTime() + 480000), 0.5, 300),
        // Fast period again
        createTestRecord(new Date(baseTime.getTime() + 540000), 2.0, 400)
      ];

      const result = findSlowPeriodsWithRanges(records, ['5to10']);

      expect(result).toHaveLength(1);
      expect(result[0].startTime).toEqual(records[2].timestamp);
      expect(result[0].endTime).toEqual(records[7].timestamp); // Last slow record before fast
      expect(result[0].recordCount).toBe(6); // All slow records
      expect(result[0].isGap).toBeUndefined();
    });

    it('filters out slow periods that do not match selected ranges', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const records: TestFitRecord[] = [
        // 3-minute slow period (should NOT match 5to10 range)
        createTestRecord(new Date(baseTime.getTime()), 0.5, 0),
        createTestRecord(new Date(baseTime.getTime() + 60000), 0.5, 20),
        createTestRecord(new Date(baseTime.getTime() + 180000), 0.5, 40),
        // Fast period
        createTestRecord(new Date(baseTime.getTime() + 240000), 2.0, 100)
      ];

      const result = findSlowPeriodsWithRanges(records, ['5to10']);
      expect(result).toHaveLength(0);
    });

    it('handles multiple slow periods with different ranges', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const records: TestFitRecord[] = [
        // 3-minute slow period (matches 2to5)
        createTestRecord(new Date(baseTime.getTime()), 0.5, 0),
        createTestRecord(new Date(baseTime.getTime() + 60000), 0.5, 20),
        createTestRecord(new Date(baseTime.getTime() + 180000), 0.5, 40),
        // Fast period
        createTestRecord(new Date(baseTime.getTime() + 240000), 2.0, 100),
        // 7-minute slow period (matches 5to10)
        createTestRecord(new Date(baseTime.getTime() + 300000), 0.5, 150),
        createTestRecord(new Date(baseTime.getTime() + 360000), 0.5, 170),
        createTestRecord(new Date(baseTime.getTime() + 420000), 0.5, 190),
        createTestRecord(new Date(baseTime.getTime() + 480000), 0.5, 210),
        createTestRecord(new Date(baseTime.getTime() + 540000), 0.5, 230),
        createTestRecord(new Date(baseTime.getTime() + 600000), 0.5, 250),
        createTestRecord(new Date(baseTime.getTime() + 720000), 0.5, 270),
        // Fast period
        createTestRecord(new Date(baseTime.getTime() + 780000), 2.0, 350)
      ];

      const result = findSlowPeriodsWithRanges(records, ['2to5', '5to10']);

      expect(result).toHaveLength(2);
      // Results should be sorted chronologically
      expect(result[0].startTime).toEqual(records[0].timestamp);
      expect(result[1].startTime).toEqual(records[4].timestamp);
    });

    it('uses enhanced speed over regular speed when available', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const records: TestFitRecord[] = [
        {
          timestamp: new Date(baseTime.getTime()),
          speed: 2.0, // Fast regular speed
          enhancedSpeed: 0.5, // Slow enhanced speed (should be used)
          distance: 0
        },
        {
          timestamp: new Date(baseTime.getTime() + 60000), // 1 minute later
          speed: 2.0,
          enhancedSpeed: 0.5,
          distance: 30
        },
        {
          timestamp: new Date(baseTime.getTime() + 120000), // 2 minutes later
          speed: 2.0,
          enhancedSpeed: 0.5,
          distance: 50
        },
        {
          timestamp: new Date(baseTime.getTime() + 240000), // 4 minutes total duration
          speed: 5.0, // Fast speed to end the slow period
          enhancedSpeed: 5.0,
          distance: 100
        }
      ];

      const result = findSlowPeriodsWithRanges(records, ['2to5']);

      expect(result).toHaveLength(1);
      expect(result[0].recordCount).toBe(3); // Three slow records
    });

    it('handles activity ending with slow period', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const records: TestFitRecord[] = [
        // Fast period
        createTestRecord(new Date(baseTime.getTime()), 2.0, 0),
        // Slow period at the end (6 minutes)
        createTestRecord(new Date(baseTime.getTime() + 60000), 0.5, 100),
        createTestRecord(new Date(baseTime.getTime() + 120000), 0.5, 120),
        createTestRecord(new Date(baseTime.getTime() + 180000), 0.5, 140),
        createTestRecord(new Date(baseTime.getTime() + 240000), 0.5, 160),
        createTestRecord(new Date(baseTime.getTime() + 300000), 0.5, 180),
        createTestRecord(new Date(baseTime.getTime() + 420000), 0.5, 200)
      ];

      const result = findSlowPeriodsWithRanges(records, ['5to10']);

      expect(result).toHaveLength(1);
      expect(result[0].startTime).toEqual(records[1].timestamp);
      expect(result[0].endTime).toEqual(records[6].timestamp);
    });

    it('handles records with missing speed data', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const records: TestFitRecord[] = [
        createTestRecord(new Date(baseTime.getTime()), 2.0, 0),
        // Record with no speed data (should default to 0 and be considered slow)
        {
          timestamp: new Date(baseTime.getTime() + 60000),
          distance: 100
        },
        {
          timestamp: new Date(baseTime.getTime() + 180000),
          distance: 120
        },
        {
          timestamp: new Date(baseTime.getTime() + 300000),
          distance: 140
        },
        createTestRecord(new Date(baseTime.getTime() + 360000), 2.0, 200)
      ];

      const result = findSlowPeriodsWithRanges(records, ['2to5']);

      expect(result).toHaveLength(1);
      expect(result[0].recordCount).toBe(3); // Records with missing speed treated as slow
    });

    it('breaks slow periods on large timestamp gaps', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const records: TestFitRecord[] = [
        // First slow period
        createTestRecord(new Date(baseTime.getTime()), 0.5, 0),
        createTestRecord(new Date(baseTime.getTime() + 60000), 0.5, 20),
        createTestRecord(new Date(baseTime.getTime() + 180000), 0.5, 40),
        // Large gap (10 minutes - should break the sequence)
        createTestRecord(new Date(baseTime.getTime() + 780000), 0.5, 60),
        createTestRecord(new Date(baseTime.getTime() + 840000), 0.5, 80),
        createTestRecord(new Date(baseTime.getTime() + 960000), 0.5, 100),
        // Fast period
        createTestRecord(new Date(baseTime.getTime() + 1020000), 2.0, 150)
      ];

      const result = findSlowPeriodsWithRanges(records, ['2to5']);

      // Should find two separate slow periods due to the timestamp gap
      expect(result).toHaveLength(2);
      expect(result[0].recordCount).toBe(3); // First period
      expect(result[1].recordCount).toBe(3); // Second period
    });

    it('sorts results chronologically', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const records: TestFitRecord[] = [
        // First slow period
        createTestRecord(new Date(baseTime.getTime()), 0.5, 0),
        createTestRecord(new Date(baseTime.getTime() + 180000), 0.5, 40),
        // Fast period
        createTestRecord(new Date(baseTime.getTime() + 240000), 2.0, 100),
        // Second slow period
        createTestRecord(new Date(baseTime.getTime() + 300000), 0.5, 150),
        createTestRecord(new Date(baseTime.getTime() + 480000), 0.5, 190),
        // Fast period
        createTestRecord(new Date(baseTime.getTime() + 540000), 2.0, 250)
      ];

      const result = findSlowPeriodsWithRanges(records, ['2to5']);

      expect(result).toHaveLength(2);
      expect(result[0].startTime.getTime()).toBeLessThan(result[1].startTime.getTime());
    });

    it('handles empty records array', () => {
      const result = findSlowPeriodsWithRanges([], ['2to5', '5to10']);
      expect(result).toEqual([]);
    });

    it('includes GPS coordinates when available', () => {
      const baseTime = new Date('2024-01-01T10:00:00Z');
      const records: TestFitRecord[] = [
        {
          timestamp: new Date(baseTime.getTime()),
          speed: 0.5,
          distance: 0,
          positionLat: 612553967,
          positionLong: -2193335
        },
        {
          timestamp: new Date(baseTime.getTime() + 180000),
          speed: 0.5,
          distance: 40,
          positionLat: 612553968,
          positionLong: -2193336
        },
        createTestRecord(new Date(baseTime.getTime() + 240000), 2.0, 100)
      ];

      const result = findSlowPeriodsWithRanges(records, ['2to5']);

      expect(result).toHaveLength(1);
      expect(result[0].gpsPoints).toBeDefined();
      expect(result[0].gpsPoints.length).toBeGreaterThan(0);
    });
  });

  describe('extractActivityTimes', () => {
    it('extracts times from session data', () => {
      const sessions: TestFitSession[] = [{
        startTime: new Date('2024-01-01T10:00:00Z'),
        totalTimerTime: 3600, // 1 hour
        totalElapsedTime: 3900, // 1 hour 5 minutes
        totalDistance: 25000 // 25km
      }];

      const records: TestFitRecord[] = [];

      const result = extractActivityTimes(sessions, records);

      expect(result.startTime).toEqual(sessions[0].startTime);
      expect(result.movingTime).toBe(3600);
      expect(result.totalDistance).toBe(25000);
      expect(result.endTime).toEqual(new Date('2024-01-01T11:05:00Z'));
    });

    it('falls back to records when no session data', () => {
      const sessions: TestFitSession[] = [];
      const records: TestFitRecord[] = [
        { timestamp: new Date('2024-01-01T10:00:00Z') },
        { timestamp: new Date('2024-01-01T11:00:00Z') }
      ];

      const result = extractActivityTimes(sessions, records);

      expect(result.startTime).toEqual(records[0].timestamp);
      expect(result.endTime).toEqual(records[1].timestamp);
      expect(result.movingTime).toBeNull();
      expect(result.totalDistance).toBeNull();
    });

    it('handles empty data', () => {
      const result = extractActivityTimes([], []);

      expect(result.startTime).toBeNull();
      expect(result.endTime).toBeNull();
      expect(result.movingTime).toBeNull();
      expect(result.totalDistance).toBeNull();
    });
  });

  describe('findTimestampGaps', () => {
    it('identifies gaps larger than threshold', () => {
      const records: TestFitRecord[] = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          distance: 1000,
          positionLat: 612553967,
          positionLong: -2193335
        },
        {
          timestamp: new Date('2024-01-01T10:10:00Z'), // 10 minute gap
          distance: 1000,
          positionLat: 612553968,
          positionLong: -2193336
        }
      ];

      const gaps = findTimestampGaps(records, 5 * 60 * 1000); // 5 minute threshold
      
      expect(gaps).toHaveLength(1);
      expect(gaps[0].gapDurationMinutes).toBe(10);
      expect(gaps[0].startTime).toEqual(records[0].timestamp);
      expect(gaps[0].endTime).toEqual(records[1].timestamp);
      expect(gaps[0].startGpsPoint).toHaveLength(2);
      expect(gaps[0].endGpsPoint).toHaveLength(2);
    });

    it('ignores gaps smaller than threshold', () => {
      const records = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          distance: 1000
        },
        {
          timestamp: new Date('2024-01-01T10:02:00Z'), // 2 minute gap
          distance: 1000
        }
      ];

      const gaps = findTimestampGaps(records, 5 * 60 * 1000); // 5 minute threshold
      expect(gaps).toHaveLength(0);
    });

    it('handles records without GPS coordinates', () => {
      const records = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          distance: 1000
          // No GPS coordinates
        },
        {
          timestamp: new Date('2024-01-01T10:10:00Z'),
          distance: 1000
          // No GPS coordinates
        }
      ];

      const gaps = findTimestampGaps(records, 5 * 60 * 1000);
      
      expect(gaps).toHaveLength(1);
      expect(gaps[0].startGpsPoint).toBeNull();
      expect(gaps[0].endGpsPoint).toBeNull();
    });

    it('handles empty records array', () => {
      expect(findTimestampGaps([])).toEqual([]);
    });

    it('skips records without timestamps', () => {
      const records = [
        { timestamp: null, distance: 1000 },
        { timestamp: new Date('2024-01-01T10:00:00Z'), distance: 1000 }
      ];

      const gaps = findTimestampGaps(records);
      expect(gaps).toHaveLength(0);
    });
  });

  describe('processSlowSequence', () => {
    const mockSlowRecords: TestFitRecord[] = [
      {
        timestamp: new Date('2024-01-01T10:00:00Z'),
        distance: 1000,
        positionLat: 612553967,
        positionLong: -2193335
      },
      {
        timestamp: new Date('2024-01-01T10:05:00Z'), // 5 minutes later
        distance: 1000,
        positionLat: 612553968,
        positionLong: -2193336
      }
    ];

    it('processes slow sequence matching selected ranges', () => {
      const selectedRanges: TestTimeRange[] = ['2to5', '5to10'];
      
      const result = processSlowSequence(mockSlowRecords, selectedRanges);

      expect(result).not.toBeNull();
      expect(result.startTime).toEqual(mockSlowRecords[0].timestamp);
      expect(result.endTime).toEqual(mockSlowRecords[1].timestamp);
      expect(result.recordCount).toBe(2);
      expect(result.startDistance).toBe(1000);
      expect(result.endDistance).toBe(1000);
      expect(result.gpsPoints).toHaveLength(2);
    });

    it('returns null when no ranges match', () => {
      const selectedRanges: TestTimeRange[] = ['30to60']; // 5-minute sequence won't match
      
      const result = processSlowSequence(mockSlowRecords, selectedRanges);

      expect(result).toBeNull();
    });

    it('returns null for empty sequence', () => {
      const result = processSlowSequence([], ['2to5']);

      expect(result).toBeNull();
    });

    it('uses fallback end distance when not available', () => {
      const recordsWithoutEndDistance: TestFitRecord[] = [
        {
          timestamp: new Date('2024-01-01T10:00:00Z'),
          distance: 1000,
          positionLat: 612553967,
          positionLong: -2193335
        },
        {
          timestamp: new Date('2024-01-01T10:03:00Z'),
          // No distance property
          positionLat: 612553968,
          positionLong: -2193336
        }
      ];

      const result = processSlowSequence(recordsWithoutEndDistance, ['2to5']);
      expect(result.endDistance).toBe(1000); // Should use start distance as fallback
    });
  });

  describe('formatDuration', () => {
    it('formats seconds correctly', () => {
      expect(formatDuration(45)).toBe('0m 45s');
      expect(formatDuration(0)).toBe('0m 0s');
    });

    it('formats minutes and seconds correctly', () => {
      expect(formatDuration(125)).toBe('2m 5s');
      expect(formatDuration(3600)).toBe('1h 0m 0s');
    });

    it('formats hours, minutes and seconds correctly', () => {
      expect(formatDuration(3665)).toBe('1h 1m 5s');
      expect(formatDuration(7322)).toBe('2h 2m 2s');
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
      expect(matchesTimeRange('over2hours' as any, 30, 0.5)).toBe(false);
    });
  });

  describe('convertGpsCoordinates', () => {
    it('converts semicircle coordinates to decimal degrees', () => {
      const records: TestFitRecord[] = [
        {
          positionLat: 612553967,
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
      const records: TestFitRecord[] = [
        { positionLat: 612553967, positionLong: -2193335 },
        { positionLat: undefined, positionLong: -2193335 },
        { positionLat: 612553967, positionLong: undefined },
        { timestamp: new Date() } // No GPS at all
      ];

      const result = convertGpsCoordinates(records);
      expect(result).toHaveLength(1);
    });

    it('handles empty array', () => {
      expect(convertGpsCoordinates([])).toEqual([]);
    });
  });
});
