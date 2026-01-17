/**
 * ui.js
 * -----------------------------------------------------------------------------
 * Rendering + small UI helpers
 */

export function setNetStatus(el){
  const update = () => {
    el.textContent = navigator.onLine ? "online" : "offline";
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function colorClass(color){
  switch (color) {
    case "gold": return "hl-gold";
    case "mint": return "hl-mint";
    case "lav":  return "hl-lav";
    case "rose": return "hl-rose";
    case "sky":  return "hl-sky";
    default: return "";
  }
}

/**
 * verses: [{book,chapter,verse,text, style?}]
 * options:
 * - selectedKey: string
 * - onSelect(verseObj)
 */
export function renderVerses(container, verses, options = {}){
  const { selectedKey = "", onSelect = null } = options;

  container.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (const v of verses) {
    const st = v.style || null;

    const row = document.createElement("div");
    row.className = "verse";

    const key = `${v.book}|${v.chapter}|${v.verse}`;
    row.dataset.key = key;

    if (key === selectedKey) row.classList.add("selected");

    // Verse bookmark visual
    if (st?.bookmarked) row.classList.add("bookmarked");

    // Note visual (📝 badge)
    const hasNote = !!(st?.note && String(st.note).trim().length > 0);
    if (hasNote) row.classList.add("has-note");

    if (st?.color && st.color !== "none") row.classList.add(colorClass(st.color));
    if (st?.underline) row.classList.add("underline");
    if (st?.bold) row.classList.add("bold");

    const num = document.createElement("div");
    num.className = "verse-num";
    num.textContent = String(v.verse);

    // Add the note badge icon on the verse number box
    if (hasNote) {
      const badge = document.createElement("span");
      badge.className = "verse-badge-note";
      badge.textContent = "📝";
      badge.title = "Note saved";
      num.appendChild(badge);
    }

    const text = document.createElement("div");
    text.className = "verse-text";
    text.textContent = v.text;

    row.appendChild(num);
    row.appendChild(text);

    row.addEventListener("click", () => {
      if (typeof onSelect === "function") onSelect(v);
    });

    frag.appendChild(row);
  }

  container.appendChild(frag);
}

/**
 * items: [{ title, subtitle, actionText, onAction }]
 */
export function renderOverlayList(container, items){
  container.innerHTML = "";

  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Nothing here yet.";
    container.appendChild(empty);
    return;
  }

  for (const it of items) {
    const card = document.createElement("div");
    card.className = "list-item";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = it.title || "Untitled";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = it.subtitle || "";

    const actions = document.createElement("div");
    actions.className = "list-actions";

    if (it.actionText && typeof it.onAction === "function") {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = it.actionText;
      btn.addEventListener("click", it.onAction);
      actions.appendChild(btn);
    }

    if (it.extraActions && Array.isArray(it.extraActions)) {
      for (const a of it.extraActions) {
        const b = document.createElement("button");
        b.className = a.primary ? "btn primary" : "btn";
        b.textContent = a.text;
        b.addEventListener("click", a.onClick);
        actions.appendChild(b);
      }
    }

    

    card.appendChild(title);
    card.appendChild(sub);
    if (actions.childElementCount) card.appendChild(actions);

    container.appendChild(card);
  }
}

export function createDialog(){
  const $ = (id) => document.getElementById(id);

  const dlg = $("appDialog");
  const titleEl = $("dialogTitle");
  const msgEl = $("dialogMsg");
  const actionsEl = $("dialogActions");
  const closeBtn = $("dialogCloseBtn");
  const okBtn = $("dialogOkBtn");

  if (!dlg || !titleEl || !msgEl || !actionsEl || !closeBtn || !okBtn){
    return {
      show(){},
      hide(){}
    };
  }

  const hide = () => {
    dlg.hidden = true;
    actionsEl.innerHTML = `<button id="dialogOkBtn" class="btn primary">OK</button>`;
    const newOk = document.getElementById("dialogOkBtn");
    if (newOk) newOk.addEventListener("click", hide);
  };

  closeBtn.addEventListener("click", hide);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) hide();
  });

  okBtn.addEventListener("click", hide);

  const show = (opts = {}) => {
    const {
      title = "Notice",
      message = "",
      buttons = null
    } = opts;

    titleEl.textContent = title;
    msgEl.textContent = message;

    if (Array.isArray(buttons) && buttons.length){
      actionsEl.innerHTML = "";
      for (const b of buttons){
        const btn = document.createElement("button");
        btn.className = b.primary ? "btn primary" : "btn";
        btn.textContent = b.text || "OK";
        btn.addEventListener("click", async () => {
          try { if (typeof b.onClick === "function") await b.onClick(); }
          finally { hide(); }
        });
        actionsEl.appendChild(btn);
      }
    } else {
      actionsEl.innerHTML = "";
      const btn = document.createElement("button");
      btn.className = "btn primary";
      btn.textContent = "OK";
      btn.addEventListener("click", hide);
      actionsEl.appendChild(btn);
    }

    dlg.hidden = false;
  };

  return { show, hide };
}
