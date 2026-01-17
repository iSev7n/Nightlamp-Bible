/**
 * app.js
 * =============================================================================
 * 
 * What this file does:
 * - Initializes the app (DB, settings, service worker, UI)
 * - Loads Bible text (offline / imported XML in IndexedDB)
 * - Renders chapters + handles verse selection
 * - Manages verse styling (highlight, bold, underline, verse bookmark)
 * - Provides Notes (per-verse notes modal + Notes tab list)
 * - Provides Bookmarks (chapter bookmarks + verse bookmarks + highlights list)
 * - Provides Search (sidebar search + results overlay)
 * - Provides Timeline (quick jump eras)
 *
 * Fixes included (without changing features):
 * - Implements createDialog() locally (avoids missing import)
 * - Adds toast() helper (was referenced but not defined)
 * - Organizes code into numbered sections for easy maintenance
 *
 * =============================================================================
 * SECTION MAP
 * =============================================================================
 *  1) CONFIG / CONSTANTS
 *  2) STATE
 *  3) DOM HELPERS (never crash)
 *  4) DIALOG + TOAST (createDialog + toast)
 *  5) HIGHLIGHT LABEL HELPERS
 *  6) MAIN TABS
 *  7) TIMELINE
 *  8) SERVICE WORKER + INSTALL
 *  9) SIDEBAR (Explorer/Search) + RESPONSIVE
 * 10) THEME + APPEARANCE
 * 11) HIGHLIGHT LABELS (Smart Highlights)
 * 12) SETTINGS + TRANSLATIONS
 * 13) IMPORTS (KJV + other translations)
 * 14) BOOK/CHAPTER/VERSE SELECTS
 * 15) CHAPTER LOADING + VERSE SELECTION
 * 16) READER NAV (Prev/Next)
 * 17) SIDEBAR "GO" (jump to verse)
 * 18) OVERLAY (Search/Dive Deeper)
 * 19) NOTES MODAL (📝)
 * 20) VERSE ACTIONS (style upsert)
 * 21) VERSE TOOLBAR (bold, underline, bookmark, highlight, notes, help)
 * 22) NOTES LIST (Notes tab)
 * 23) BOOKMARKS (Bookmarks tab)
 * 24) SEARCH (Sidebar Search pane)
 * 25) QUICK TOOLS (Bookmark chapter, Copy chapter)
 * 26) BOOT (init)
 * =============================================================================
 */

import { openDb, stores, countStore, searchTextCursor } from "./db.js";
import {
  getChapterKJV,
  getChapterNIV,
  getChapterOffline,
  toggleBookmark,
  listBookmarks,
  getStylesForChapter,
  listAllStyles,
  listNotes,
  verseStyleKey,
  saveVerseStyle,
  saveSetting,
  loadSetting,
  getDiveCrossrefs,
  getDiveExplain,
  getDiveTags,
} from "./providers.js";
import { setNetStatus, renderVerses, renderOverlayList } from "./ui.js";
import { importKJVFromXML, importBibleFromXML } from "./importKJV.js";

/* =============================================================================
 * 1) CONFIG / CONSTANTS
 * ============================================================================= */

const NIV_CONFIG = { proxyBaseUrl: "https://YOUR-DOMAIN.com/api", token: "" };

// Canonical book names (must match importKJV.js mapping)
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

const CHAPTER_COUNTS = {
  "Genesis":50,"Exodus":40,"Leviticus":27,"Numbers":36,"Deuteronomy":34,
  "Joshua":24,"Judges":21,"Ruth":4,"1 Samuel":31,"2 Samuel":24,
  "1 Kings":22,"2 Kings":25,"1 Chronicles":29,"2 Chronicles":36,
  "Ezra":10,"Nehemiah":13,"Esther":10,"Job":42,"Psalms":150,"Proverbs":31,
  "Ecclesiastes":12,"Song of Solomon":8,"Isaiah":66,"Jeremiah":52,"Lamentations":5,
  "Ezekiel":48,"Daniel":12,"Hosea":14,"Joel":3,"Amos":9,"Obadiah":1,"Jonah":4,"Micah":7,
  "Nahum":3,"Habakkuk":3,"Zephaniah":3,"Haggai":2,"Zechariah":14,"Malachi":4,
  "Matthew":28,"Mark":16,"Luke":24,"John":21,"Acts":28,"Romans":16,"1 Corinthians":16,"2 Corinthians":13,
  "Galatians":6,"Ephesians":6,"Philippians":4,"Colossians":4,"1 Thessalonians":5,"2 Thessalonians":3,
  "1 Timothy":6,"2 Timothy":4,"Titus":3,"Philemon":1,"Hebrews":13,"James":5,"1 Peter":5,"2 Peter":3,
  "1 John":5,"2 John":1,"3 John":1,"Jude":1,"Revelation":22
};

const TRANSLATIONS = [
  { id: "KJV", label: "KJV (English)", xml: "./data/EnglishKJBible.xml", store: () => stores().KJV_VERSES },
  { id: "ESV", label: "ESV (English)", xml: "./data/EnglishESVBible.xml", store: () => stores().ESV_VERSES },
  { id: "NIV", label: "NIV (English)", xml: "./data/EnglishNIVBible.xml", store: () => stores().NIV_VERSES },
  { id: "AMP", label: "AMP (English)", xml: "./data/EnglishAmplifiedBible.xml", store: () => stores().AMP_VERSES },
  { id: "AMPC", label: "AMPC (English)", xml: "./data/EnglishAmplifiedClassicBible.xml", store: () => stores().AMPC_VERSES },
  { id: "NVI-ES", label: "NVI (Español)", xml: "./data/SpanishNVIBible.xml", store: () => stores().NVI_ES_VERSES }
];

/* ------------------------------ Timeline Data ------------------------------ */

const TIMELINE_ERAS = [
  {
    id: "creation",
    title: "Creation & Early World",
    subtitle: "Beginnings, fall, flood, and the nations",
    anchors: [
      { book: "Genesis", chapter: 1, label: "Gen 1" },
      { book: "Genesis", chapter: 3, label: "Gen 3" },
      { book: "Genesis", chapter: 6, label: "Gen 6" },
      { book: "Genesis", chapter: 11, label: "Gen 11" }
    ]
  },
  {
    id: "patriarchs",
    title: "Patriarchs",
    subtitle: "Abraham, Isaac, Jacob, and Joseph",
    anchors: [
      { book: "Genesis", chapter: 12, label: "Gen 12" },
      { book: "Genesis", chapter: 22, label: "Gen 22" },
      { book: "Genesis", chapter: 28, label: "Gen 28" },
      { book: "Genesis", chapter: 37, label: "Gen 37" }
    ]
  },
  {
    id: "exodus",
    title: "Exodus & Covenant",
    subtitle: "Deliverance, law, and worship",
    anchors: [
      { book: "Exodus", chapter: 3, label: "Ex 3" },
      { book: "Exodus", chapter: 12, label: "Ex 12" },
      { book: "Exodus", chapter: 20, label: "Ex 20" },
      { book: "Leviticus", chapter: 16, label: "Lev 16" }
    ]
  },
  {
    id: "kings",
    title: "Kings & Kingdom",
    subtitle: "United kingdom and the divided kingdoms",
    anchors: [
      { book: "1 Samuel", chapter: 16, label: "1Sa 16" },
      { book: "2 Samuel", chapter: 7, label: "2Sa 7" },
      { book: "1 Kings", chapter: 8, label: "1Ki 8" },
      { book: "2 Kings", chapter: 17, label: "2Ki 17" }
    ]
  },
  {
    id: "exile",
    title: "Exile & Return",
    subtitle: "Judgment, hope, and restoration",
    anchors: [
      { book: "Daniel", chapter: 6, label: "Dan 6" },
      { book: "Isaiah", chapter: 53, label: "Isa 53" },
      { book: "Ezra", chapter: 1, label: "Ezra 1" },
      { book: "Nehemiah", chapter: 8, label: "Neh 8" }
    ]
  },
  {
    id: "gospels",
    title: "Gospels",
    subtitle: "Life, teaching, death, and resurrection of Jesus",
    anchors: [
      { book: "Matthew", chapter: 5, label: "Mt 5" },
      { book: "Mark", chapter: 15, label: "Mk 15" },
      { book: "Luke", chapter: 24, label: "Lk 24" },
      { book: "John", chapter: 1, label: "Jn 1" }
    ]
  },
  {
    id: "church",
    title: "Early Church",
    subtitle: "Acts and the letters",
    anchors: [
      { book: "Acts", chapter: 2, label: "Acts 2" },
      { book: "Romans", chapter: 8, label: "Rom 8" },
      { book: "1 Corinthians", chapter: 13, label: "1Co 13" },
      { book: "Revelation", chapter: 21, label: "Rev 21" }
    ]
  }
];

