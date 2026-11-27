import test from "node:test";
import assert from "node:assert/strict";
import {
  localDateMY, localMonthMY, localYearMY, requireCalendarDate,
  shiftCalendarDay, previousCalendarDays, calendarMonthDays, calendarMonthEnd,
  inclusiveCalendarDays, calendarDaysRange,
} from "../src/financeCalendar.js";

test("Malaysia local date rolls over independently from UTC and browser timezone", () => {
  const utcLate = new Date("2026-11-30T16:30:00Z");
  assert.equal(localDateMY(utcLate), "2026-12-01");
  assert.equal(localMonthMY(utcLate), "2026-12");
  assert.equal(localYearMY(utcLate), "2026");
  assert.equal(localDateMY(new Date("2026-12-31T16:00:00Z")), "2027-01-01");
  assert.equal(localMonthMY(new Date("2026-12-31T16:00:00Z")), "2027-01");
});

test("Calendar arithmetic handles month edges, leap day, year boundaries", () => {
  assert.equal(shiftCalendarDay("2026-11-01",-1),"2026-10-31");
  assert.equal(shiftCalendarDay("2027-01-01",-1),"2026-12-31");
  assert.equal(shiftCalendarDay("2028-02-28",1),"2028-02-29");
  assert.equal(shiftCalendarDay("2028-02-29",1),"2028-03-01");
  assert.equal(calendarMonthDays("2028-02"),29);
  assert.equal(calendarMonthDays("2027-02"),28);
  assert.equal(calendarMonthEnd("2026-11"),"2026-11-30");
  assert.equal(previousCalendarDays(7,"2026-11-02"),"2026-10-27");
  assert.deepEqual(calendarDaysRange("2026-12-30",4),["2026-12-30","2026-12-31","2027-01-01","2027-01-02"]);
  assert.equal(inclusiveCalendarDays("2026-12-31","2027-01-02"),3);
  assert.throws(()=>requireCalendarDate("2026-02-29"));
  assert.throws(()=>requireCalendarDate("2026-13-02"));
  assert.throws(()=>calendarMonthDays("2026-13"));
});
