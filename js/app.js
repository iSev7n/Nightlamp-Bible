/**
 * app.js
 * -----------------------------------------------------------------------------
 * Robust build:
 * - Never crashes if optional UI IDs are missing
 * - Supports translation via dropdown (translationSelect) OR tabs (tabKJV/tabNIV)
 * - Imports multiple translations from XML into IndexedDB (offline-first)
 * - Adds Timeline tab (Era cards w/ jump chips)
 * - Adds Smart Highlights labels + Highlights filter in Bookmarks tab
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
  loadSetting
} from "./providers.js";
import { setNetStatus, renderVerses, renderOverlayList } from "./ui.js";
import { importKJVFromXML, importBibleFromXML } from "./importKJV.js";

const NIV_CONFIG = { proxyBaseUrl: "https://YOUR-DOMAIN.com/api", token: "" };

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

/* ------------------------------ Helpers ------------------------------ */

const $ = (id) => document.getElementById(id);
const on = (id, evt, fn) => {
  const el = $(id);
  if (!el) return false;
  el.addEventListener(evt, fn);
  return true;
};

const DEFAULT_HL_LABELS = {
  gold: "Promise",
  mint: "Command",
  lav: "Prophecy",
  rose: "Warning",
  sky: "Fulfillment"
};

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

function toast(msg){
  const el = $("dbStatus");
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => {
    if ($("dbStatus")) $("dbStatus").textContent = "IndexedDB ready";
  }, 1200);
}

function ensureSelected(){
  if (!state.selected){
    toast("Select a verse first.");
    return false;
  }
  return true;
}

function updateSelectionChip(){
  const chip = $("selChip");
  if (!chip) return;
  chip.textContent = state.selected
    ? `${state.book} ${state.chapter}:${state.selected.verse}`
    : "No verse selected";
}

function hlLabel(color){
  const c = String(color || "").toLowerCase();
  return state.hlLabels[c] || DEFAULT_HL_LABELS[c] || c || "";
}

/* ----------------------------- Tabs ----------------------------- */

