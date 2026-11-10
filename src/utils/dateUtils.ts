// Shared Date Formatting Utilities for Multiple MOT Admin App
// Formats dates strictly into British English (UK standard: D MMM YYYY / DD-MM-YYYY)
// Safely handles ISO strings (e.g. 2027-05-06T00:00:00.000Z), UK dates (DD/MM/YYYY), Date objects, and timestamps.

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface ParsedDateComponents {
  year: number;
  month: number; // 0-indexed (0 = Jan, 11 = Dec)
  day: number;
  hours: number | null;
  minutes: number | null;
  weekday: number; // 0 = Sun, 6 = Sat
  isMidnight: boolean;
}

/**
 * Checks whether an ISO string is purely a calendar date stored at midnight (e.g. 2027-05-06T00:00:00.000Z or 2027-05-06)
 */
function isDateOnlyOrMidnight(str: string): boolean {
  return /^\d{4}-\d{1,2}-\d{1,2}(?:[T\s]00:00(?::00(?:\.000)?)?(?:Z|[+-]00:?00)?)?$/.test(str);
}

/**
 * Robustly parses various date formats without shifting calendar days due to time zones.
 */
export function parseDateComponents(dateVal: any): ParsedDateComponents | null {
  if (!dateVal && dateVal !== 0) return null;

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed) return null;

    // 1. UK format: DD/MM/YYYY or DD-MM-YYYY (e.g. 06/05/2027, 06-05-2027)
    const matchUk = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s](\d{1,2}):(\d{2}))?/);
    if (matchUk) {
      const day = parseInt(matchUk[1], 10);
      const month = parseInt(matchUk[2], 10) - 1;
      const year = parseInt(matchUk[3], 10);
      const hours = matchUk[4] !== undefined ? parseInt(matchUk[4], 10) : null;
      const minutes = matchUk[5] !== undefined ? parseInt(matchUk[5], 10) : null;
      if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
        const weekday = new Date(year, month, day).getDay();
        return { year, month, day, hours, minutes, weekday, isMidnight: hours === 0 && minutes === 0 };
      }
    }

    // 2. Pure calendar date or midnight ISO: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss where HH:mm is 00:00
    // Parse strictly by regex to NEVER shift calendar days across timezones for booking/expiry dates
    if (isDateOnlyOrMidnight(trimmed)) {
      const matchIso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (matchIso) {
        const year = parseInt(matchIso[1], 10);
        const month = parseInt(matchIso[2], 10) - 1;
        const day = parseInt(matchIso[3], 10);
        if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
          const weekday = new Date(year, month, day).getDay();
          return { year, month, day, hours: 0, minutes: 0, weekday, isMidnight: true };
        }
      }
    }

    // 3. ISO format with a non-zero time (e.g. 2026-11-10T14:35:12.123Z)
    // Use standard Date parser so UTC is converted to local display time
    try {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return {
          year: d.getFullYear(),
          month: d.getMonth(),
          day: d.getDate(),
          hours: d.getHours(),
          minutes: d.getMinutes(),
          weekday: d.getDay(),
          isMidnight: false,
        };
      }
    } catch (e) {}

    // 4. ISO fallback if Date() constructor had trouble
    const matchIsoGeneral = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?/);
    if (matchIsoGeneral) {
      const year = parseInt(matchIsoGeneral[1], 10);
      const month = parseInt(matchIsoGeneral[2], 10) - 1;
      const day = parseInt(matchIsoGeneral[3], 10);
      const hours = matchIsoGeneral[4] !== undefined ? parseInt(matchIsoGeneral[4], 10) : null;
      const minutes = matchIsoGeneral[5] !== undefined ? parseInt(matchIsoGeneral[5], 10) : null;
      if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
        const weekday = new Date(year, month, day).getDay();
        return { year, month, day, hours, minutes, weekday, isMidnight: hours === 0 && minutes === 0 };
      }
    }
  }

  // Fallback for Date objects or timestamp numbers
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate(),
        hours: d.getHours(),
        minutes: d.getMinutes(),
        weekday: d.getDay(),
        isMidnight: d.getHours() === 0 && d.getMinutes() === 0,
      };
    }
  } catch (e) {}

  return null;
}