/* ------------------------------ Smart Highlights ------------------------------ */

const DEFAULT_HL_LABELS = {
  gold: "Promise",
  mint: "Command",
  lav: "Prophecy",
  rose: "Warning",
  sky: "Fulfillment"
};

/* =============================================================================
 * 2) STATE
 * ============================================================================= */

const state = {
  db: null,
  translation: "KJV",
  book: "Genesis",
  chapter: 1,
  verses: [],
  stylesMap: new Map(),
  selected: null,
  selectedKey: "",
  notesFilter: "recent",

  // Smart Highlights
  highlightFilter: "all",
  hlLabels: { ...DEFAULT_HL_LABELS }
};

/* =============================================================================
 * 3) DOM HELPERS (never crash)
 * ============================================================================= */

const $ = (id) => document.getElementById(id);

const on = (id, evt, fn) => {
  const el = $(id);
  if (!el) return false;
  el.addEventListener(evt, fn);
  return true;
};

/* =============================================================================
 * 4) DIALOG + TOAST (fixes missing createDialog + missing toast())
 * ============================================================================= */

/**
 * Uses the existing #appDialog markup in index.html.
 * Provides: dialog.show({title,message,actions?}), dialog.hide()
 */
function createDialog() {
  const root = $("appDialog");
  const titleEl = $("dialogTitle");
  const msgEl = $("dialogMsg");
  const actionsEl = $("dialogActions");
  const okBtn = $("dialogOkBtn");
  const closeBtn = $("dialogCloseBtn");

  const hide = () => {
    if (root) root.hidden = true;
  };

  const show = ({ title = "Notice", message = "", actions = null } = {}) => {
    if (!root || !titleEl || !msgEl) {
      // Fallback: never crash if dialog markup missing
      console.log("[Dialog]", title, message);
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;

    // Default OK action
    if (actionsEl) {
      actionsEl.innerHTML = "";

      if (Array.isArray(actions) && actions.length) {
        for (const a of actions) {
          const b = document.createElement("button");
          b.className = a.primary ? "btn primary" : "btn";
          b.textContent = a.text || "OK";
          b.addEventListener("click", () => {
            try { a.onClick?.(); } finally { hide(); }
          });
          actionsEl.appendChild(b);
        }
      } else {
        // Standard OK button
        const b = document.createElement("button");
        b.className = "btn primary";
        b.textContent = "OK";
        b.addEventListener("click", hide);
        actionsEl.appendChild(b);
      }
    }

    root.hidden = false;
  };

  // Close wiring
  if (closeBtn) closeBtn.addEventListener("click", hide);
  if (okBtn) okBtn.addEventListener("click", hide);

  if (root) {
    root.addEventListener("click", (e) => {
      if (e.target === root) hide();
    });
  }

  return { show, hide };
}

/**
 * Lightweight toast (non-blocking).
 * If toast container doesn't exist, it creates one (minimal UI impact).
 */
function toast(message = "") {
  const msg = String(message || "").trim();
  if (!msg) return;

  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.style.position = "fixed";
    host.style.left = "50%";
    host.style.bottom = "18px";
    host.style.transform = "translateX(-50%)";
    host.style.zIndex = "9999";
    host.style.pointerEvents = "none";
    document.body.appendChild(host);
  }

  const t = document.createElement("div");
  t.textContent = msg;
  t.style.pointerEvents = "none";
  t.style.marginTop = "8px";
  t.style.padding = "10px 12px";
  t.style.borderRadius = "12px";
  t.style.background = "rgba(0,0,0,0.75)";
  t.style.color = "#fff";
  t.style.fontSize = "13px";
  t.style.maxWidth = "85vw";
  t.style.textAlign = "center";
  t.style.boxShadow = "0 8px 30px rgba(0,0,0,0.25)";

  host.appendChild(t);

  // Fade-out + remove
  setTimeout(() => {
    t.style.transition = "opacity 250ms ease";
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 260);
  }, 1300);
}

let dialog = null;

function popupMessage(title, message) {
  dialog?.show({ title: title || "Notice", message: message || "" });
}

function ensureSelected() {
  if (!state.selected) {
    dialog?.show({ title: "Select a Verse", message: "Select a verse first." });
    return false;
  }
  return true;
}

function updateSelectionChip() {
  const chip = $("selChip");
  if (!chip) return;
  chip.textContent = state.selected
    ? `${state.book} ${state.chapter}:${state.selected.verse}`
    : "No verse selected";
}

/* =============================================================================
 * 5) HIGHLIGHT LABEL HELPERS
 * ============================================================================= */

function hlLabel(color) {
  const c = String(color || "").toLowerCase();
  return state.hlLabels[c] || DEFAULT_HL_LABELS[c] || c || "";
}

/* =============================================================================
 * 6) MAIN TABS
 * ============================================================================= */

function setMainTab(name) {
  const r = name === "reader";
  const n = name === "notes";
  const b = name === "bookmarks";
  const t = name === "timeline";

  if ($("panelReader")) $("panelReader").hidden = !r;
  if ($("panelNotes")) $("panelNotes").hidden = !n;
  if ($("panelBookmarks")) $("panelBookmarks").hidden = !b;
  if ($("panelTimeline")) $("panelTimeline").hidden = !t;

  if ($("tabReader")) $("tabReader").classList.toggle("active", r);
  if ($("tabNotes")) $("tabNotes").classList.toggle("active", n);
  if ($("tabBookmarks")) $("tabBookmarks").classList.toggle("active", b);
  if ($("tabTimeline")) $("tabTimeline").classList.toggle("active", t);

  if ($("tabReader")) $("tabReader").setAttribute("aria-selected", r ? "true" : "false");
  if ($("tabNotes")) $("tabNotes").setAttribute("aria-selected", n ? "true" : "false");
  if ($("tabBookmarks")) $("tabBookmarks").setAttribute("aria-selected", b ? "true" : "false");
  if ($("tabTimeline")) $("tabTimeline").setAttribute("aria-selected", t ? "true" : "false");

  if (n && $("notesListMain")) refreshNotesListInto($("notesListMain"));
  if (b && $("bookmarksListMain")) renderChapterBookmarksInto($("bookmarksListMain"));
  if (t && $("timelineList")) renderTimelineInto($("timelineList"));
}

