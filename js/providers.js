/**
 * providers.js
 * -----------------------------------------------------------------------------
 * High-level data operations:
 * - Chapters (offline XML-imported translations)
 * - Bookmarks
 * - Verse styles (highlight/underline/bold/notes)
 * - Settings
 * -----------------------------------------------------------------------------
 */

import {
  stores,
  putMany,
  putOne,
  getOne,
  deleteOne,
  getAllByIndex,
  getAll
} from "./db.js";

/* ----------------------------- Keys ----------------------------- */

export function bookmarkKey(translation, book, chapter) {
  return `${translation}|${book}|${chapter}`;
}

export function verseStyleKey(translation, book, chapter, verse) {
  return `${translation}|${book}|${chapter}|${verse}`;
}

/* ----------------------------- Chapters ---------------------------- */

export async function getChapterFromStore(db, storeName, book, chapter) {
  const verses = await getAllByIndex(db, storeName, "by_book_chapter", [book, chapter]);
  return verses.sort((a, b) => a.verse - b.verse);
}

export async function getChapterKJV(db, book, chapter) {
  return getChapterFromStore(db, stores().KJV_VERSES, book, chapter);
}

/**
 * Unified chapter loader for all *offline* XML-imported translations.
 *
 * translationId values used by the app:
 * - KJV, ESV, NIV, AMP, AMPC, NVI-ES
 */
export async function getChapterOffline(db, translationId, book, chapter) {
  const id = String(translationId || "").toUpperCase();
  switch (id) {
    case "KJV":
      return getChapterFromStore(db, stores().KJV_VERSES, book, chapter);
    case "ESV":
      return getChapterFromStore(db, stores().ESV_VERSES, book, chapter);
    case "NIV":
      return getChapterFromStore(db, stores().NIV_VERSES, book, chapter);
    case "AMP":
      return getChapterFromStore(db, stores().AMP_VERSES, book, chapter);
    case "AMPC":
      return getChapterFromStore(db, stores().AMPC_VERSES, book, chapter);
    case "NVI-ES":
    case "NVI_ES":
      return getChapterFromStore(db, stores().NVI_ES_VERSES, book, chapter);
    default:
      return [];
  }
}

/* -------- Legacy NIV provider cache path (optional / older builds) -------- */

export async function getChapterNIV(db, book, chapter, nivConfig) {
  const cached = await getAllByIndex(db, stores().NIV_CACHE, "by_book_chapter", [book, chapter]);
  if (cached.length) return cached.sort((a, b) => a.verse - b.verse);

  if (!navigator.onLine) return [];

  const url = `${nivConfig.proxyBaseUrl}/niv/chapter?book=${encodeURIComponent(book)}&chapter=${chapter}`;
  const res = await fetch(url, {
    headers: nivConfig.token ? { "Authorization": `Bearer ${nivConfig.token}` } : {}
  });

  if (!res.ok) throw new Error("NIV provider fetch failed");
  const payload = await res.json();

  const rows = (payload.verses || []).map(v => ({
    key: `${book}|${chapter}|${Number(v.verse)}`,
    book,
    chapter,
    verse: Number(v.verse),
    text: String(v.text || "")
  }));

  await putMany(db, stores().NIV_CACHE, rows);
  return rows;
}

/* ------------------------------ Bookmarks ------------------------------ */

export async function toggleBookmark(db, { translation, book, chapter }) {
  const key = bookmarkKey(translation, book, chapter);
  const existing = await getOne(db, stores().BOOKMARKS, key);

  if (existing) {
    await deleteOne(db, stores().BOOKMARKS, key);
    return false;
  }

  await putOne(db, stores().BOOKMARKS, {
    key,
    translation,
    book,
    chapter,
    savedAt: Date.now()
  });

  return true;
}

export async function listBookmarks(db, translation) {
  const all = await getAll(db, stores().BOOKMARKS);
  return all
    .filter(b => b.translation === translation)
    .sort((a, b) => b.savedAt - a.savedAt);
}

/* --------------------------- Verse Styles --------------------------- */

export async function saveVerseStyle(db, style) {
  await putOne(db, stores().VERSE_STYLES, {
    ...style,
    updatedAt: Date.now()
  });
}

export async function removeVerseStyle(db, translation, book, chapter, verse) {
  const key = verseStyleKey(translation, book, chapter, verse);
  await deleteOne(db, stores().VERSE_STYLES, key);
}

export async function getStylesForChapter(db, translation, book, chapter) {
  const rows = await getAllByIndex(db, stores().VERSE_STYLES, "by_ref", [translation, book, chapter]);
  const map = new Map();
  for (const r of rows) map.set(r.key, r);
  return map;
}

export async function listAllStyles(db, translation) {
  const all = await getAll(db, stores().VERSE_STYLES);
  return all
    .filter(s => s.translation === translation)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listNotes(db, translation) {
  const all = await listAllStyles(db, translation);
  return all.filter(s => (s.note || "").trim().length > 0);
}

/* ------------------------------ Settings ------------------------------ */

export async function saveSetting(db, key, value) {
  await putOne(db, stores().SETTINGS, { key, value });
}

export async function loadSetting(db, key) {
  const row = await getOne(db, stores().SETTINGS, key);
  return row ? row.value : null;
}

/* ------------------------------ Dive Deeper (Offline Packs) ------------------------------ */

let _diveCrossrefs = null;
let _diveExplain = null;
let _diveTags = null;

async function loadJsonOnce(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json();
}

function verseKey(book, chapter, verse) {
  return `${book}|${chapter}|${verse}`;
}

export async function getDiveCrossrefs(book, chapter, verse) {
  if (_diveCrossrefs === null) {
    _diveCrossrefs = (await loadJsonOnce("./data/dive_crossrefs.json")) || {};
  }
  return _diveCrossrefs[verseKey(book, chapter, verse)] || [];
}

export async function getDiveExplain(book, chapter, verse) {
  if (_diveExplain === null) {
    _diveExplain = (await loadJsonOnce("./data/dive_explain.json")) || {};
  }
  return _diveExplain[verseKey(book, chapter, verse)] || null;
}

export async function getDiveTags(book, chapter, verse) {
  if (_diveTags === null) {
    _diveTags = (await loadJsonOnce("./data/dive_tags.json")) || {};
  }
  return _diveTags[verseKey(book, chapter, verse)] || [];
}

