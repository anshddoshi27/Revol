export function timeStringToMinutes(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
}

export function zonedMinutesToDate(date: Date, minutes: number, timeZone: string): Date {
  const baseParts = getDateParts(date, timeZone);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const utcDate = new Date(Date.UTC(baseParts.year, baseParts.month - 1, baseParts.day, hours, mins));
  const offset = getOffsetMinutes(utcDate, timeZone);
  return new Date(utcDate.getTime() - offset * 60_000);
}

export function formatInTimeZone(
  isoString: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions | string
): string {
  // Handle both string and Date inputs
  let date: Date;
  if (isoString instanceof Date) {
    date = isoString;
  } else if (typeof isoString === 'string') {
    // Validate string is not empty
    if (!isoString || isoString.trim() === '') {
      console.error(`[formatInTimeZone] Empty date string provided`);
      return 'Invalid Date';
    }
    date = new Date(isoString);
  } else {
    console.error(`[formatInTimeZone] Invalid input type:`, typeof isoString, isoString);
    return 'Invalid Date';
  }
  
  // Validate the date
  if (isNaN(date.getTime())) {
    console.error(`[formatInTimeZone] Invalid date value:`, isoString);
    return 'Invalid Date';
  }
  
  // Handle string format option (like "yyyy-MM-dd")
  if (typeof options === 'string') {
    // For simple date format strings, use a basic formatter
    const formatter = new Intl.DateTimeFormat("en-US", { 
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    
    // Replace format string placeholders
    return options
      .replace('yyyy', year)
      .replace('MM', month)
      .replace('dd', day);
  }
  
  // Handle Intl.DateTimeFormatOptions
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, ...options });
  return formatter.format(date);
}

function getDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? date.getUTCFullYear()),
    month: Number(parts.find((part) => part.type === "month")?.value ?? date.getUTCMonth() + 1),
    day: Number(parts.find((part) => part.type === "day")?.value ?? date.getUTCDate())
  };
}

function getOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? date.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value ?? date.getUTCMonth() + 1);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? date.getUTCDate());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? date.getUTCHours());
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? date.getUTCMinutes());
  const asUTC = Date.UTC(year, month - 1, day, hour, minute);
  return (asUTC - date.getTime()) / 60_000;
}


