/**
 * db.js
 * -----------------------------------------------------------------------------
 * IndexedDB layer (single source of truth)
 * Exports used by providers.js:
 * - openDb, stores
 * - putOne, putMany
 * - getOne, getAll, getAllByIndex
 * - deleteOne
 * - countStore
 * - searchTextCursor
 * -----------------------------------------------------------------------------
 */

export const DB_NAME = "nightlamp_bible";
export const DB_VERSION = 3;

const STORES = {
  KJV_VERSES: "kjv_verses",

  // Legacy NIV cache (kept for backward compatibility)
  NIV_CACHE: "niv_cache",

  // Local/offline translations (XML imported)
  NIV_VERSES: "niv_verses",
  ESV_VERSES: "esv_verses",
  AMP_VERSES: "amp_verses",
  AMPC_VERSES: "ampc_verses",
  NVI_ES_VERSES: "nvi_es_verses",

  BOOKMARKS: "bookmarks",
  VERSE_STYLES: "verse_styles",
  SETTINGS: "settings"
};

export function stores() { return STORES; }

function storeTx(db, storeName, mode = "readonly") {
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // KJV verses
      if (!db.objectStoreNames.contains(STORES.KJV_VERSES)) {
        const s = db.createObjectStore(STORES.KJV_VERSES, { keyPath: "key" });
        s.createIndex("by_book_chapter", ["book", "chapter"], { unique: false });
      }

      // Additional offline translations (same schema as KJV)
      const ensureVerseStore = (name) => {
        if (!db.objectStoreNames.contains(name)) {
          const s = db.createObjectStore(name, { keyPath: "key" });
          s.createIndex("by_book_chapter", ["book", "chapter"], { unique: false });
        }
      };

      ensureVerseStore(STORES.NIV_VERSES);
      ensureVerseStore(STORES.ESV_VERSES);
      ensureVerseStore(STORES.AMP_VERSES);
      ensureVerseStore(STORES.AMPC_VERSES);
      ensureVerseStore(STORES.NVI_ES_VERSES);

      // NIV cache (legacy)
      if (!db.objectStoreNames.contains(STORES.NIV_CACHE)) {
        const s = db.createObjectStore(STORES.NIV_CACHE, { keyPath: "key" });
        s.createIndex("by_book_chapter", ["book", "chapter"], { unique: false });
      }

      // Bookmarks
      if (!db.objectStoreNames.contains(STORES.BOOKMARKS)) {
        const s = db.createObjectStore(STORES.BOOKMARKS, { keyPath: "key" });
        s.createIndex("by_translation", "translation", { unique: false });
        s.createIndex("by_savedAt", "savedAt", { unique: false });
      }

      // Verse styles
      if (!db.objectStoreNames.contains(STORES.VERSE_STYLES)) {
        const s = db.createObjectStore(STORES.VERSE_STYLES, { keyPath: "key" });
        s.createIndex("by_ref", ["translation", "book", "chapter"], { unique: false });
        s.createIndex("by_translation", "translation", { unique: false });
        s.createIndex("by_updatedAt", "updatedAt", { unique: false });
      }

      // Settings
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function countStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const req = storeTx(db, storeName).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

export async function putMany(db, storeName, rows) {
  return new Promise((resolve, reject) => {
    const store = storeTx(db, storeName, "readwrite");
    for (const r of rows) store.put(r);
    store.transaction.oncomplete = () => resolve(true);
    store.transaction.onerror = () => reject(store.transaction.error);
  });
}

export async function putOne(db, storeName, row) {
  return new Promise((resolve, reject) => {
    const store = storeTx(db, storeName, "readwrite");
    const req = store.put(row);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getOne(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const req = storeTx(db, storeName, "readonly").get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const req = storeTx(db, storeName, "readonly").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllByIndex(db, storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const store = storeTx(db, storeName, "readonly");
    const idx = store.index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOne(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const store = storeTx(db, storeName, "readwrite");
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Cursor-based search (fast enough, no full-store load).
 */
export async function searchTextCursor(db, storeName, query, limit = 80) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];

  return new Promise((resolve, reject) => {
    const store = storeTx(db, storeName, "readonly");
    const req = store.openCursor();

    const hits = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || hits.length >= limit) return resolve(hits);

      const v = cursor.value;
      const text = (v.text || "").toLowerCase();
      if (text.includes(q)) hits.push(v);

      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}
