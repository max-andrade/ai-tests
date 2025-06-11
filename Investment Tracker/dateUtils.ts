// dateUtils.ts

/**
 * Parses a 'YYYY-MM-DDTHH:mm[:ss[.SSS]]' string into a Date object,
 * interpreting the input as local time components.
 * If the string is 'YYYY-MM-DD', it's treated as 'YYYY-MM-DDTHH:00:00' local time.
 * @param dateTimeStringInput The string to parse.
 * @returns A Date object representing the local time, or null if parsing fails.
 */
export const parseDateTimeLocalString = (dateTimeStringInput: string): Date | null => {
  if (!dateTimeStringInput) return null;

  let dateTimeString = dateTimeStringInput;

  // Handle date-only string by appending T00:00
  const dateOnlyRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  if (dateOnlyRegex.test(dateTimeString)) {
    dateTimeString = `${dateTimeString}T00:00`;
  }

  // Regex for YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.SSS
  const dateTimeRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/;
  const match = dateTimeString.match(dateTimeRegex);

  if (!match) {
    console.warn("parseDateTimeLocalString: Invalid format for local date-time string:", dateTimeStringInput);
    // Fallback: If the string is a full ISO string with Z or offset, new Date() will handle it.
    // However, this function is INTENDED for strings *without* timezone info, to be treated as local.
    // If a full ISO string is passed here, it might not be what the caller intended if they expected local interpretation.
    const d = new Date(dateTimeStringInput);
    if (!isNaN(d.getTime())) {
        console.warn(`parseDateTimeLocalString: Fallback to 'new Date()' for '${dateTimeStringInput}'. This might not reflect local interpretation if the string had timezone info. Resulting date (ISO): ${d.toISOString()}`);
        return d;
    }
    console.error(`parseDateTimeLocalString: Fallback 'new Date()' also failed for '${dateTimeStringInput}'.`);
    return null;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10); // 1-12
  const day = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  const seconds = match[6] ? parseInt(match[6], 10) : 0;
  // Milliseconds are ignored from input for simplicity, aligning with datetime-local step='1' (seconds)

  // Construct Date object using local time components.
  // Month is 0-indexed in Date constructor.
  const dateObj = new Date(year, month - 1, day, hours, minutes, seconds);

  if (isNaN(dateObj.getTime())) {
    console.warn("parseDateTimeLocalString: Constructed Date is invalid from components:", dateTimeString);
    return null;
  }
  
  // Verify components to catch out-of-range values that Date constructor might adjust
  // This check ensures that the input string represented a valid calendar date/time.
  if (dateObj.getFullYear() !== year || 
      (dateObj.getMonth() + 1) !== month || 
      dateObj.getDate() !== day ||
      dateObj.getHours() !== hours ||
      dateObj.getMinutes() !== minutes ||
      dateObj.getSeconds() !== seconds
     ) {
    console.warn("parseDateTimeLocalString: Date components were adjusted by Date constructor (likely invalid input values like month 13):", dateTimeString, "Constructed:", formatToDateTimeLocalString(dateObj));
    return null; // Input was not a valid local date-time representation.
  }
  return dateObj;
};

/**
 * Formats a Date object into a 'YYYY-MM-DDTHH:mm' string in the runtime's local timezone.
 * Suitable for datetime-local input values. Omits seconds for broader compatibility.
 * @param date The Date object to format.
 * @returns A string in 'YYYY-MM-DDTHH:mm' format (local time), or an empty string if date is null/invalid.
 */
export const formatToDateTimeLocalString = (date: Date | null | undefined): string => {
  if (!date || isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  // Seconds are generally not included for datetime-local value, default step is minutes.
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};


/**
 * Gets the current date and time as a string formatted for datetime-local input.
 * E.g., "YYYY-MM-DDTHH:mm" in local time.
 * @returns {string} The formatted local date-time string.
 */
export const getCurrentDateTimeLocalString = (): string => {
  const now = new Date();
  return formatToDateTimeLocalString(now);
};

/**
 * Converts a local date-time string (typically from datetime-local input, e.g., "2023-10-27T14:30") 
 * to a full UTC ISO8601 string (e.g., "2023-10-27T04:30:00.000Z" if local was UTC+10).
 * @param localDateTimeString The local date-time string.
 * @returns UTC ISO8601 string, or null if input is invalid.
 */
export const convertLocalToUTCISO = (localDateTimeString: string): string | null => {
  if (!localDateTimeString) return null;
  const date = parseDateTimeLocalString(localDateTimeString);
  if (!date) {
    console.warn(`convertLocalToUTCISO: Could not parse localDateTimeString: ${localDateTimeString}`);
    return null;
  }
  return date.toISOString();
};

/**
 * Converts a UTC ISO8601 string (e.g., "2023-10-27T04:30:00.000Z") 
 * to a local date-time string ('YYYY-MM-DDTHH:mm') suitable for datetime-local input fields.
 * @param utcIsoString The UTC ISO8601 string.
 * @returns Local date-time string (e.g., "2023-10-27T14:30" if local is UTC+10), or empty string if input is invalid/null.
 */
export const convertUTCIsoToLocalDateTimeString = (utcIsoString: string | null | undefined): string => {
  if (!utcIsoString) return '';
  const date = new Date(utcIsoString); // 'new Date()' parses ISO8601 strings (including 'Z' or offsets) correctly to represent a specific point in time.
  if (isNaN(date.getTime())) {
    console.warn(`convertUTCIsoToLocalDateTimeString: Could not parse utcIsoString: ${utcIsoString}`);
    return '';
  }
  // formatToDateTimeLocalString will then use the Date object's local representations.
  return formatToDateTimeLocalString(date);
};