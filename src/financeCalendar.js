export const FINANCE_TIME_ZONE = "Asia/Kuala_Lumpur";

function dateParts(date, timeZone = FINANCE_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (name) => parts.find((item) => item.type === name)?.value;
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function localDateMY(date = new Date()) {
  const { year, month, day } = dateParts(date);
  return year + "-" + month + "-" + day;
}
export function localMonthMY(date = new Date()) {
  return localDateMY(date).slice(0, 7);
}
export function localYearMY(date = new Date()) {
  return localDateMY(date).slice(0, 4);
}
export function requireCalendarDate(dateString) {
  const text = String(dateString || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("Invalid calendar date.");
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== text) throw new Error("Invalid calendar date.");
  return text;
}
export function shiftCalendarDay(dateString, days) {
  const valid = requireCalendarDate(dateString);
  const [y,m,d] = valid.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m-1, d + days));
  return shifted.toISOString().slice(0,10);
}
export function previousCalendarDays(count, asOfDate = localDateMY()) {
  if (!Number.isInteger(count) || count < 1) throw new Error("Invalid day count");
  return shiftCalendarDay(asOfDate, 1-count);
}
export function calendarMonthDays(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid calendar month");
  const [y,m] = month.split("-").map(Number);
  return new Date(Date.UTC(y,m,0)).getUTCDate();
}
export function calendarMonthEnd(month) {
  return month + "-" + String(calendarMonthDays(month)).padStart(2,"0");
}
export function inclusiveCalendarDays(first, last) {
  requireCalendarDate(first); requireCalendarDate(last);
  const asMs = (s) => { const [y,m,d] = s.split("-").map(Number); return Date.UTC(y,m-1,d); };
  return Math.round((asMs(last)-asMs(first))/86400000) + 1;
}
export function calendarDaysRange(start, count) {
  return Array.from({length:count},(_,i)=>shiftCalendarDay(start,i));
}
