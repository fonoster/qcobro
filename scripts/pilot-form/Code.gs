// QCobro pilot form → "QCobro Form" sheet (web app behind qcobro.com's pilot modal).
//
// Writes each submission by header name: every row-1 header becomes a column,
// filled from the matching key of the JSON body ("timestamp" is the save time).
// Capturing a new form field only needs a new header in the sheet.
//
// The site posts with fetch(mode: "no-cors"), so the body arrives as text/plain
// JSON in e.postData.contents and the response is never read.

// Meta ids are 18 digits; stored as numbers they'd lose precision.
var TEXT_COLUMN = /_id$/;

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var row = sheet.getLastRow() + 1;

    headers.forEach(function (h, i) {
      if (TEXT_COLUMN.test(h)) sheet.getRange(row, i + 1).setNumberFormat('@');
    });
    sheet.getRange(row, 1, 1, headers.length).setValues([headers.map(function (h) {
      if (h === 'timestamp') return new Date();
      var v = data[h];
      return v === undefined || v === null ? '' : v;
    })]);
  } finally {
    lock.releaseLock();
  }
  return ContentService
    .createTextOutput(JSON.stringify({ result: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}
