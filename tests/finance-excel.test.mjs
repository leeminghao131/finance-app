import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

test("Excel export preserves finance column order, cents and autofilter", () => {
  const headers = ["Date", "Type", "Category", "Method", "Amount", "Note"];
  const rows = [
    [new Date(2026, 10, 8), "expense", "Food", "CASH", 17.65, "Synthetic only"],
    [new Date(2026, 10, 8), "income", "Salary", "BANK", 2500.05, ""],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows], { cellDates: true });
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(worksheet["!ref"])) };
  worksheet["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 40 }];
  worksheet.A2.z = "yyyy-mm-dd";
  worksheet.E2.z = "#,##0.00";
  worksheet.E3.z = "#,##0.00";

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, worksheet, "Finance Records");
  const bytes = XLSX.write(book, { bookType: "xlsx", type: "buffer" });
  assert.ok(bytes.byteLength > 1000, "Workbook must be a valid nonempty XLSX file");

  const recovered = XLSX.read(bytes, { type: "buffer", cellDates: true });
  const sheet = recovered.Sheets["Finance Records"];
  assert.ok(sheet, "Finance Records worksheet exists");
  assert.deepEqual(headers.map((_, i) => sheet[String.fromCharCode(65 + i) + "1"].v), headers);
  assert.equal(sheet.E2.v, 17.65);
  assert.equal(sheet.E3.v, 2500.05);
  assert.equal(sheet.B2.v, "expense");
  assert.equal(sheet.D3.v, "BANK");
  assert.equal(sheet["!autofilter"].ref, "A1:F3");
  assert.ok(sheet.A2.v instanceof Date);
});

test("Excel export writes user text as strings, not executable worksheet formulas", () => {
  const note = "=HYPERLINK(\"https://example.invalid\",\"test\")";
  const sheet = XLSX.utils.aoa_to_sheet([["Note"], [note]]);
  assert.equal(sheet.A2.t, "s");
  assert.equal(sheet.A2.v, note);
  assert.equal(sheet.A2.f, undefined);
});
