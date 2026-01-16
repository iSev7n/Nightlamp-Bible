# 🌙 Nightlamp Bible

<center>![Nightlamp Bible Banner](assets/Banner.png)</center>

**Nightlamp Bible** is a fast, offline-first Scripture reader designed for focused study, highlighting, note-taking, and bookmarking — even with no internet connection. It is built as a Progressive Web App (PWA) and runs smoothly on desktop and mobile devices.

---

## ✨ Features

### 📖 Reader
- Clean, distraction-free Bible reader
- Book, chapter, and verse navigation
- Previous / Next chapter controls
- Adjustable reader font size
- Desktop and mobile friendly UI

### 📝 Notes
- Attach notes directly to individual verses
- Categorize notes (Study, Research, Personal)
- Favorite important notes
- Notes are stored locally (IndexedDB)
- Visual note indicator on verses

### 🔖 Bookmarks & Highlights
- Bookmark chapters or individual verses
- Highlight verses with multiple colors
- Optional meanings for each highlight color
- Visual bookmark and highlight indicators
- Filter bookmarks and highlights

### 🔍 Search
- Fast full-text verse search
- Works completely offline once data is cached
- Jump directly to search results

### 🗂 Timeline
- Scripture timeline view
- Jump to key passages by era
- Designed for future expansion

### ⚡ Offline-First
- Service Worker caching
- IndexedDB storage
- Full functionality without internet
- PWA installable on desktop and mobile

### 🎨 Customization
- Light & Dark mode
- Color accent variants
- Reader font size controls

---

## 📦 Included Bible Translations

- **KJV (English)** – Stored locally for full offline use
- **ESV (English)**
- **NIV (English)**
- **Amplified**
- **Amplified Classic**
- **NVI (Spanish)**

> ⚠️ Some translations may require appropriate licensing for redistribution.

---

## 🛠 Tech Stack

- HTML5
- CSS3 (Custom UI, no frameworks)
- Vanilla JavaScript (ES Modules)
- IndexedDB for data storage
- Service Worker for offline caching
- Progressive Web App (PWA)

No external libraries or frameworks required.

---

## 🚀 Getting Started

### Run Locally

1) Clone the repository:

- `git clone https://github.com/your-username/nightlamp-bible.git`
- `cd nightlamp-bible`

2) Serve the project using any local server (required for service workers):

- `python -m http.server`

3) Open in your browser:

- `http://localhost:8000`

---

## 📱 Install as an App

Nightlamp Bible supports installation as a Progressive Web App:

- Click **Install** in the app header (Chrome / Edge)
- Or **Add to Home Screen** on mobile devices

Once installed, the app runs fully offline.

---

## 🗃 Data Storage

- Notes, bookmarks, highlights, and settings are stored locally using **IndexedDB**
- No accounts, no tracking, no cloud sync
- Your data stays on your device

---

## 🔐 Privacy

- 100% local-first
- No analytics
- No remote servers
- No user data collection

---

## 🧭 Project Structure


├── index.html
├── manifest.webmanifest
├── sw.js
├── css/
│ └── theme.css
├── js/
│ ├── app.js
│ ├── db.js
│ ├── ui.js
│ ├── providers.js
│ └── importKJV.js
├── data/
│ ├── EnglishKJBible.xml
│ ├── EnglishESVBible.xml
│ ├── EnglishNIVBible.xml
│ ├── EnglishAmplifiedBible.xml
│ ├── EnglishAmplifiedClassicBible.xml
│ └── SpanishNVIBible.xml
└── assets/
├── logo.jpg
├── icon-192.png
└── icon-512.png

---

## 🤝 Contributing

Contributions are welcome.

1) Fork the repository  
2) Create a feature branch  
3) Submit a pull request  

Please try and keep the project framework-free and offline-first.

---

## 📜 License

This project is licensed under the **MIT License**.

> Bible translation content may be subject to separate licenses.

---

## 🙏 Acknowledgment

Built to provide a calm, distraction-free space for bible reading and study.

**“Your word is a lamp for my feet, a light on my path.” — Psalm 119:105**