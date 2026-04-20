import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC0_SXcfDMna5KlWauOvMgDKzzhMDonMbQ",
  authDomain: "jayden-4a795.firebaseapp.com",
  projectId: "jayden-4a795",
  storageBucket: "jayden-4a795.firebasestorage.app",
  messagingSenderId: "686638306908",
  appId: "1:686638306908:web:68d53d8839c8ebbb42b899",
  measurementId: "G-1W3ZZSJL5L"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const form = document.getElementById("recordForm");
const exportBtn = document.getElementById("exportBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const selectedCount = document.getElementById("selectedCount");
const mapView = document.getElementById("mapView");
const calendarView = document.getElementById("calendarView");
const listView = document.getElementById("listView");
const recordCount = document.getElementById("recordCount");
const stadiumCount = document.getElementById("stadiumCount");
const currentViewLabel = document.getElementById("currentViewLabel");
const toggleButtons = document.querySelectorAll(".toggle-btn");
const template = document.getElementById("recordCardTemplate");
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatusText = document.getElementById("authStatusText");

let currentView = "map";
let records = [];
let selectedIds = new Set();
let currentUser = null;

function zh(text) {
  return text;
}

function setFormDisabled(disabled) {
  const fields = form.querySelectorAll("input, textarea, button");
  fields.forEach((field) => {
    field.disabled = disabled;
  });

  exportBtn.disabled = disabled;
  selectAllBtn.disabled = disabled;
  clearSelectionBtn.disabled = disabled;
}

function resetForSignedOut() {
  records = [];
  selectedIds.clear();
  renderAll();
}

function getRecordsCollection(userId) {
  return collection(db, "users", userId, "records");
}

async function loadRecordsForUser(userId) {
  const recordsQuery = query(getRecordsCollection(userId), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(recordsQuery);

  records = snapshot.docs.map((recordDoc) => ({
    id: recordDoc.id,
    ...recordDoc.data()
  }));

  selectedIds = new Set([...selectedIds].filter((id) => records.some((record) => record.id === id)));
  renderAll();
  switchView(currentView);
}

function formatDate(dateString) {
  if (!dateString) return zh("\u672a\u586b\u5beb\u65e5\u671f");

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatMonthLabel(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return zh("\u672a\u77e5\u6708\u4efd");
  }

  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long"
  }).format(date);
}

function getMapQuery(record) {
  return (record.mapQuery || `${record.stadium} ${record.location}`).trim();
}

