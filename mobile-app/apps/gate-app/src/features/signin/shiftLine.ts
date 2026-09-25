import { stamp } from "../../utils/time";

/**
 * The line under the guard's name: the society, and when this shift started
 * on the handset. The prototype's "Main gate · shift 2pm–10pm" came from a
 * roster; the API has no gates or rosters yet (MASTER_SPEC C9), so the only
 * true shift time is when this guard first unlocked the handset.
 */
export function shiftLine(societyName: string, shiftStartedAt: string | null): string {
  return shiftStartedAt ? `${societyName} · since ${stamp(new Date(shiftStartedAt))}` : societyName;
}