function wireMainTabs() {
  on("tabReader", "click", () => setMainTab("reader"));
  on("tabNotes", "click", () => setMainTab("notes"));
  on("tabBookmarks", "click", () => setMainTab("bookmarks"));
  on("tabTimeline", "click", () => setMainTab("timeline"));
}

/* =============================================================================
 * 7) TIMELINE
 * ============================================================================= */

function renderTimelineInto(targetEl) {
  if (!targetEl) return;
  targetEl.innerHTML = "";

  for (const era of TIMELINE_ERAS) {
    const card = document.createElement("div");
    card.className = "t-era";

    const t = document.createElement("div");
    t.className = "t-era-title";
    t.textContent = era.title;

    const s = document.createElement("div");
    s.className = "t-era-sub";
    s.textContent = era.subtitle;

    const chips = document.createElement("div");
    chips.className = "t-chips";

    for (const a of era.anchors) {
      const chip = document.createElement("button");
      chip.className = "t-chip";
      chip.textContent = a.label;
      chip.addEventListener("click", async (e) => {
        e.stopPropagation();
        setMainTab("reader");
        await openChapter(a.book, a.chapter);
        if (isMobileLayout()) document.body.classList.remove("sidebar-drawer-open");
      });
      chips.appendChild(chip);
    }

    card.appendChild(t);
    card.appendChild(s);
    card.appendChild(chips);
    targetEl.appendChild(card);
  }
}

/* =============================================================================
 * 8) SERVICE WORKER + INSTALL
 * ============================================================================= */

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  await navigator.serviceWorker.register("./sw.js");
}

function setupInstallButton() {
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if ($("installBtn")) $("installBtn").hidden = false;
  });

  on("installBtn", "click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    if ($("installBtn")) $("installBtn").hidden = true;
  });
}

/* =============================================================================
 * 9) SIDEBAR (Explorer/Search) + RESPONSIVE
 * ============================================================================= */

function isMobileLayout() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function setPane(name) {
  if ($("actExplorer")) $("actExplorer").classList.toggle("active", name === "explorer");
  if ($("actSearch")) $("actSearch").classList.toggle("active", name === "search");
  if ($("paneExplorer")) $("paneExplorer").hidden = name !== "explorer";
  if ($("paneSearch")) $("paneSearch").hidden = name !== "search";
}

function setupActivityBar() {
  const isSidebarVisible = () => {
    if (isMobileLayout()) return document.body.classList.contains("sidebar-drawer-open");
    return !document.body.classList.contains("sidebar-hidden");
  };

  const closeSidebar = async () => {
    if (isMobileLayout()) {
      document.body.classList.remove("sidebar-drawer-open");
      await saveSetting(state.db, "drawerOpen", "0");
    } else {
      document.body.classList.add("sidebar-hidden");
      await saveSetting(state.db, "sidebarHidden", "1");
    }
  };

  const openSidebar = async () => {
    if (isMobileLayout()) {
      document.body.classList.add("sidebar-drawer-open");
      await saveSetting(state.db, "drawerOpen", "1");
    } else {
      document.body.classList.remove("sidebar-hidden");
      await saveSetting(state.db, "sidebarHidden", "0");
    }
  };

  const togglePane = async (pane) => {
    const btn = pane === "explorer" ? $("actExplorer") : $("actSearch");
    const alreadyActive = !!btn?.classList.contains("active");
    const visible = isSidebarVisible();

    // If this pane is active AND sidebar is visible -> close
    if (alreadyActive && visible) {
      await closeSidebar();
      return;
    }

    // Otherwise open and show pane
    await openSidebar();
    setPane(pane);
  };

  on("actExplorer", "click", () => togglePane("explorer"));
  on("actSearch", "click", () => togglePane("search"));
}

async function toggleSidebar() {
  if (isMobileLayout()) {
    const open = document.body.classList.toggle("sidebar-drawer-open");
    await saveSetting(state.db, "drawerOpen", open ? "1" : "0");
    return;
  }
  const hidden = document.body.classList.toggle("sidebar-hidden");
  await saveSetting(state.db, "sidebarHidden", hidden ? "1" : "0");
}

function setupSidebarCollapse() {
  on("collapseSidebarBtn", "click", toggleSidebar);

  // Click outside drawer closes it on mobile
  document.addEventListener("click", (e) => {
    if (!isMobileLayout()) return;
    if (!document.body.classList.contains("sidebar-drawer-open")) return;

    const sidebar = $("sidebar");
    const activity = document.querySelector(".activitybar");
    const toggle = $("collapseSidebarBtn");
    if (!sidebar || !activity || !toggle) return;

    const clickedInsideSidebar = sidebar.contains(e.target);
    const clickedActivity = activity.contains(e.target);
    const clickedToggle = toggle.contains(e.target);

    if (!clickedInsideSidebar && !clickedActivity && !clickedToggle) {
      document.body.classList.remove("sidebar-drawer-open");
      saveSetting(state.db, "drawerOpen", "0");
    }
  }, true);
}

async function restoreSidebarState() {
  const v = await loadSetting(state.db, "sidebarHidden");
  if (v === "1") document.body.classList.add("sidebar-hidden");

  const d = await loadSetting(state.db, "drawerOpen");
  if (d === "1") document.body.classList.add("sidebar-drawer-open");
}

/* =============================================================================
 * 10) THEME + APPEARANCE
 * ============================================================================= */

async function setupTheme() {
  const saved = await loadSetting(state.db, "theme");
  if (saved) document.documentElement.dataset.theme = saved;

  const current = document.documentElement.dataset.theme || "dark";
  if ($("themeBtn")) $("themeBtn").textContent = current === "dark" ? "🌙" : "☀️";

  on("themeBtn", "click", async () => {
    const cur = document.documentElement.dataset.theme || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    if ($("themeBtn")) $("themeBtn").textContent = next === "dark" ? "🌙" : "☀️";
    await saveSetting(state.db, "theme", next);
  });
}

function accentForVariant(v) {
  switch (v) {
    case "purple": return "#7c5cff";
    case "green": return "#2bb673";
    case "amber": return "#f2b233";
    case "rose": return "#ff4d6d";
    case "blue":
    default: return "#007acc";
  }
}

function applyAccentVariant(variant) {
  document.documentElement.style.setProperty("--accent", accentForVariant(variant));
}

function applyReaderFontSize(px) {
  const safe = Math.max(10, Math.min(30, Number(px) || 14));
  document.documentElement.style.setProperty("--reader-font-size", `${safe}px`);
}

async function restoreAppearanceSettings() {
  const variant = (await loadSetting(state.db, "themeVariant")) || "blue";
  const fontPx = (await loadSetting(state.db, "readerFontPx")) || "14";

  applyAccentVariant(variant);
  applyReaderFontSize(fontPx);

  if ($("themeVariantSelect")) $("themeVariantSelect").value = variant;
  if ($("fontSizeSelect")) $("fontSizeSelect").value = String(fontPx);
}

/* =============================================================================
 * 11) HIGHLIGHT LABELS (Smart Highlights)
 * ============================================================================= */

async function loadHighlightLabels() {
  for (const k of Object.keys(DEFAULT_HL_LABELS)) {
    const v = await loadSetting(state.db, `hlLabel_${k}`);
    if (v) state.hlLabels[k] = v;
  }
}

