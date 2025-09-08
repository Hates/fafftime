// Tests for data analysis functions
import { findTimestampGaps, extractActivityTimes, processSlowSequence } from '../src/analysis.js';

describe('Data Analysis Functions', () => {
  describe('findTimestampGaps', () => {
    it('identifies gaps larger than 5 minutes', () => {
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

      const gaps = findTimestampGaps(records);
      
      expect(gaps).toHaveLength(1);
      expect(gaps[0].gapDurationMinutes).toBe(10);
      expect(gaps[0].startTime).toEqual(records[0].timestamp);
      expect(gaps[0].endTime).toEqual(records[1].timestamp);
    });

    it('ignores gaps smaller than 5 minutes', () => {
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

      const gaps = findTimestampGaps(records);
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

      const gaps = findTimestampGaps(records);
      
      expect(gaps).toHaveLength(1);
      expect(gaps[0].startGpsPoint).toBeNull();
      expect(gaps[0].endGpsPoint).toBeNull();
    });

    it('handles empty records array', () => {
      expect(findTimestampGaps([])).toEqual([]);
    });
  });

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
  });
});