/* eslint-disable no-undef, no-unused-vars */
/**
 * AI Pit Crew — Vote submission Apps Script (fallback to EDS form)
 *
 * Deploy: Apps Script editor → Deploy → Web App
 *   Execute as: Me
 *   Who has access: Anyone (or restrict to domain)
 * Copy the web app URL into ai-club-config.json → votingFallbackUrl
 *
 * Sheet name: "votes"
 * Columns:   timestamp | teamSlug | teamName | voterId | mobility | utility | care | brain
 */

const SHEET_NAME = 'votes';
const FIELDS = ['teamSlug', 'teamName', 'voterId', 'mobility', 'utility', 'care', 'brain'];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
      || SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['timestamp', ...FIELDS]);
    }

    sheet.appendRow([new Date().toISOString(), ...FIELDS.map((f) => data[f] || '')]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET ?team=llm-dreamers
 * Returns vote tallies for the requested team.
 * Each voter's last vote per category wins (dedup by voterId).
 */
function doGet(e) {
  const teamSlug = (e.parameter && e.parameter.team) || '';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  if (!sheet || sheet.getLastRow() <= 1) {
    return ContentService
      .createTextOutput(JSON.stringify({}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const rows = sheet.getDataRange().getValues().slice(1); // skip header
  const CATEGORY_FIELDS = ['mobility', 'utility', 'care', 'brain'];
  const fieldIndex = (f) => FIELDS.indexOf(f) + 1; // +1 for timestamp col

  // voterMap[voterId][category] = optionId
  const voterMap = {};
  rows
    .filter((r) => r[fieldIndex('teamSlug') - 1] === teamSlug)
    .forEach((r) => {
      const voterId = r[fieldIndex('voterId') - 1];
      if (!voterMap[voterId]) voterMap[voterId] = {};
      CATEGORY_FIELDS.forEach((cat) => {
        const val = r[fieldIndex(cat) - 1];
        if (val) voterMap[voterId][cat] = val;
      });
    });

  // Count option votes per category
  const counts = {};
  CATEGORY_FIELDS.forEach((cat) => { counts[cat] = {}; });
  Object.values(voterMap).forEach((voterChoices) => {
    CATEGORY_FIELDS.forEach((cat) => {
      const opt = voterChoices[cat];
      if (opt) counts[cat][opt] = (counts[cat][opt] || 0) + 1;
    });
  });

  return ContentService
    .createTextOutput(JSON.stringify(counts))
    .setMimeType(ContentService.MimeType.JSON);
}
