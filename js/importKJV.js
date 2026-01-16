/**
 * importKJV.js
 * -----------------------------------------------------------------------------
 * Robust XML importer for files shaped like:
 *
 * <bible>
 *   <testament>
 *     <book number="1">
 *       <chapter number="1">
 *         <verse number="1">Text...</verse>
 *
 * The XML you provided uses book "number" instead of book "name".
 * We map book numbers (1..66) to canonical names used by the app.
 * -----------------------------------------------------------------------------
 */

import { openDb, stores, putMany } from "./db.js";

// Canonical book names (must match app.js BOOKS list)
const BOOKS = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy",
  "Joshua","Judges","Ruth","1 Samuel","2 Samuel",
  "1 Kings","2 Kings","1 Chronicles","2 Chronicles",
  "Ezra","Nehemiah","Esther","Job","Psalms","Proverbs",
  "Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations",
  "Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah",
  "Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi",
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians",
  "Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
  "1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter",
  "1 John","2 John","3 John","Jude","Revelation"
];

function normalizeWhitespace(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

/**
 * Generic importer for KJV-shaped XML files.
 * Writes into the provided IndexedDB store.
 */
export async function importBibleFromXML(xmlUrl, storeName, onProgress) {
  const db = await openDb();

  const res = await fetch(xmlUrl);
  if (!res.ok) throw new Error(`Failed to fetch Bible XML: ${res.status}`);
  const xmlText = await res.text();

  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");

  const parseError = xml.querySelector("parsererror");
  if (parseError) {
    throw new Error("XML parse error. Your Bible XML may be malformed.");
  }

  const bookNodes = Array.from(xml.querySelectorAll("book"));

  const rows = [];
  let count = 0;

  for (const bookNode of bookNodes) {
    const bookNum = Number(bookNode.getAttribute("number"));
    const bookName = BOOKS[bookNum - 1];
    if (!bookName) continue;

    const chapterNodes = Array.from(bookNode.querySelectorAll(":scope > chapter"));
    for (const chapterNode of chapterNodes) {
      const chapNum = Number(chapterNode.getAttribute("number"));
      if (!chapNum) continue;

      const verseNodes = Array.from(chapterNode.querySelectorAll(":scope > verse"));
      for (const verseNode of verseNodes) {
        const verseNum = Number(verseNode.getAttribute("number"));
        const text = normalizeWhitespace(verseNode.textContent || "");
        if (!verseNum || !text) continue;

        rows.push({
          key: `${bookName}|${chapNum}|${verseNum}`,
          book: bookName,
          chapter: chapNum,
          verse: verseNum,
          text
        });

        count++;
        if (onProgress && count % 2000 === 0) onProgress(count);
      }
    }
  }

  if (!rows.length) {
    throw new Error("Importer found 0 verses. XML structure may differ from expected.");
  }

  await putMany(db, storeName, rows);

  return {
    verses: rows.length,
    books: new Set(rows.map(r => r.book)).size
  };
}

// Backward-compatible KJV wrapper
export async function importKJVFromXML(xmlUrl, onProgress) {
  return importBibleFromXML(xmlUrl, stores().KJV_VERSES, onProgress);
}
