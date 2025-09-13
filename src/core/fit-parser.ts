// =============================================================================
// FIT FILE PARSING LOGIC
// =============================================================================

import { Decoder, Stream } from '@garmin/fitsdk';
import { FitData, FitSession, FitRecord, ActivityTimes } from '../types/app-types';

/**
 * Decodes a FIT file and returns the parsed data
 */
export async function decodeFitFile(file: File): Promise<FitData> {
  const arrayBuffer = await file.arrayBuffer();
  const fileStream = Stream.fromByteArray(new Uint8Array(arrayBuffer));
  const fileDecoder = new Decoder(fileStream);
  const { messages: fitData, errors: fitErrors } = fileDecoder.read();

  if (fitErrors.length > 0) {
    console.warn('FIT parsing errors:', fitErrors);
  }

  return fitData;
}

/**
 * Extracts basic activity timing and distance information from sessions and records
 */
export function extractActivityTimes(sessions: FitSession[], records: FitRecord[]): ActivityTimes {
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