function populateHighlightLabelsUI() {
  if ($("hlLabelGold")) $("hlLabelGold").value = state.hlLabels.gold || DEFAULT_HL_LABELS.gold;
  if ($("hlLabelMint")) $("hlLabelMint").value = state.hlLabels.mint || DEFAULT_HL_LABELS.mint;
  if ($("hlLabelLav")) $("hlLabelLav").value = state.hlLabels.lav || DEFAULT_HL_LABELS.lav;
  if ($("hlLabelRose")) $("hlLabelRose").value = state.hlLabels.rose || DEFAULT_HL_LABELS.rose;
  if ($("hlLabelSky")) $("hlLabelSky").value = state.hlLabels.sky || DEFAULT_HL_LABELS.sky;
}

async function saveHighlightLabelsFromUI() {
  const map = {
    gold: $("hlLabelGold")?.value,
    mint: $("hlLabelMint")?.value,
    lav: $("hlLabelLav")?.value,
    rose: $("hlLabelRose")?.value,
    sky: $("hlLabelSky")?.value
  };

  for (const [k, raw] of Object.entries(map)) {
    const v = (raw || "").trim() || DEFAULT_HL_LABELS[k];
    state.hlLabels[k] = v;
    await saveSetting(state.db, `hlLabel_${k}`, v);
  }
}

async function resetHighlightLabels() {
  state.hlLabels = { ...DEFAULT_HL_LABELS };
  populateHighlightLabelsUI();
  for (const [k, v] of Object.entries(DEFAULT_HL_LABELS)) {
    await saveSetting(state.db, `hlLabel_${k}`, v);
  }
}

function populateHighlightFilterUI() {
  const sel = $("hlFilterSelect");
  if (!sel) return;

  const setOptText = (value, text) => {
    const o = sel.querySelector(`option[value="${value}"]`);
    if (o) o.textContent = text;
  };

  setOptText("all", "All highlight types");
  setOptText("gold", hlLabel("gold"));
  setOptText("mint", hlLabel("mint"));
  setOptText("lav", hlLabel("lav"));
  setOptText("rose", hlLabel("rose"));
  setOptText("sky", hlLabel("sky"));

  if (!sel.value) sel.value = "all";
}

/* =============================================================================
 * 12) SETTINGS + TRANSLATIONS
 * ============================================================================= */

function openSettings() { if ($("settingsModal")) $("settingsModal").hidden = false; }
function closeSettings() { if ($("settingsModal")) $("settingsModal").hidden = true; }

function translationMeta(id) {
  return TRANSLATIONS.find(t => t.id === id) || TRANSLATIONS[0];
}

async function updateBottomBarForTranslation() {
  const meta = translationMeta(state.translation);

  if ($("sbTranslation")) $("sbTranslation").textContent = meta.id;
  if ($("sbMode")) $("sbMode").textContent = meta.mode || "Offline";

  try {
    const storeName = meta.store ? meta.store() : "";
    const count = storeName ? await countStore(state.db, storeName) : 0;
    if ($("dbStatus")) {
      $("dbStatus").textContent = storeName
        ? `${storeName} (${count.toLocaleString()} verses)`
        : "IndexedDB ready";
    }
  } catch {
    // ignore
  }
}

function populateTranslationSelect() {
  const sel = $("translationSelect");
  if (!sel) return;

  sel.innerHTML = TRANSLATIONS
    .map(t => `<option value="${t.id}">${t.label}</option>`)
    .join("");

  sel.value = state.translation;

  sel.addEventListener("change", async () => {
    await setTranslation(sel.value);
  });
}

async function ensureTranslationImported(translationId) {
  const meta = translationMeta(translationId);

  if (translationId === "KJV") {
    await ensureKJVImported();
    return;
  }

  const storeName = meta.store();
  const count = await countStore(state.db, storeName);
  if (count > 0) return;

  dialog?.show({ title: "Importing", message: `Importing ${meta.id}...` });
  await importBibleFromXML(meta.xml, storeName, (n) => {
    toast(`Importing ${meta.id}… ${n.toLocaleString()} verses`);
  });
  toast(`${meta.id} imported.`);
}

function setTranslationHint() {
  if ($("translationHint")) {
    const meta = translationMeta(state.translation);
    $("translationHint").textContent =
      `${meta.label} is stored locally for full offline reading.`;
  }

  if ($("sbTranslation")) $("sbTranslation").textContent = state.translation;
  if ($("sbMode")) $("sbMode").textContent = "Offline";
}

async function setTranslation(t) {
  state.translation = t;
  await saveSetting(state.db, "translation", t);

  // Legacy tabs (if they exist in older HTML)
  if ($("tabKJV")) $("tabKJV").setAttribute("aria-selected", t === "KJV" ? "true" : "false");
  if ($("tabNIV")) $("tabNIV").setAttribute("aria-selected", t === "NIV" ? "true" : "false");

  if ($("translationSelect")) $("translationSelect").value = t;

  setTranslationHint();

  await updateBottomBarForTranslation();
  await ensureTranslationImported(t);
  await openChapter(state.book, state.chapter);
}

function setupSettings() {
  on("settingsBtn", "click", () => {
    populateHighlightLabelsUI();
    openSettings();
  });
  on("settingsCloseBtn", "click", closeSettings);

  if ($("settingsModal")) {
    $("settingsModal").addEventListener("click", (e) => {
      if (e.target === $("settingsModal")) closeSettings();
    });
  }

  populateTranslationSelect();

  // Old translation tab support
  const hasOldTabs = !!$("tabKJV") || !!$("tabNIV");
  if (hasOldTabs) {
    if ($("tabKJV")) $("tabKJV").addEventListener("click", async () => setTranslation("KJV"));
    if ($("tabNIV")) $("tabNIV").addEventListener("click", async () => setTranslation("NIV"));
  }

  if ($("themeVariantSelect")) {
    $("themeVariantSelect").addEventListener("change", async () => {
      const v = $("themeVariantSelect").value || "blue";
      applyAccentVariant(v);
      await saveSetting(state.db, "themeVariant", v);
    });
  }

  if ($("fontSizeSelect")) {
    $("fontSizeSelect").addEventListener("change", async () => {
      const px = $("fontSizeSelect").value || "14";
      applyReaderFontSize(px);
      await saveSetting(state.db, "readerFontPx", String(px));
    });
  }

  if ($("saveHlLabelsBtn")) {
    $("saveHlLabelsBtn").addEventListener("click", async () => {
      await saveHighlightLabelsFromUI();
      populateHighlightFilterUI();
      dialog?.show({ title: "Saved", message: "Highlight labels saved." });
    });
  }

  if ($("resetHlLabelsBtn")) {
    $("resetHlLabelsBtn").addEventListener("click", async () => {
      await resetHighlightLabels();
      populateHighlightFilterUI();
      toast("Highlight labels reset.");
    });
  }
}

/* =============================================================================
 * 13) IMPORTS (KJV + other translations)
 * ============================================================================= */

async function ensureKJVImported() {
  const count = await countStore(state.db, stores().KJV_VERSES);
  if (count > 0) {
    if ($("dbStatus")) $("dbStatus").textContent = `KJV imported (${count.toLocaleString()} verses)`;
    return;
  }

  if ($("dbStatus")) $("dbStatus").textContent = "Importing KJV…";
  const result = await importKJVFromXML("./data/EnglishKJBible.xml", (n) => {
    if ($("dbStatus")) $("dbStatus").textContent = `Importing… ${n.toLocaleString()} verses`;
  });

  if ($("dbStatus")) {
    $("dbStatus").textContent =
      `KJV imported (${result.books} books, ${result.verses.toLocaleString()} verses)`;
  }
}

/* =============================================================================
 * 14) BOOK/CHAPTER/VERSEx SELECTS
 * ============================================================================= */