function setMainTab(name){
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

function wireMainTabs(){
  on("tabReader", "click", () => setMainTab("reader"));
  on("tabNotes", "click", () => setMainTab("notes"));
  on("tabBookmarks", "click", () => setMainTab("bookmarks"));
  on("tabTimeline", "click", () => setMainTab("timeline"));
}

/* ------------------------------ Timeline ------------------------------ */

function renderTimelineInto(targetEl){
  targetEl.innerHTML = "";

  for (const era of TIMELINE_ERAS){
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

    for (const a of era.anchors){
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

/* ------------------------------ SW + Install ------------------------------ */

async function registerServiceWorker(){
  if (!("serviceWorker" in navigator)) return;
  await navigator.serviceWorker.register("./sw.js");
}

function setupInstallButton(){
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

/* ------------------------------ Sidebar (Explorer/Search) ------------------------------ */

function isMobileLayout(){
  return window.matchMedia("(max-width: 900px)").matches;
}

function setPane(name){
  if ($("actExplorer")) $("actExplorer").classList.toggle("active", name === "explorer");
  if ($("actSearch")) $("actSearch").classList.toggle("active", name === "search");
  if ($("paneExplorer")) $("paneExplorer").hidden = name !== "explorer";
  if ($("paneSearch")) $("paneSearch").hidden = name !== "search";
}

function setupActivityBar(){
  const isSidebarVisible = () => {
    if (isMobileLayout()) {
      return document.body.classList.contains("sidebar-drawer-open");
    }
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

    // ✅ If this pane is active AND sidebar is currently visible -> CLOSE
    if (alreadyActive && visible) {
      await closeSidebar();
      return;
    }

    // ✅ Otherwise OPEN sidebar and show requested pane
    await openSidebar();
    setPane(pane);
  };

  on("actExplorer", "click", () => togglePane("explorer"));
  on("actSearch", "click", () => togglePane("search"));
}


/* ------------------------------ Sidebar Toggle ------------------------------ */

async function toggleSidebar(){
  if (isMobileLayout()){
    const open = document.body.classList.toggle("sidebar-drawer-open");
    await saveSetting(state.db, "drawerOpen", open ? "1" : "0");
    return;
  }
  const hidden = document.body.classList.toggle("sidebar-hidden");
  await saveSetting(state.db, "sidebarHidden", hidden ? "1" : "0");
}

function setupSidebarCollapse(){
  on("collapseSidebarBtn", "click", toggleSidebar);

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

    if (!clickedInsideSidebar && !clickedActivity && !clickedToggle){
      document.body.classList.remove("sidebar-drawer-open");
      saveSetting(state.db, "drawerOpen", "0");
    }
  }, true);
}

async function restoreSidebarState(){
  const v = await loadSetting(state.db, "sidebarHidden");
  if (v === "1") document.body.classList.add("sidebar-hidden");

  const d = await loadSetting(state.db, "drawerOpen");
  if (d === "1") document.body.classList.add("sidebar-drawer-open");
}

/* ------------------------------ Theme Button ------------------------------ */

async function setupTheme(){
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

/* ------------------------------ Appearance ------------------------------ */

function accentForVariant(v){
  switch (v) {
    case "purple": return "#7c5cff";
    case "green": return "#2bb673";
    case "amber": return "#f2b233";
    case "rose": return "#ff4d6d";
    case "blue":
    default: return "#007acc";
  }
}

function applyAccentVariant(variant){
  document.documentElement.style.setProperty("--accent", accentForVariant(variant));
}

function applyReaderFontSize(px){
  const safe = Math.max(10, Math.min(30, Number(px) || 14));
  document.documentElement.style.setProperty("--reader-font-size", `${safe}px`);
}

async function restoreAppearanceSettings(){
  const variant = (await loadSetting(state.db, "themeVariant")) || "blue";
  const fontPx = (await loadSetting(state.db, "readerFontPx")) || "14";

  applyAccentVariant(variant);
  applyReaderFontSize(fontPx);

  if ($("themeVariantSelect")) $("themeVariantSelect").value = variant;
  if ($("fontSizeSelect")) $("fontSizeSelect").value = String(fontPx);
}

/* ------------------------------ Highlight Labels (Smart Highlights) ------------------------------ */

async function loadHighlightLabels(){
  for (const k of Object.keys(DEFAULT_HL_LABELS)){
    const v = await loadSetting(state.db, `hlLabel_${k}`);
    if (v) state.hlLabels[k] = v;
  }
}

function populateHighlightLabelsUI(){
  if ($("hlLabelGold")) $("hlLabelGold").value = state.hlLabels.gold || DEFAULT_HL_LABELS.gold;
  if ($("hlLabelMint")) $("hlLabelMint").value = state.hlLabels.mint || DEFAULT_HL_LABELS.mint;
  if ($("hlLabelLav")) $("hlLabelLav").value = state.hlLabels.lav || DEFAULT_HL_LABELS.lav;
  if ($("hlLabelRose")) $("hlLabelRose").value = state.hlLabels.rose || DEFAULT_HL_LABELS.rose;
  if ($("hlLabelSky")) $("hlLabelSky").value = state.hlLabels.sky || DEFAULT_HL_LABELS.sky;
}

async function saveHighlightLabelsFromUI(){
  const map = {
    gold: $("hlLabelGold")?.value,
    mint: $("hlLabelMint")?.value,
    lav: $("hlLabelLav")?.value,
    rose: $("hlLabelRose")?.value,
    sky: $("hlLabelSky")?.value
  };

  for (const [k, raw] of Object.entries(map)){
    const v = (raw || "").trim() || DEFAULT_HL_LABELS[k];
    state.hlLabels[k] = v;
    await saveSetting(state.db, `hlLabel_${k}`, v);
  }
}

async function resetHighlightLabels(){
  state.hlLabels = { ...DEFAULT_HL_LABELS };
  populateHighlightLabelsUI();
  for (const [k, v] of Object.entries(DEFAULT_HL_LABELS)){
    await saveSetting(state.db, `hlLabel_${k}`, v);
  }
}

function populateHighlightFilterUI(){
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

/* ------------------------------ Settings / Translations ------------------------------ */

function openSettings(){ if ($("settingsModal")) $("settingsModal").hidden = false; }
function closeSettings(){ if ($("settingsModal")) $("settingsModal").hidden = true; }

function translationMeta(id){
  return TRANSLATIONS.find(t => t.id === id) || TRANSLATIONS[0];
}

async function updateBottomBarForTranslation(){
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

function populateTranslationSelect(){
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

async function ensureTranslationImported(translationId){
  const meta = translationMeta(translationId);

  if (translationId === "KJV"){
    await ensureKJVImported();
    return;
  }

  const storeName = meta.store();
  const count = await countStore(state.db, storeName);
  if (count > 0) return;

  toast(`Importing ${meta.id}…`);
  await importBibleFromXML(meta.xml, storeName, (n) => {
    toast(`Importing ${meta.id}… ${n.toLocaleString()} verses`);
  });
  toast(`${meta.id} imported.`);
}

function setTranslationHint(){
  if ($("translationHint")){
    const meta = translationMeta(state.translation);
    $("translationHint").textContent =
      `${meta.label} is stored locally for full offline reading.`;
  }

  if ($("sbTranslation")) $("sbTranslation").textContent = state.translation;
  if ($("sbMode")) $("sbMode").textContent = "Offline";
}

async function setTranslation(t){
  state.translation = t;
  await saveSetting(state.db, "translation", t);

  if ($("tabKJV")) $("tabKJV").setAttribute("aria-selected", t === "KJV" ? "true" : "false");
  if ($("tabNIV")) $("tabNIV").setAttribute("aria-selected", t === "NIV" ? "true" : "false");

  if ($("translationSelect")) $("translationSelect").value = t;

  setTranslationHint();

  await updateBottomBarForTranslation();
  await ensureTranslationImported(t);
  await openChapter(state.book, state.chapter);
}

function setupSettings(){
  on("settingsBtn", "click", () => {
    populateHighlightLabelsUI();
    openSettings();
  });
  on("settingsCloseBtn", "click", closeSettings);

  if ($("settingsModal")){
    $("settingsModal").addEventListener("click", (e) => {
      if (e.target === $("settingsModal")) closeSettings();
    });
  }

  populateTranslationSelect();

  const hasOldTabs = !!$("tabKJV") || !!$("tabNIV");
  if (hasOldTabs){
    if ($("tabKJV")) $("tabKJV").addEventListener("click", async () => setTranslation("KJV"));
    if ($("tabNIV")) $("tabNIV").addEventListener("click", async () => setTranslation("NIV"));
  }

  if ($("themeVariantSelect")){
    $("themeVariantSelect").addEventListener("change", async () => {
      const v = $("themeVariantSelect").value || "blue";
      applyAccentVariant(v);
      await saveSetting(state.db, "themeVariant", v);
    });
  }

  if ($("fontSizeSelect")){
    $("fontSizeSelect").addEventListener("change", async () => {
      const px = $("fontSizeSelect").value || "14";
      applyReaderFontSize(px);
      await saveSetting(state.db, "readerFontPx", String(px));
    });
  }

  if ($("saveHlLabelsBtn")){
    $("saveHlLabelsBtn").addEventListener("click", async () => {
      await saveHighlightLabelsFromUI();
      populateHighlightFilterUI();
      toast("Highlight labels saved.");
    });
  }

  if ($("resetHlLabelsBtn")){
    $("resetHlLabelsBtn").addEventListener("click", async () => {
      await resetHighlightLabels();
      populateHighlightFilterUI();
      toast("Highlight labels reset.");
    });
  }
}

/* ------------------------------ KJV Import ------------------------------ */

async function ensureKJVImported(){
  const count = await countStore(state.db, stores().KJV_VERSES);
  if (count > 0){
    if ($("dbStatus")) $("dbStatus").textContent = `KJV imported (${count.toLocaleString()} verses)`;
    return;
  }

  if ($("dbStatus")) $("dbStatus").textContent = "Importing KJV…";
  const result = await importKJVFromXML("./data/EnglishKJBible.xml", (n) => {
    if ($("dbStatus")) $("dbStatus").textContent = `Importing… ${n.toLocaleString()} verses`;
  });
  if ($("dbStatus")) $("dbStatus").textContent =
    `KJV imported (${result.books} books, ${result.verses.toLocaleString()} verses)`;
}

/* ------------------------------ Book/Chapter selects ------------------------------ */

function maxChaptersForBook(book){
  return CHAPTER_COUNTS[book] || 50;
}

function populateBooks(){
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

function populateChapters(){
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

function setVerseDropdownOptions(maxVerse){
  const el = $("verseSelect");
  if (!el) return;
  const m = Math.max(1, Number(maxVerse) || 1);
  el.innerHTML = Array.from({ length: m }, (_, i) => i + 1)
    .map(n => `<option value="${n}">${n}</option>`)
    .join("");
  el.value = "1";
}

/* ------------------------------ Chapter Loading ------------------------------ */

function storeForSearch(translationId){
  const id = String(translationId || "").toUpperCase();
  switch (id){
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

async function openChapter(book, chapter){
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
  try{
    if (typeof getChapterOffline === "function"){
      verses = await getChapterOffline(state.db, state.translation, book, chapter);
    } else {
      verses =
        state.translation === "KJV"
          ? await getChapterKJV(state.db, book, chapter)
          : await getChapterNIV(state.db, book, chapter, NIV_CONFIG);
    }
  } catch (e){
    if ($("verses")){
      $("verses").innerHTML =
        `<div class="hint">Could not load chapter. ${navigator.onLine ? "Check translation import/settings." : "You are offline."}</div>`;
    }
    return;
  }

  if (!verses.length){
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

  renderVerses($("verses"), merged, {
    selectedKey: state.selectedKey,
    onSelect: (v) => selectVerse(v)
  });

  syncToolbarActiveStates();
}

function selectVerse(v){
  const key = `${v.book}|${v.chapter}|${v.verse}`;

  if (state.selectedKey && key === state.selectedKey){
    state.selected = null;
    state.selectedKey = "";
    updateSelectionChip();

    renderVerses($("verses"), state.verses, {
      selectedKey: "",
      onSelect: (vv) => selectVerse(vv)
    });

    syncToolbarActiveStates();
    return;
  }

  state.selected = v;
  state.selectedKey = key;
  updateSelectionChip();

  renderVerses($("verses"), state.verses, {
    selectedKey: state.selectedKey,
    onSelect: (vv) => selectVerse(vv)
  });

  syncToolbarActiveStates();
}

function syncToolbarActiveStates(){
  const st = state.selected?.style || null;
  if ($("boldBtn")) $("boldBtn").classList.toggle("active", !!st?.bold);
  if ($("underlineBtn")) $("underlineBtn").classList.toggle("active", !!st?.underline);
  if ($("verseBookmarkBtn")) $("verseBookmarkBtn").classList.toggle("active", !!st?.bookmarked);
}

/* ------------------------------ Navigation ------------------------------ */

function setupNavigation(){
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

/* ------------------------------ Sidebar Go ------------------------------ */

function setupGoButton(){
  const go = async () => {
    const b = $("bookSelect") ? $("bookSelect").value : state.book;
    const c = $("chapterSelect") ? Number($("chapterSelect").value) : state.chapter;
    const vNum = $("verseSelect") ? Number($("verseSelect").value || 1) : 1;

    if (b !== state.book || c !== state.chapter){
      await openChapter(b, c);
    }

    const verse = state.verses.find(v => v.verse === vNum) || null;
    if (verse){
      selectVerse(verse);
      const el = document.querySelector(`[data-key="${state.selectedKey}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  on("goBtn", "click", go);

  ["bookSelect","chapterSelect","verseSelect"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") go();
    });
  });
}

/* ------------------------------ Overlay helpers ------------------------------ */

function openOverlay(title){
  if ($("overlayTitle")) $("overlayTitle").textContent = title;
  if ($("resultsOverlay")) $("resultsOverlay").hidden = false;
}
function closeOverlay(){
  if ($("resultsOverlay")) $("resultsOverlay").hidden = true;
  if ($("overlayBody")) $("overlayBody").innerHTML = "";
}
function setupOverlayClose(){
  on("overlayCloseBtn", "click", closeOverlay);
  if ($("resultsOverlay")){
    $("resultsOverlay").addEventListener("click", (e) => {
      if (e.target === $("resultsOverlay")) closeOverlay();
    });
  }
}

/* ------------------------------ Dive Deeper (?) ------------------------------ */

function openDiveDeeperForSelected(){
  if (!state.selected) {
    popupMessage("No Verse Selected", "");
    return;
  }

  const v = state.selected;
  openOverlay("Dive Deeper");

  const body = $("overlayBody");
  if (!body) return;

  body.innerHTML = "";

  const header = document.createElement("div");
  header.className = "list-item";
  header.innerHTML = `
    <div class="list-title">${state.translation} · ${v.book} ${v.chapter}:${v.verse}</div>
    <div class="list-sub">${v.text}</div>
  `;
  body.appendChild(header);

  const card = document.createElement("div");
  card.className = "list-item";
  card.innerHTML = `
    <div class="list-title">Guided Study (Offline)</div>
    <div class="list-sub">
      This is an offline-friendly “study helper”. Later you can plug in commentary datasets
      (JSON/XML) to show explanations and cross references.
    </div>
  `;
  body.appendChild(card);
}

function popupMessage(title, message){
  openOverlay(title);

  const body = $("overlayBody");
  if (!body) return;

  body.innerHTML = "";

  const card = body.closest(".overlay-card");
  if (card) {
    card.style.width = "360px";
    card.style.maxWidth = "92vw";
    card.style.height = "auto";
  }

  if (message){
    const msg = document.createElement("div");
    msg.className = "hint";
    msg.textContent = message;
    body.appendChild(msg);
  }

  const btnWrap = document.createElement("div");
  btnWrap.style.display = "flex";
  btnWrap.style.justifyContent = "center";
  btnWrap.style.marginTop = "12px";

  const btn = document.createElement("button");
  btn.className = "btn primary";
  btn.textContent = "OK";
  btn.onclick = closeOverlay;

  btnWrap.appendChild(btn);
  body.appendChild(btnWrap);
}

/* ------------------------------ Notes Modal (📝) ------------------------------ */

function openNoteModalForSelected(){
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

function closeNoteModal(){
  if ($("noteModal")) $("noteModal").hidden = true;
}

function setupNoteModal(){
  on("noteCloseBtn", "click", closeNoteModal);
  if ($("noteModal")){
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

    if ($("panelNotes") && !$("panelNotes").hidden && $("notesListMain")) refreshNotesListInto($("notesListMain"));
  });

  on("removeNoteBtn", "click", async () => {
    if (!ensureSelected()) return;
    await upsertSelectedStyle({ note: "", noteType: "study", noteFavorite: false });
    closeNoteModal();

    if ($("panelNotes") && !$("panelNotes").hidden && $("notesListMain")) refreshNotesListInto($("notesListMain"));
  });
}

/* ------------------------------ Verse Actions ------------------------------ */

async function upsertSelectedStyle(patch){
  if (!ensureSelected()) return;

  const v = state.selected;
  const key = verseStyleKey(state.translation, v.book, v.chapter, v.verse);

  const current = state.stylesMap.get(key) || {
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

  state.stylesMap.set(key, next);

  state.verses = state.verses.map(x => {
    if (x.book === v.book && x.chapter === v.chapter && x.verse === v.verse) {
      return { ...x, style: next };
    }
    return x;
  });

  state.selected = { ...state.selected, style: next };

  renderVerses($("verses"), state.verses, {
    selectedKey: state.selectedKey,
    onSelect: (vv) => selectVerse(vv)
  });

  syncToolbarActiveStates();
}

function setupVerseToolbar(){
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

  on("highlightBtn", "click", (e) => {
    e.stopPropagation();
    if ($("colorMenu")) $("colorMenu").hidden = !$("colorMenu").hidden;
  });

  document.addEventListener("click", async (e) => {
    const menu = $("colorMenu");
    if (!menu) return;

    const btn = e.target.closest("#colorMenu [data-color]");
    if (!btn) return;
    const c = btn.dataset.color;
    menu.hidden = true;
    await upsertSelectedStyle({ color: c || "none" });
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".toolgroup") || e.target.closest("#colorMenu")) return;
    if ($("colorMenu")) $("colorMenu").hidden = true;
  });

  on("noteBtn", "click", openNoteModalForSelected);
  on("verseHelpBtn", "click", openDiveDeeperForSelected);
  on("helpBtn", "click", openDiveDeeperForSelected);
}

/* ------------------------------ Notes List ------------------------------ */

async function refreshNotesListInto(targetEl){
  const all = await listNotes(state.db, state.translation);

  let filtered = all;
  if (state.notesFilter === "fav") filtered = all.filter(n => !!n.noteFavorite);
  if (state.notesFilter === "study") filtered = all.filter(n => (n.noteType || "study") === "study");
  if (state.notesFilter === "research") filtered = all.filter(n => (n.noteType || "study") === "research");
  if (state.notesFilter === "personal") filtered = all.filter(n => (n.noteType || "study") === "personal");

  filtered = filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const limit = state.notesFilter === "recent" ? 50 : 500;
  const shown = filtered.slice(0, limit);

  targetEl.innerHTML = "";
  if (!shown.length){
    targetEl.innerHTML = `<div class="hint">No notes yet. Select a verse and click 📝.</div>`;
    return;
  }

  for (const n of shown){
    const card = document.createElement("div");
    card.className = "list-item";

    const t = document.createElement("div");
    t.className = "list-title";
    t.textContent = `${n.book} ${n.chapter}:${n.verse} • ${(n.noteType || "study").toUpperCase()}${n.noteFavorite ? " • ★" : ""}`;

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
      const vv = state.verses.find(x => x.verse === n.verse);
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

function setupNotesPanel(){
  if ($("notesAllBtn")){
    $("notesAllBtn").addEventListener("click", async () => {
      state.notesFilter = "all";
      if ($("notesListMain")) await refreshNotesListInto($("notesListMain"));
    });
  }

  on("notesRecentBtn", "click", async () => { state.notesFilter = "recent"; if ($("notesListMain")) await refreshNotesListInto($("notesListMain")); });
  on("notesFavBtn", "click", async () => { state.notesFilter = "fav"; if ($("notesListMain")) await refreshNotesListInto($("notesListMain")); });
  on("notesStudyBtn", "click", async () => { state.notesFilter = "study"; if ($("notesListMain")) await refreshNotesListInto($("notesListMain")); });
  on("notesResearchBtn", "click", async () => { state.notesFilter = "research"; if ($("notesListMain")) await refreshNotesListInto($("notesListMain")); });
  on("notesPersonalBtn", "click", async () => { state.notesFilter = "personal"; if ($("notesListMain")) await refreshNotesListInto($("notesListMain")); });
}

/* ------------------------------ Bookmarks ------------------------------ */

async function renderChapterBookmarksInto(targetEl){
  const items = await listBookmarks(state.db, state.translation);
  targetEl.innerHTML = "";

  if (!items.length){
    targetEl.innerHTML = `<div class="hint">No chapter bookmarks yet.</div>`;
    return;
  }

  for (const b of items){
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

async function renderVerseBookmarksOnlyInto(targetEl){
  const items = await listAllStyles(state.db, state.translation);
  const filtered = items.filter(s => !!s.bookmarked).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  targetEl.innerHTML = "";
  if (!filtered.length){
    targetEl.innerHTML = `<div class="hint">No verse bookmarks yet.</div>`;
    return;
  }

  for (const s of filtered.slice(0, 500)){
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
      const vv = state.verses.find(x => x.verse === s.verse);
      if (vv) selectVerse(vv);
    });

    actions.appendChild(btn);
    card.appendChild(t);
    card.appendChild(sub);
    card.appendChild(actions);
    targetEl.appendChild(card);
  }
}

async function renderHighlightsOnlyInto(targetEl){
  const items = await listAllStyles(state.db, state.translation);

  let filtered = items.filter(s => (s.color && s.color !== "none"));
  if (state.highlightFilter && state.highlightFilter !== "all"){
    filtered = filtered.filter(s => String(s.color).toLowerCase() === state.highlightFilter);
  }
  filtered = filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  targetEl.innerHTML = "";
  if (!filtered.length){
    targetEl.innerHTML = `<div class="hint">No highlights yet.</div>`;
    return;
  }

  for (const s of filtered.slice(0, 500)){
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
      const vv = state.verses.find(x => x.verse === s.verse);
      if (vv) selectVerse(vv);
    });

    actions.appendChild(btn);
    card.appendChild(t);
    card.appendChild(sub);
    card.appendChild(actions);
    targetEl.appendChild(card);
  }
}

function setupBookmarksPanel(){
  const sel = $("hlFilterSelect");

  if (sel && !sel.dataset.wired){
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
    if (sel){
      sel.hidden = false;
      populateHighlightFilterUI();
    }
    if ($("bookmarksListMain")) renderHighlightsOnlyInto($("bookmarksListMain"));
  });
}

/* ------------------------------ Search ------------------------------ */

function setupSearch(){
  on("searchBtn", "click", async () => {
    const q = $("searchInput") ? $("searchInput").value.trim() : "";
    if (!q) return;

    if ($("searchStatus")) $("searchStatus").textContent = "Searching…";

    const storeName = storeForSearch(state.translation);
    const hits = await searchTextCursor(state.db, storeName, q, 120);

    if ($("searchStatus")) $("searchStatus").textContent = `${hits.length} result(s)`;
    openOverlay("Search Results");

    renderOverlayList($("overlayBody"), hits.map(h => ({
      title: `${h.book} ${h.chapter}:${h.verse}`,
      subtitle: h.text,
      actionText: "Open",
      onAction: async () => {
        closeOverlay();
        setMainTab("reader");
        await openChapter(h.book, h.chapter);
      }
    })));
  });

  on("clearSearchBtn", "click", () => {
    if ($("searchInput")) $("searchInput").value = "";
    if ($("searchStatus")) $("searchStatus").textContent = "";
  });
}

/* ------------------------------ Quick Tools ------------------------------ */

function setupQuickActions(){
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
    await navigator.clipboard.writeText(`${title}\n\n${text}`);
    toast("Copied.");
  });
}

/* ------------------------------ Boot ------------------------------ */

async function init(){
  await registerServiceWorker();
  setupInstallButton();

  state.db = await openDb();
  if ($("netStatus")) setNetStatus($("netStatus"));
  if ($("dbStatus")) $("dbStatus").textContent = "IndexedDB ready";

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

  on("sidebarCloseBtn", "click", async () => {
  if (isMobileLayout()){
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

  await restoreAppearanceSettings();

  // Populate settings UI bits
  populateHighlightLabelsUI();
  populateHighlightFilterUI();

  await openChapter(state.book, state.chapter);

  window.addEventListener("resize", () => {
    if (!isMobileLayout()){
      document.body.classList.remove("sidebar-drawer-open");
    }
  });
}

init();
