const ET_TIMEZONE = 'America/New_York';

/**
 * Get date/time parts in Eastern Time
 * Uses Intl.DateTimeFormat (no external dependencies)
 */
function getETDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'long',
    hour12: false
  });

  const parts = {};
  formatter.formatToParts(date).forEach(part => {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  });

  return {
    year: parseInt(parts.year),
    month: parseInt(parts.month),
    day: parseInt(parts.day),
    hour: parseInt(parts.hour),
    minute: parseInt(parts.minute),
    second: parseInt(parts.second),
    weekday: parts.weekday
  };
}

/**
 * Check if date is a weekday (Monday-Friday)
 */
function isWeekday(date) {
  const parts = getETDateParts(date);
  return !['Saturday', 'Sunday'].includes(parts.weekday);
}

/**
 * Check if current time is within market hours (9:30 AM - 4:00 PM ET)
 */
export function isMarketOpen(date = new Date()) {
  // Must be a weekday
  if (!isWeekday(date)) {
    return false;
  }

  const parts = getETDateParts(date);
  const { hour, minute } = parts;

  // Market opens at 9:30 AM
  const isAfterOpen = hour > 9 || (hour === 9 && minute >= 30);

  // Market closes at 4:00 PM (16:00)
  const isBeforeClose = hour < 16;

  return isAfterOpen && isBeforeClose;
}

/**
 * Get timestamp for market close today (4 PM ET)
 * If already past 4 PM, returns tomorrow's close
 */
export function getMarketCloseTime(date = new Date()) {
  const parts = getETDateParts(date);
  const now = date.getTime();

  const currentMinuteOfDay = parts.hour * 60 + parts.minute;
  const closeMinuteOfDay = 16 * 60; // 4:00 PM = 960 minutes

  let minutesUntilClose;
  if (currentMinuteOfDay < closeMinuteOfDay) {
    // Market hasn't closed yet today
    minutesUntilClose = closeMinuteOfDay - currentMinuteOfDay;
  } else {
    // Market already closed, calculate time until tomorrow's close
    minutesUntilClose = (24 * 60 - currentMinuteOfDay) + closeMinuteOfDay;
  }

  return now + (minutesUntilClose * 60 * 1000);
}

/**
 * Get timestamp for next market open (9:30 AM ET)
 */
export function getNextMarketOpen(date = new Date()) {
  const parts = getETDateParts(date);
  const { hour, minute, weekday } = parts;
  const now = date.getTime();

  const currentMinuteOfDay = hour * 60 + minute;
  const openMinuteOfDay = 9 * 60 + 30; // 9:30 AM = 570 minutes

  let minutesUntilOpen;

  // If it's Saturday
  if (weekday === 'Saturday') {
    // Calculate minutes until Monday 9:30 AM
    const minutesUntilMidnight = 24 * 60 - currentMinuteOfDay;
    const minutesForSunday = 24 * 60;
    minutesUntilOpen = minutesUntilMidnight + minutesForSunday + openMinuteOfDay;
  }
  // If it's Sunday
  else if (weekday === 'Sunday') {
    // Calculate minutes until Monday 9:30 AM
    const minutesUntilMidnight = 24 * 60 - currentMinuteOfDay;
    minutesUntilOpen = minutesUntilMidnight + openMinuteOfDay;
  }
  // If it's a weekday before 9:30 AM
  else if (currentMinuteOfDay < openMinuteOfDay) {
    // Market opens today
    minutesUntilOpen = openMinuteOfDay - currentMinuteOfDay;
  }
  // If it's a weekday after 9:30 AM (including after market close)
  else {
    // Market opens next trading day
    if (weekday === 'Friday') {
      // Next open is Monday
      const minutesUntilMidnight = 24 * 60 - currentMinuteOfDay;
      const minutesForSaturday = 24 * 60;
      const minutesForSunday = 24 * 60;
      minutesUntilOpen = minutesUntilMidnight + minutesForSaturday + minutesForSunday + openMinuteOfDay;
    } else {
      // Next open is tomorrow (weekday)
      const minutesUntilMidnight = 24 * 60 - currentMinuteOfDay;
      minutesUntilOpen = minutesUntilMidnight + openMinuteOfDay;
    }
  }

  return now + (minutesUntilOpen * 60 * 1000);
}

/**
 * Calculate cache duration based on data type and market status
 * @param {string} cacheType - 'quote', 'chart', 'chart_weekly', or 'listing'
 * @param {number} timestamp - When the data was cached (milliseconds)
 * @returns {number} Cache duration in milliseconds
 */
export function getCacheDuration(cacheType, timestamp = Date.now()) {
  const cacheDate = new Date(timestamp);

  switch (cacheType) {
    case 'quote':
      if (isMarketOpen(cacheDate)) {
        // During market hours: cache for 2 minutes
        return 2 * 60 * 1000;
      } else {
        // After hours: cache until next market open
        const nextOpen = getNextMarketOpen(cacheDate);
        const duration = nextOpen - timestamp;
        // Ensure at least 1 minute cache (safety)
        return Math.max(60 * 1000, duration);
      }

    case 'chart':
      // Cache until market close (data is complete for the day at close)
      const closeTime = getMarketCloseTime(cacheDate);
      const duration = closeTime - timestamp;
      // Ensure at least 1 minute cache (safety)
      return Math.max(60 * 1000, duration);

    case 'chart_weekly':
      // Weekly data changes less frequently - cache for 7 days
      return 7 * 24 * 60 * 60 * 1000;

    case 'listing':
      // Listing data: cache for 30 days
      return 30 * 24 * 60 * 60 * 1000;

    default:
      // Fallback: 7 days
      return 7 * 24 * 60 * 60 * 1000;
  }
}

// Export helper functions for testing/debugging
export const _internal = {
  getETDateParts,
  isWeekday
};