function getMapUrl(record) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getMapQuery(record))}`;
}

function updateSelectedCount() {
  selectedCount.textContent = selectedIds.size;
}

function renderStats() {
  const stadiums = new Set(records.map((record) => record.stadium.trim()));
  const viewLabels = {
    map: zh("\u5730\u5716"),
    calendar: zh("\u65e5\u66c6"),
    list: zh("\u5217\u8868")
  };

  recordCount.textContent = records.length;
  stadiumCount.textContent = stadiums.size;
  currentViewLabel.textContent = viewLabels[currentView];
  updateSelectedCount();
}

function renderMapView() {
  mapView.innerHTML = "";

  if (!records.length) {
    mapView.innerHTML = `<div class="empty-state">${zh("\u65b0\u589e\u8a18\u9304\u5f8c\uff0c\u9019\u88e1\u6703\u51fa\u73fe\u53ef\u4ee5\u9ede\u9032\u771f\u5be6\u5730\u5716\u7684\u7403\u5834\u5361\u7247\u3002")}</div>`;
    return;
  }

  const grouped = records.reduce((accumulator, record) => {
    const key = record.location.trim() || zh("\u672a\u5206\u985e\u5730\u5340");
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(record);
    return accumulator;
  }, {});

  const grid = document.createElement("div");
  grid.className = "map-grid";

  Object.entries(grouped).forEach(([city, cityRecords]) => {
    const card = document.createElement("article");
    card.className = "map-card";

    const linksMarkup = cityRecords.map((record) => `
      <a class="map-link" href="${getMapUrl(record)}" target="_blank" rel="noreferrer">
        <div>
          <div class="map-link-title">${record.title}</div>
          <div class="map-meta">${record.stadium}</div>
        </div>
        <span class="map-link-arrow">${zh("\u958b\u5730\u5716")}</span>
      </a>
    `).join("");

    card.innerHTML = `
      <div class="map-card-header">
        <div class="map-city">${city}</div>
        <div class="map-count">${cityRecords.length} ${zh("\u5834")}</div>
      </div>
      <div class="map-meta">${zh("\u9ede\u9078\u5361\u7247\u53ef\u76f4\u63a5\u6253\u958b Google Maps")}</div>
      <div class="map-links">${linksMarkup}</div>
    `;

    grid.appendChild(card);
  });

  mapView.appendChild(grid);
}

function renderCalendarView() {
  calendarView.innerHTML = "";

  if (!records.length) {
    calendarView.innerHTML = `<div class="empty-state">${zh("\u65b0\u589e\u8a18\u9304\u5f8c\uff0c\u9019\u88e1\u6703\u4ee5\u771f\u6b63\u65e5\u66c6\u4eae\u71c8\u65b9\u5f0f\u986f\u793a\u4f60\u7684\u770b\u7403\u65e5\u3002")}</div>`;
    return;
  }

  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  const monthGroups = sorted.reduce((accumulator, record) => {
    const monthKey = record.date.slice(0, 7);
    if (!accumulator[monthKey]) {
      accumulator[monthKey] = [];
    }
    accumulator[monthKey].push(record);
    return accumulator;
  }, {});

  Object.entries(monthGroups).forEach(([monthKey, monthRecords]) => {
    const [yearString, monthString] = monthKey.split("-");
    const year = Number(yearString);
    const month = Number(monthString) - 1;
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const startDay = monthStart.getDay();
    const totalDays = monthEnd.getDate();

    const recordsByDate = monthRecords.reduce((accumulator, record) => {
      if (!accumulator[record.date]) {
        accumulator[record.date] = [];
      }
      accumulator[record.date].push(record);
      return accumulator;
    }, {});

    const shell = document.createElement("div");
    shell.className = "calendar-shell";

    const header = document.createElement("div");
    header.className = "calendar-header";
    header.innerHTML = `
      <span>${formatMonthLabel(`${monthKey}-01`)}</span>
      <span>${zh("\u6709\u8a18\u9304\u7684\u65e5\u5b50\u6703\u767c\u4eae")}</span>
    `;

    const weekdayRow = document.createElement("div");
    weekdayRow.className = "calendar-grid";
    [zh("\u65e5"), zh("\u4e00"), zh("\u4e8c"), zh("\u4e09"), zh("\u56db"), zh("\u4e94"), zh("\u516d")].forEach((weekday) => {
      const cell = document.createElement("div");
      cell.className = "calendar-day";
      cell.innerHTML = `<strong>${weekday}</strong>`;
      weekdayRow.appendChild(cell);
    });

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    for (let index = 0; index < startDay; index += 1) {
      const filler = document.createElement("div");
      filler.className = "calendar-day empty";
      grid.appendChild(filler);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const isoDay = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayRecords = recordsByDate[isoDay] || [];
      const cell = document.createElement("div");
      cell.className = `calendar-day ${dayRecords.length ? "has-record" : ""}`.trim();

      const chips = dayRecords.map((record) => `
        <div class="calendar-record-chip">${record.title}<br />${record.stadium}</div>
      `).join("");

      cell.innerHTML = `
        <div class="calendar-day-number">${day}</div>
        <div class="calendar-records">${chips}</div>
      `;
      grid.appendChild(cell);
    }

    shell.appendChild(header);
    shell.appendChild(weekdayRow);
    shell.appendChild(grid);
    calendarView.appendChild(shell);
  });
}

function renderListView() {
  listView.innerHTML = "";

  if (!records.length) {
    listView.innerHTML = `<div class="empty-state">${zh("\u9084\u6c92\u6709\u4efb\u4f55\u770b\u7403\u8a18\u9304\uff0c\u5148\u8a18\u4e0b\u4f60\u7684\u7b2c\u4e00\u5834\u5427\u3002")}</div>`;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "records-list";

  records.forEach((record, index) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".record-card");
    const image = fragment.querySelector(".record-image");
    const imageFallback = fragment.querySelector(".record-image-fallback");
    const checkbox = fragment.querySelector(".record-select-input");
    const mapLink = fragment.querySelector(".record-map-link");

    checkbox.checked = selectedIds.has(record.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedIds.add(record.id);
      } else {
        selectedIds.delete(record.id);
      }
      updateSelectedCount();
    });

    fragment.querySelector(".record-date").textContent = formatDate(record.date);
    fragment.querySelector(".record-location").textContent = record.location;
    fragment.querySelector(".record-title").textContent = record.title;
    fragment.querySelector(".record-stadium").textContent = `${zh("\u7403\u5834\uff1a")}${record.stadium}`;
    fragment.querySelector(".record-note").textContent = record.note || zh("\u6c92\u6709\u5099\u8a3b");

    mapLink.href = getMapUrl(record);
    mapLink.textContent = zh("\u958b\u555f\u771f\u5be6\u5730\u5716");

    if (record.imageUrl) {
      image.src = record.imageUrl;
      image.classList.add("show");
      imageFallback.style.display = "none";
    }

    card.querySelector('[data-action="up"]').addEventListener("click", () => moveRecord(index, -1));
    card.querySelector('[data-action="down"]').addEventListener("click", () => moveRecord(index, 1));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRecord(record.id));

    wrapper.appendChild(fragment);
  });

  listView.appendChild(wrapper);
}

function renderAll() {
  renderStats();
  renderMapView();
  renderCalendarView();
  renderListView();
}

function switchView(nextView) {
  currentView = nextView;
  mapView.classList.toggle("hidden", nextView !== "map");
  calendarView.classList.toggle("hidden", nextView !== "calendar");
  listView.classList.toggle("hidden", nextView !== "list");

  toggleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === nextView);
  });

  renderStats();
}

async function moveRecord(index, direction) {
  if (!currentUser) return;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= records.length) {
    return;
  }

  const currentRecord = records[index];
  const targetRecord = records[targetIndex];

  await Promise.all([
    updateDoc(doc(db, "users", currentUser.uid, "records", currentRecord.id), {
      createdAt: targetRecord.createdAt
    }),
    updateDoc(doc(db, "users", currentUser.uid, "records", targetRecord.id), {
      createdAt: currentRecord.createdAt
    })
  ]);

  await loadRecordsForUser(currentUser.uid);
}

async function deleteRecord(recordId) {
  if (!currentUser) return;

  selectedIds.delete(recordId);
  await deleteDoc(doc(db, "users", currentUser.uid, "records", recordId));
  await loadRecordsForUser(currentUser.uid);
}

function createRecord() {
  const formData = new FormData(form);

  return {
    title: formData.get("title").toString().trim(),
    date: formData.get("date").toString(),
    stadium: formData.get("stadium").toString().trim(),
    location: formData.get("location").toString().trim(),
    mapQuery: formData.get("mapQuery").toString().trim(),
    imageUrl: formData.get("imageUrl").toString().trim(),
    note: formData.get("note").toString().trim(),
    createdAt: Date.now()
  };
}

function resetForm() {
  form.reset();
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!currentUser) {
    alert(zh("\u8acb\u5148\u767b\u5165 Google \u5e33\u865f\u3002"));
    return;
  }

  const record = createRecord();

  if (!record.title || !record.date || !record.stadium || !record.location) {
    alert(zh("\u8acb\u5148\u586b\u5b8c\u6a19\u984c\u3001\u65e5\u671f\u3001\u7403\u5834\u548c\u57ce\u5e02\u3002"));
    return;
  }

  await addDoc(getRecordsCollection(currentUser.uid), record);
  resetForm();
  await loadRecordsForUser(currentUser.uid);
}

function selectAllRecords() {
  selectedIds = new Set(records.map((record) => record.id));
  renderAll();
  switchView(currentView);
}

function clearSelection() {
  selectedIds.clear();
  renderAll();
  switchView(currentView);
}

function createPdfWindowContent(selectedRecords) {
  const cardsMarkup = selectedRecords.map((record) => `
    <section style="page-break-inside: avoid; border: 1px solid #ddd; border-radius: 18px; padding: 18px; margin-bottom: 18px;">
      <h2 style="margin: 0 0 8px; color: #d55b00;">${record.title}</h2>
      <p style="margin: 0 0 8px;"><strong>${zh("\u65e5\u671f\uff1a")}</strong>${formatDate(record.date)}</p>
      <p style="margin: 0 0 8px;"><strong>${zh("\u7403\u5834\uff1a")}</strong>${record.stadium}</p>
      <p style="margin: 0 0 8px;"><strong>${zh("\u57ce\u5e02\uff1a")}</strong>${record.location}</p>
      <p style="margin: 0 0 8px;"><strong>${zh("\u5730\u5716\uff1a")}</strong>${getMapQuery(record)}</p>
      <p style="margin: 0 0 8px;"><strong>${zh("\u5099\u8a3b\uff1a")}</strong>${record.note || zh("\u7121")}</p>
      ${record.imageUrl ? `<img src="${record.imageUrl}" alt="photo" style="max-width: 100%; border-radius: 14px; margin-top: 10px;" />` : ""}
    </section>
  `).join("");

  return `
    <!DOCTYPE html>
    <html lang="zh-Hant">
    <head>
      <meta charset="UTF-8" />
      <title>${zh("\u770b\u7403\u7d00\u9304 PDF")}</title>
      <style>
        body { font-family: "Microsoft JhengHei", sans-serif; padding: 24px; color: #222; }
        h1 { color: #ff6b00; margin-bottom: 10px; }
        .hint { color: #666; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <h1>${zh("\u770b\u7403\u7d00\u9304\u532f\u51fa")}</h1>
      <p class="hint">${zh("\u958b\u555f\u5f8c\u8acb\u5728\u5217\u5370\u8996\u7a97\u9078\u64c7\u300c\u5132\u5b58\u70ba PDF\u300d\u3002")}</p>
      ${cardsMarkup}
      <script>
        window.onload = () => {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `;
}

function exportSelectedToPdf() {
  const selectedRecords = records.filter((record) => selectedIds.has(record.id));

  if (!selectedRecords.length) {
    alert(zh("\u8acb\u5148\u52fe\u9078\u60f3\u532f\u51fa\u7684\u6bd4\u8cfd\u3002"));
    return;
  }

  const printWindow = window.open("", "_blank", "width=980,height=720");

  if (!printWindow) {
    alert(zh("\u700f\u89bd\u5668\u64cb\u4e0b\u4e86\u65b0\u8996\u7a97\uff0c\u8acb\u5141\u8a31\u5f8c\u518d\u8a66\u4e00\u6b21\u3002"));
    return;
  }

  printWindow.document.open();
  printWindow.document.write(createPdfWindowContent(selectedRecords));
  printWindow.document.close();
}

async function handleSignIn() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert(`${zh("\u767b\u5165\u5931\u6557\uff1a")}${error.message}`);
  }
}

async function handleSignOut() {
  await signOut(auth);
}

form.addEventListener("submit", handleSubmit);
exportBtn.addEventListener("click", exportSelectedToPdf);
selectAllBtn.addEventListener("click", selectAllRecords);
clearSelectionBtn.addEventListener("click", clearSelection);
signInBtn.addEventListener("click", handleSignIn);
signOutBtn.addEventListener("click", handleSignOut);

toggleButtons.forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    authStatusText.textContent = `${zh("\u5df2\u767b\u5165\uff1a")}${user.displayName || user.email}`;
    signInBtn.classList.add("hidden");
    signOutBtn.classList.remove("hidden");
    setFormDisabled(false);
    await loadRecordsForUser(user.uid);
  } else {
    authStatusText.textContent = zh("\u8acb\u5148\u7528 Google \u767b\u5165\uff0c\u8cc7\u6599\u6703\u5b58\u5728\u4f60\u81ea\u5df1\u7684 Firebase \u96f2\u7aef\u5e33\u865f\u4e0b\u3002");
    signInBtn.classList.remove("hidden");
    signOutBtn.classList.add("hidden");
    setFormDisabled(true);
    resetForSignedOut();
  }
});

renderAll();
switchView("map");