function maxChaptersForBook(book) {
  return CHAPTER_COUNTS[book] || 50;
}

function populateBooks() {
  const html = BOOKS.map(b => `<option value="${b}">${b}</option>`).join("");

  if ($("bookSelect")) $("bookSelect").innerHTML = html;
  if ($("topBookSelect")) $("topBookSelect").innerHTML = html;

  if ($("bookSelect")) $("bookSelect").value = state.book;
  if ($("topBookSelect")) $("topBookSelect").value = state.book;

  const onBookChanged = async (value) => {
    state.book = value;
    state.chapter = 1;
    populateChapters();
    await openChapter(state.book, state.chapter);
    if (isMobileLayout()) document.body.classList.remove("sidebar-drawer-open");
  };

  if ($("bookSelect")) $("bookSelect").addEventListener("change", async () => onBookChanged($("bookSelect").value));
  if ($("topBookSelect")) $("topBookSelect").addEventListener("change", async () => onBookChanged($("topBookSelect").value));
}

function populateChapters() {
  const max = maxChaptersForBook(state.book);
  const options =
    Array.from({ length: max }, (_, i) => i + 1)
      .map(n => `<option value="${n}">${n}</option>`)
      .join("");

  if (state.chapter > max) state.chapter = max;

  if ($("chapterSelect")) $("chapterSelect").innerHTML = options;
  if ($("topChapterSelect")) $("topChapterSelect").innerHTML = options;

  if ($("chapterSelect")) $("chapterSelect").value = String(state.chapter);
  if ($("topChapterSelect")) $("topChapterSelect").value = String(state.chapter);

  const onChapterChanged = async (value) => {
    state.chapter = Number(value);
    await openChapter(state.book, state.chapter);
    if (isMobileLayout()) document.body.classList.remove("sidebar-drawer-open");
  };

  if ($("chapterSelect")) $("chapterSelect").onchange = async () => onChapterChanged($("chapterSelect").value);
  if ($("topChapterSelect")) $("topChapterSelect").onchange = async () => onChapterChanged($("topChapterSelect").value);
}

function setVerseDropdownOptions(maxVerse) {
  const el = $("verseSelect");
  if (!el) return;

  const m = Math.max(1, Number(maxVerse) || 1);
  el.innerHTML = Array.from({ length: m }, (_, i) => i + 1)
    .map(n => `<option value="${n}">${n}</option>`)
    .join("");
  el.value = "1";
}

/* =============================================================================
 * 15) CHAPTER LOADING + VERSE SELECTION
 * ============================================================================= */

function storeForSearch(translationId) {
  const id = String(translationId || "").toUpperCase();
  switch (id) {
    case "KJV": return stores().KJV_VERSES;
    case "ESV": return stores().ESV_VERSES;
    case "NIV": return stores().NIV_VERSES;
    case "AMP": return stores().AMP_VERSES;
    case "AMPC": return stores().AMPC_VERSES;
    case "NVI-ES":
    case "NVI_ES": return stores().NVI_ES_VERSES;
    default: return stores().KJV_VERSES;
  }
}

async function openChapter(book, chapter) {
  state.book = book;
  state.chapter = chapter;

  if ($("bookSelect")) $("bookSelect").value = book;
  if ($("topBookSelect")) $("topBookSelect").value = book;
  if ($("chapterSelect")) $("chapterSelect").value = String(chapter);
  if ($("topChapterSelect")) $("topChapterSelect").value = String(chapter);

  if ($("titleBook")) $("titleBook").textContent = book;
  if ($("titleChapter")) $("titleChapter").textContent = String(chapter);

  if ($("verses")) $("verses").innerHTML = `<div class="hint">Loading chapter…</div>`;

  state.selected = null;
  state.selectedKey = "";
  updateSelectionChip();

  let verses = [];
  try {
    if (typeof getChapterOffline === "function") {
      verses = await getChapterOffline(state.db, state.translation, book, chapter);
    } else {
      // Legacy fallback path
      verses =
        state.translation === "KJV"
          ? await getChapterKJV(state.db, book, chapter)
          : await getChapterNIV(state.db, book, chapter, NIV_CONFIG);
    }
  } catch {
    if ($("verses")) {
      $("verses").innerHTML =
        `<div class="hint">Could not load chapter. ${navigator.onLine ? "Check translation import/settings." : "You are offline."}</div>`;
    }
    return;
  }

  if (!verses.length) {
    if ($("verses")) $("verses").innerHTML = `<div class="hint">No verses available for this chapter.</div>`;
    setVerseDropdownOptions(1);
    return;
  }

  const maxVerse = verses[verses.length - 1]?.verse || verses.length || 1;
  setVerseDropdownOptions(maxVerse);

  state.stylesMap = await getStylesForChapter(state.db, state.translation, book, chapter);

  const merged = verses.map(v => ({
    ...v,
    style: state.stylesMap.get(verseStyleKey(state.translation, v.book, v.chapter, v.verse)) || null
  }));

  state.verses = merged;

  const versesEl = $("verses");
  if (versesEl) {
    renderVerses(versesEl, merged, {
      selectedKey: state.selectedKey,
      onSelect: (v) => selectVerse(v)
    });
  }

  syncToolbarActiveStates();
}

function selectVerse(v) {
  const key = `${v.book}|${v.chapter}|${v.verse}`;

  if (state.selectedKey && key === state.selectedKey) {
    state.selected = null;
    state.selectedKey = "";
    updateSelectionChip();

    const versesEl = $("verses");
    if (versesEl) {
      renderVerses(versesEl, state.verses, {
        selectedKey: "",
        onSelect: (vv) => selectVerse(vv)
      });
    }

    syncToolbarActiveStates();
    return;
  }

  state.selected = v;
  state.selectedKey = key;
  updateSelectionChip();

  const versesEl = $("verses");
  if (versesEl) {
    renderVerses(versesEl, state.verses, {
      selectedKey: state.selectedKey,
      onSelect: (vv) => selectVerse(vv)
    });
  }

  syncToolbarActiveStates();
}

function syncToolbarActiveStates() {
  const st = state.selected?.style || null;
  if ($("boldBtn")) $("boldBtn").classList.toggle("active", !!st?.bold);
  if ($("underlineBtn")) $("underlineBtn").classList.toggle("active", !!st?.underline);
  if ($("verseBookmarkBtn")) $("verseBookmarkBtn").classList.toggle("active", !!st?.bookmarked);
}

/* =============================================================================
 * 16) READER NAV (Prev/Next)
 * ============================================================================= */

function setupNavigation() {
  on("topPrevBtn", "click", async () => {
    state.chapter = Math.max(1, state.chapter - 1);
    if ($("chapterSelect")) $("chapterSelect").value = String(state.chapter);
    if ($("topChapterSelect")) $("topChapterSelect").value = String(state.chapter);
    await openChapter(state.book, state.chapter);
  });

  on("topNextBtn", "click", async () => {
    const max = maxChaptersForBook(state.book);
    state.chapter = Math.min(max, state.chapter + 1);
    if ($("chapterSelect")) $("chapterSelect").value = String(state.chapter);
    if ($("topChapterSelect")) $("topChapterSelect").value = String(state.chapter);
    await openChapter(state.book, state.chapter);
  });
}

/* =============================================================================
 * 17) SIDEBAR "GO" (jump to verse)
 * ============================================================================= */

