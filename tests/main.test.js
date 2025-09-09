// Tests for core utility functions
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractActivityTimes,
  findTimestampGaps,
  processSlowSequence,
  formatDuration,
  matchesTimeRange,
  convertGpsCoordinates
} from '../src/main.js';


describe('Core Logic Functions', () => {
  // Tests ordered to match main.js function order

  describe('extractActivityTimes', () => {
    it('extracts times from session data', () => {
      const sessions = [{
        startTime: new Date('2024-01-01T10:00:00Z'),
        totalTimerTime: 3600, // 1 hour
        totalElapsedTime: 3900, // 1 hour 5 minutes
        totalDistance: 25000 // 25km
      }];

      const records = [];

      const result = extractActivityTimes(sessions, records);

      expect(result.startTime).toEqual(sessions[0].startTime);
      expect(result.movingTime).toBe(3600);
      expect(result.totalDistance).toBe(25000);
      expect(result.endTime).toEqual(new Date('2024-01-01T11:05:00Z'));
    });

    it('falls back to records when no session data', () => {
      const sessions = [];
      const records = [
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
      const records = [
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
    const mockSlowRecords = [
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
      const selectedRanges = ['2to5', '5to10'];
      
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
      const selectedRanges = ['30to60']; // 5-minute sequence won't match
      
      const result = processSlowSequence(mockSlowRecords, selectedRanges);

      expect(result).toBeNull();
    });

    it('returns null for empty sequence', () => {
      const result = processSlowSequence([], ['2to5']);

      expect(result).toBeNull();
    });

    it('uses fallback end distance when not available', () => {
      const recordsWithoutEndDistance = [
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
      expect(matchesTimeRange('unknown', 30, 0.5)).toBe(false);
    });
  });

  describe('convertGpsCoordinates', () => {
    it('converts semicircle coordinates to decimal degrees', () => {
      const records = [
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
});