/**
 * Primary booking & calendar date formatter:
 * e.g. "6 May 2027" or "Thu, 6 May 2027"
 */
export function formatBookingDate(dateVal: any, includeWeekday: boolean = false): string {
  if (!dateVal) return 'Date not specified';
  const c = parseDateComponents(dateVal);
  if (!c) {
    const str = String(dateVal).split('T')[0].trim();
    return str || 'Date not specified';
  }
  const dateStr = `${c.day} ${MONTHS_SHORT[c.month]} ${c.year}`;
  if (includeWeekday && c.weekday !== undefined && !isNaN(c.weekday)) {
    return `${DAYS_SHORT[c.weekday]}, ${dateStr}`;
  }
  return dateStr;
}

/**
 * Format date including weekday abbreviation: e.g. "Thu, 6 May 2027"
 */
export function formatDateWithWeekday(dateVal: any): string {
  return formatBookingDate(dateVal, true);
}

/**
 * Short date: e.g. "6 May 2027"
 */
export function formatShortDate(dateVal: any, fallback: string = 'N/A'): string {
  if (!dateVal) return fallback;
  const c = parseDateComponents(dateVal);
  if (!c) {
    const str = String(dateVal).split('T')[0].trim();
    return str || fallback;
  }
  return `${c.day} ${MONTHS_SHORT[c.month]} ${c.year}`;
}

/**
 * Compact day + month: e.g. "6 May"
 */
export function formatShortDayMonth(dateVal: any): string {
  if (!dateVal) return 'N/A';
  const c = parseDateComponents(dateVal);
  if (!c) return String(dateVal).split('T')[0].trim() || 'N/A';
  return `${c.day} ${MONTHS_SHORT[c.month]}`;
}

/**
 * Date with time: e.g. "10 Nov 2026, 14:35" (suppresses 00:00 if date is purely calendar/midnight)
 */
export function formatDateTime(dateVal: any, fallback: string = 'N/A'): string {
  if (!dateVal) return fallback;
  const c = parseDateComponents(dateVal);
  if (!c) return String(dateVal).split('T')[0].trim() || fallback;
  const dateStr = `${c.day} ${MONTHS_SHORT[c.month]} ${c.year}`;
  if (!c.isMidnight && c.hours !== null && c.minutes !== null) {
    const hh = String(c.hours).padStart(2, '0');
    const mm = String(c.minutes).padStart(2, '0');
    return `${dateStr}, ${hh}:${mm}`;
  }
  return dateStr;
}

/**
 * Audit log date-time: always includes 24h time e.g. "10 Nov 2026, 14:35"
 */
export function formatAuditDateTime(dateVal: any, fallback: string = 'N/A'): string {
  if (!dateVal) return fallback;
  const c = parseDateComponents(dateVal);
  if (!c) return String(dateVal).split('T')[0].trim() || fallback;
  const dateStr = `${c.day} ${MONTHS_SHORT[c.month]} ${c.year}`;
  const hh = String(c.hours ?? 0).padStart(2, '0');
  const mm = String(c.minutes ?? 0).padStart(2, '0');
  return `${dateStr}, ${hh}:${mm}`;
}

/**
 * Member since: e.g. "May 2027"
 */
export function formatMemberSince(dateVal: any): string {
  if (!dateVal) return 'Recent';
  const c = parseDateComponents(dateVal);
  if (!c) return 'Recent';
  return `${MONTHS_LONG[c.month]} ${c.year}`;
}

/**
 * Formats a Date object to standard DD-MM-YYYY string for query params / calendar keys
 */
export function formatToDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