function setupGoButton() {
  const go = async () => {
    const b = $("bookSelect") ? $("bookSelect").value : state.book;
    const c = $("chapterSelect") ? Number($("chapterSelect").value) : state.chapter;
    const vNum = $("verseSelect") ? Number($("verseSelect").value || 1) : 1;

    if (b !== state.book || c !== state.chapter) {
      await openChapter(b, c);
    }

    const verse = state.verses.find(v => v.verse === vNum) || null;
    if (verse) {
      selectVerse(verse);
      const el = document.querySelector(`[data-key="${state.selectedKey}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  on("goBtn", "click", go);

  ["bookSelect", "chapterSelect", "verseSelect"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") go();
    });
  });
}

/* =============================================================================
 * 18) OVERLAY (Search/Dive Deeper)
 * ============================================================================= */

function openOverlay(title) {
  if ($("overlayTitle")) $("overlayTitle").textContent = title;
  if ($("resultsOverlay")) $("resultsOverlay").hidden = false;
}

function closeOverlay() {
  if ($("resultsOverlay")) $("resultsOverlay").hidden = true;
  if ($("overlayBody")) $("overlayBody").innerHTML = "";
}

function setupOverlayClose() {
  on("overlayCloseBtn", "click", closeOverlay);
  if ($("resultsOverlay")) {
    $("resultsOverlay").addEventListener("click", (e) => {
      if (e.target === $("resultsOverlay")) closeOverlay();
    });
  }
}

/* ------------------------------ Dive Deeper (?) ------------------------------ */

function openDiveDeeperForSelected(){
  if (!state.selected) {
    popupMessage("No Verse Selected", "Select a verse first.");
    return;
  }

  const v = state.selected;
  openOverlay("Dive Deeper");

  const body = $("overlayBody");
  if (!body) return;
  body.innerHTML = "";

  // Helper to add a standard card
  const addCard = (title, contentNode) => {
    const card = document.createElement("div");
    card.className = "list-item";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = title;

    const s = document.createElement("div");
    s.className = "list-sub";
    if (typeof contentNode === "string") {
      s.textContent = contentNode;
    } else {
      s.appendChild(contentNode);
    }

    card.appendChild(t);
    card.appendChild(s);
    body.appendChild(card);
  };

  // 1) Header: selected verse
  {
    const wrap = document.createElement("div");

    const title = document.createElement("div");
    title.style.fontWeight = "900";
    title.textContent = `${state.translation} · ${v.book} ${v.chapter}:${v.verse}`;

    const verseText = document.createElement("div");
    verseText.style.marginTop = "6px";
    verseText.textContent = v.text;

    wrap.appendChild(title);
    wrap.appendChild(verseText);

    addCard("Selected Verse", wrap);
  }

  // 2) Context (automatic): previous + next in the same chapter
  {
    const prev = state.verses.find(x => x.verse === v.verse - 1) || null;
    const next = state.verses.find(x => x.verse === v.verse + 1) || null;

    const wrap = document.createElement("div");

    const mkLine = (label, item) => {
      const line = document.createElement("div");
      line.style.marginTop = "8px";
      if (!item) {
        line.textContent = `${label}: (none)`;
        return line;
      }
      line.textContent = `${label} (${item.verse}): ${item.text}`;
      return line;
    };

    wrap.appendChild(mkLine("Previous", prev));
    wrap.appendChild(mkLine("Next", next));

    addCard("Context (Nearby Verses)", wrap);
  }

  // 3) Tags/Themes (starter pack)
  (async () => {
    const tags = await getDiveTags(v.book, v.chapter, v.verse);

    if (tags && tags.length) {
      const wrap = document.createElement("div");
      wrap.textContent = tags.join(" • ");
      addCard("Themes", wrap);
    }

    // 4) Study Helper (starter pack)
    const explain = await getDiveExplain(v.book, v.chapter, v.verse);
    if (explain) {
      const wrap = document.createElement("div");

      if (explain.plain) {
        const p = document.createElement("div");
        p.textContent = explain.plain;
        wrap.appendChild(p);
      }

      if (Array.isArray(explain.points) && explain.points.length) {
        const ul = document.createElement("ul");
        ul.style.margin = "10px 0 0 18px";
        for (const pt of explain.points) {
          const li = document.createElement("li");
          li.textContent = pt;
          ul.appendChild(li);
        }
        wrap.appendChild(ul);
      }

      if (Array.isArray(explain.questions) && explain.questions.length) {
        const qTitle = document.createElement("div");
        qTitle.style.marginTop = "10px";
        qTitle.style.fontWeight = "900";
        qTitle.textContent = "Reflection";
        wrap.appendChild(qTitle);

        const ul = document.createElement("ul");
        ul.style.margin = "8px 0 0 18px";
        for (const q of explain.questions) {
          const li = document.createElement("li");
          li.textContent = q;
          ul.appendChild(li);
        }
        wrap.appendChild(ul);
      }

      addCard("Study Helper", wrap);
    } else {
      addCard(
        "Study Helper",
        "No study notes for this verse yet. (You can expand the starter pack over time.)"
      );
    }

    // 5) Related verses (starter pack) - clickable
    const refs = await getDiveCrossrefs(v.book, v.chapter, v.verse);
    if (refs && refs.length) {
      const wrap = document.createElement("div");

      for (const r of refs) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "10px";
        row.style.alignItems = "center";
        row.style.marginTop = "10px";
        row.style.flexWrap = "wrap";

        const label = document.createElement("div");
        label.style.fontWeight = "900";
        label.textContent = `${r.book} ${r.chapter}:${r.verse}`;

        const note = document.createElement("div");
        note.style.opacity = ".9";
        note.textContent = r.note || "";

        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = "Open";
        btn.addEventListener("click", async () => {
          closeOverlay();
          setMainTab("reader");
          await openChapter(r.book, r.chapter);

          const vv = state.verses.find(x => x.verse === Number(r.verse));
          if (vv) {
            selectVerse(vv);
            const el = document.querySelector(`[data-key="${state.selectedKey}"]`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });

        row.appendChild(label);
        if (r.note) row.appendChild(note);
        row.appendChild(btn);

        wrap.appendChild(row);
      }

      addCard("Related Verses", wrap);
    } else {
      addCard("Related Verses", "No cross references for this verse yet.");
    }
  })();
}

/* =============================================================================
 * 19) NOTES MODAL (📝)
 * ============================================================================= */

function openNoteModalForSelected() {
  if (!ensureSelected()) return;

  const v = state.selected;
  const st = v.style || {};

  if ($("noteRef")) $("noteRef").textContent = `${state.translation} · ${v.book} ${v.chapter}:${v.verse}`;
  if ($("notePreview")) $("notePreview").textContent = v.text;

  if ($("noteFavoriteToggle")) $("noteFavoriteToggle").checked = !!st.noteFavorite;
  if ($("noteTypeSelect")) $("noteTypeSelect").value = st.noteType || "study";
  if ($("noteText")) $("noteText").value = st.note || "";

  if ($("noteModal")) $("noteModal").hidden = false;
}

function closeNoteModal() {
  if ($("noteModal")) $("noteModal").hidden = true;
}

function setupNoteModal() {
  on("noteCloseBtn", "click", closeNoteModal);

  if ($("noteModal")) {
    $("noteModal").addEventListener("click", (e) => {
      if (e.target === $("noteModal")) closeNoteModal();
    });
  }

  on("saveNoteBtn", "click", async () => {
    if (!ensureSelected()) return;

    const note = $("noteText") ? $("noteText").value : "";
    const noteType = $("noteTypeSelect") ? $("noteTypeSelect").value : "study";
    const noteFavorite = $("noteFavoriteToggle") ? $("noteFavoriteToggle").checked : false;

    await upsertSelectedStyle({ note, noteType, noteFavorite });
    closeNoteModal();

    if ($("panelNotes") && !$("panelNotes").hidden && $("notesListMain")) {
      refreshNotesListInto($("notesListMain"));
    }
  });

  on("removeNoteBtn", "click", async () => {
    if (!ensureSelected()) return;

    await upsertSelectedStyle({ note: "", noteType: "study", noteFavorite: false });
    closeNoteModal();

    if ($("panelNotes") && !$("panelNotes").hidden && $("notesListMain")) {
      refreshNotesListInto($("notesListMain"));
    }
  });
}

/* =============================================================================
 * 20) VERSE ACTIONS (style upsert)
 * ============================================================================= */

async function upsertSelectedStyle(patch) {
  if (!ensureSelected()) return;

  const v = state.selected;
  const key = verseStyleKey(state.translation, v.book, v.chapter, v.verse);

  const current =
    state.stylesMap.get(key) || {
      key,
      translation: state.translation,
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
      color: "none",
      underline: false,
      bold: false,
      bookmarked: false,
      note: "",
      noteType: "study",
      noteFavorite: false
    };

  const next = { ...current, ...patch, updatedAt: Date.now() };

  await saveVerseStyle(state.db, next);

  // Update cache maps
  state.stylesMap.set(key, next);

  // Patch verses list
  state.verses = state.verses.map((x) => {
    if (x.book === v.book && x.chapter === v.chapter && x.verse === v.verse) {
      return { ...x, style: next };
    }
    return x;
  });

  // Patch selected
  state.selected = { ...state.selected, style: next };

  // Re-render so UI reflects updates (badges, highlights, etc.)
  const versesEl = $("verses");
  if (versesEl) {
    renderVerses(versesEl, state.verses, {
      selectedKey: state.selectedKey,
      onSelect: (vv) => selectVerse(vv)
    });
  }

  syncToolbarActiveStates();
}

/* =============================================================================
 * 21) VERSE TOOLBAR (bold, underline, bookmark, highlight, notes, help)
 * ============================================================================= */

function setupVerseToolbar() {
  on("boldBtn", "click", async () => {
    if (!ensureSelected()) return;
    await upsertSelectedStyle({ bold: !state.selected.style?.bold });
  });

  on("underlineBtn", "click", async () => {
    if (!ensureSelected()) return;
    await upsertSelectedStyle({ underline: !state.selected.style?.underline });
  });

  on("verseBookmarkBtn", "click", async () => {
    if (!ensureSelected()) return;
    await upsertSelectedStyle({ bookmarked: !state.selected.style?.bookmarked });
  });

  // Highlight menu toggle
  on("highlightBtn", "click", (e) => {
    e.stopPropagation();
    if ($("colorMenu")) $("colorMenu").hidden = !$("colorMenu").hidden;
  });

  // Choose highlight color
  document.addEventListener("click", async (e) => {
    const menu = $("colorMenu");
    if (!menu) return;

    const btn = e.target.closest("#colorMenu [data-color]");
    if (!btn) return;

    if (!ensureSelected()) return;

    const c = btn.dataset.color;
    menu.hidden = true;
    await upsertSelectedStyle({ color: c || "none" });
  });

  // Close color menu on outside click
  document.addEventListener("click", (e) => {
    if (e.target.closest(".toolgroup") || e.target.closest("#colorMenu")) return;
    if ($("colorMenu")) $("colorMenu").hidden = true;
  });

  on("noteBtn", "click", openNoteModalForSelected);
  on("verseHelpBtn", "click", openDiveDeeperForSelected);

  // Legacy ID support if present
  on("helpBtn", "click", openDiveDeeperForSelected);
}

/* =============================================================================
 * 22) NOTES LIST (Notes tab)
 * ============================================================================= */

async function refreshNotesListInto(targetEl) {
  if (!targetEl) return;

  const all = await listNotes(state.db, state.translation);

  let filtered = all;
  if (state.notesFilter === "fav") filtered = all.filter((n) => !!n.noteFavorite);
  if (state.notesFilter === "study") filtered = all.filter((n) => (n.noteType || "study") === "study");
  if (state.notesFilter === "research") filtered = all.filter((n) => (n.noteType || "study") === "research");
  if (state.notesFilter === "personal") filtered = all.filter((n) => (n.noteType || "study") === "personal");

  filtered = filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const limit = state.notesFilter === "recent" ? 50 : 500;
  const shown = filtered.slice(0, limit);

  targetEl.innerHTML = "";

  if (!shown.length) {
    targetEl.innerHTML = `<div class="hint">No notes yet. Select a verse and click 📝.</div>`;
    return;
  }

  for (const n of shown) {
    const card = document.createElement("div");
    card.className = "list-item";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = `${n.book} ${n.chapter}:${n.verse} • ${(n.noteType || "study").toUpperCase()}${
      n.noteFavorite ? " • ★" : ""
    }`;

    const s = document.createElement("div");
    s.className = "list-sub";
    s.textContent = (n.note || "").trim();

    const actions = document.createElement("div");
    actions.className = "list-actions";

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Open";
    btn.addEventListener("click", async () => {
      setMainTab("reader");
      await openChapter(n.book, n.chapter);

      const vv = state.verses.find((x) => x.verse === n.verse);
      if (vv) selectVerse(vv);

      openNoteModalForSelected();
    });

    actions.appendChild(btn);
    card.appendChild(t);
    card.appendChild(s);
    card.appendChild(actions);
    targetEl.appendChild(card);
  }
}

function setupNotesPanel() {
  if ($("notesAllBtn")) {
    $("notesAllBtn").addEventListener("click", async () => {
      state.notesFilter = "all";
      if ($("notesListMain")) await refreshNotesListInto($("notesListMain"));
    });
  }

  on("notesRecentBtn", "click", async () => {
    state.notesFilter = "recent";
    if ($("notesListMain")) await refreshNotesListInto($("notesListMain"));
  });

  on("notesFavBtn", "click", async () => {
    state.notesFilter = "fav";
    if ($("notesListMain")) await refreshNotesListInto($("notesListMain"));
  });

  on("notesStudyBtn", "click", async () => {
    state.notesFilter = "study";
    if ($("notesListMain")) await refreshNotesListInto($("notesListMain"));
  });

  on("notesResearchBtn", "click", async () => {
    state.notesFilter = "research";
    if ($("notesListMain")) await refreshNotesListInto($("notesListMain"));
  });

  on("notesPersonalBtn", "click", async () => {
    state.notesFilter = "personal";
    if ($("notesListMain")) await refreshNotesListInto($("notesListMain"));
  });
}

/* =============================================================================
 * 23) BOOKMARKS (Bookmarks tab)
 * ============================================================================= */

async function renderChapterBookmarksInto(targetEl) {
  if (!targetEl) return;

  const items = await listBookmarks(state.db, state.translation);
  targetEl.innerHTML = "";

  if (!items.length) {
    targetEl.innerHTML = `<div class="hint">No chapter bookmarks yet.</div>`;
    return;
  }

  for (const b of items) {
    const card = document.createElement("div");
    card.className = "list-item";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = `${b.book} ${b.chapter}`;

    const s = document.createElement("div");
    s.className = "list-sub";
    s.textContent = `Saved: ${new Date(b.savedAt).toLocaleString()}`;

    const actions = document.createElement("div");
    actions.className = "list-actions";

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Open";
    btn.addEventListener("click", async () => {
      setMainTab("reader");
      await openChapter(b.book, b.chapter);
    });

    actions.appendChild(btn);
    card.appendChild(t);
    card.appendChild(s);
    card.appendChild(actions);
    targetEl.appendChild(card);
  }
}

async function renderVerseBookmarksOnlyInto(targetEl) {
  if (!targetEl) return;

  const items = await listAllStyles(state.db, state.translation);
  const filtered = items
    .filter((s) => !!s.bookmarked)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  targetEl.innerHTML = "";

  if (!filtered.length) {
    targetEl.innerHTML = `<div class="hint">No verse bookmarks yet.</div>`;
    return;
  }

  for (const s of filtered.slice(0, 500)) {
    const card = document.createElement("div");
    card.className = "list-item";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = `${s.book} ${s.chapter}:${s.verse}`;

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = `🔖 Bookmarked verse`;

    const actions = document.createElement("div");
    actions.className = "list-actions";

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Open";
    btn.addEventListener("click", async () => {
      setMainTab("reader");
      await openChapter(s.book, s.chapter);

      const vv = state.verses.find((x) => x.verse === s.verse);
      if (vv) selectVerse(vv);
    });

    actions.appendChild(btn);
    card.appendChild(t);
    card.appendChild(sub);
    card.appendChild(actions);
    targetEl.appendChild(card);
  }
}

async function renderHighlightsOnlyInto(targetEl) {
  if (!targetEl) return;

  const items = await listAllStyles(state.db, state.translation);

  let filtered = items.filter((s) => s.color && s.color !== "none");
  if (state.highlightFilter && state.highlightFilter !== "all") {
    filtered = filtered.filter((s) => String(s.color).toLowerCase() === state.highlightFilter);
  }

  filtered = filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  targetEl.innerHTML = "";

  if (!filtered.length) {
    targetEl.innerHTML = `<div class="hint">No highlights yet.</div>`;
    return;
  }

  for (const s of filtered.slice(0, 500)) {
    const card = document.createElement("div");
    card.className = "list-item";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = `${s.book} ${s.chapter}:${s.verse}`;

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = `Highlight: ${hlLabel(s.color)}`;

    const actions = document.createElement("div");
    actions.className = "list-actions";

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Open";
    btn.addEventListener("click", async () => {
      setMainTab("reader");
      await openChapter(s.book, s.chapter);

      const vv = state.verses.find((x) => x.verse === s.verse);
      if (vv) selectVerse(vv);
    });

    actions.appendChild(btn);
    card.appendChild(t);
    card.appendChild(sub);
    card.appendChild(actions);
    targetEl.appendChild(card);
  }
}

function setupBookmarksPanel() {
  const sel = $("hlFilterSelect");

  if (sel && !sel.dataset.wired) {
    sel.dataset.wired = "1";
    sel.addEventListener("change", async () => {
      state.highlightFilter = sel.value || "all";
      if ($("bookmarksListMain")) await renderHighlightsOnlyInto($("bookmarksListMain"));
    });
  }

  on("bookmarksChaptersBtnMain", "click", () => {
    if (sel) sel.hidden = true;
    if ($("bookmarksListMain")) renderChapterBookmarksInto($("bookmarksListMain"));
  });

  on("bookmarksVersesBtnMain", "click", () => {
    if (sel) sel.hidden = true;
    if ($("bookmarksListMain")) renderVerseBookmarksOnlyInto($("bookmarksListMain"));
  });

  on("bookmarksHighlightsBtnMain", "click", () => {
    if (sel) {
      sel.hidden = false;
      populateHighlightFilterUI();
    }
    if ($("bookmarksListMain")) renderHighlightsOnlyInto($("bookmarksListMain"));
  });
}

/* =============================================================================
 * 24) SEARCH (Sidebar Search pane)
 * ============================================================================= */

function setupSearch() {
  on("searchBtn", "click", async () => {
    const q = $("searchInput") ? $("searchInput").value.trim() : "";
    if (!q) return;

    if ($("searchStatus")) $("searchStatus").textContent = "Searching…";

    const storeName = storeForSearch(state.translation);
    const hits = await searchTextCursor(state.db, storeName, q, 120);

    if ($("searchStatus")) $("searchStatus").textContent = `${hits.length} result(s)`;
    openOverlay("Search Results");

    const body = $("overlayBody");
    if (!body) return;

    renderOverlayList(
      body,
      hits.map((h) => ({
        title: `${h.book} ${h.chapter}:${h.verse}`,
        subtitle: h.text,
        actionText: "Open",
        onAction: async () => {
          closeOverlay();
          setMainTab("reader");
          await openChapter(h.book, h.chapter);
        }
      }))
    );
  });

  on("clearSearchBtn", "click", () => {
    if ($("searchInput")) $("searchInput").value = "";
    if ($("searchStatus")) $("searchStatus").textContent = "";
  });
}

/* =============================================================================
 * 25) QUICK TOOLS (Bookmark chapter, Copy chapter)
 * ============================================================================= */

function setupQuickActions() {
  on("bookmarkBtn", "click", async () => {
    const saved = await toggleBookmark(state.db, {
      translation: state.translation,
      book: state.book,
      chapter: state.chapter
    });
    toast(saved ? "Chapter bookmark saved." : "Chapter bookmark removed.");
  });

  on("copyBtn", "click", async () => {
    const title = `${state.translation} ${state.book} ${state.chapter}`;
    const text = $("verses") ? $("verses").innerText : "";

    try {
      await navigator.clipboard.writeText(`${title}\n\n${text}`);
      toast("Copied.");
    } catch {
      popupMessage("Copy Failed", "Clipboard permission was blocked by the browser.");
    }
  });
}

/* =============================================================================
 * 26) BOOT
 * ============================================================================= */

async function init() {
  await registerServiceWorker();
  setupInstallButton();

  state.db = await openDb();

  if ($("netStatus")) setNetStatus($("netStatus"));
  if ($("dbStatus")) $("dbStatus").textContent = "IndexedDB ready";

  // Create dialog helper (now that DOM exists)
  dialog = createDialog();

  await setupTheme();

  // Load saved translation
  const savedT = await loadSetting(state.db, "translation");
  if (savedT) state.translation = savedT;

  // Load highlight label customizations
  await loadHighlightLabels();

  setTranslationHint();

  setupActivityBar();
  setPane("explorer");

  setupOverlayClose();
  setupSettings();

  setupSidebarCollapse();
  await restoreSidebarState();

  // Sidebar close button in the sidebar itself
  on("sidebarCloseBtn", "click", async () => {
    if (isMobileLayout()) {
      document.body.classList.remove("sidebar-drawer-open");
      await saveSetting(state.db, "drawerOpen", "0");
    } else {
      document.body.classList.add("sidebar-hidden");
      await saveSetting(state.db, "sidebarHidden", "1");
    }
  });

  wireMainTabs();
  setMainTab("reader");

  // Import the selected translation (KJV by default)
  await ensureTranslationImported(state.translation);

  // Appearance settings (accent + font size)
  await restoreAppearanceSettings();

  // Populate settings UI bits
  populateHighlightLabelsUI();
  populateHighlightFilterUI();

  populateBooks();
  populateChapters();

  setupNavigation();
  setupVerseToolbar();
  setupNoteModal();
  setupGoButton();
  setupNotesPanel();
  setupBookmarksPanel();
  setupSearch();
  setupQuickActions();

  await updateBottomBarForTranslation();

  await openChapter(state.book, state.chapter);

  window.addEventListener("resize", () => {
    if (!isMobileLayout()) {
      document.body.classList.remove("sidebar-drawer-open");
    }
  });
}

init();
