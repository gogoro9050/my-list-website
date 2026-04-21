
const TOKEN = import.meta.env.VITE_API_KEY;

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
  apiKey: TOKEN,
  authDomain: "jayden-4a795.firebaseapp.com",
  projectId: "jayden-4a795",
  storageBucket: "jayden-4a795.firebasestorage.app",
  messagingSenderId: "686638306908",
  appId: "1:686638306908:web:68d53d8839c8ebbb42b899",
  measurementId: "G-1W3ZZSJL5L"
};

const MAX_IMAGE_BYTES = 600 * 1024;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authStatusText = document.getElementById("authStatusText");
const featureButtons = document.querySelectorAll(".feature-btn");
const featurePanels = {
  records: document.getElementById("recordsFeature"),
  checklist: document.getElementById("checklistFeature")
};
const summaryLabel = document.getElementById("summaryLabel");
const summaryValue = document.getElementById("summaryValue");
const secondaryLabel = document.getElementById("secondaryLabel");
const secondaryValue = document.getElementById("secondaryValue");
const modeValue = document.getElementById("modeValue");

const recordForm = document.getElementById("recordForm");
const recordPhotoInput = document.getElementById("recordPhoto");
const recordFormTitle = document.getElementById("recordFormTitle");
const editingRecordId = document.getElementById("editingRecordId");
const recordSubmitBtn = document.getElementById("recordSubmitBtn");
const cancelRecordEditBtn = document.getElementById("cancelRecordEditBtn");
const exportRecordsBtn = document.getElementById("exportRecordsBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const selectedCount = document.getElementById("selectedCount");
const mapView = document.getElementById("mapView");
const calendarView = document.getElementById("calendarView");
const recordListView = document.getElementById("recordListView");
const recordToggleButtons = document.querySelectorAll(".toggle-btn");
const recordTemplate = document.getElementById("recordCardTemplate");

const checklistForm = document.getElementById("checklistForm");
const checklistFormTitle = document.getElementById("checklistFormTitle");
const editingChecklistId = document.getElementById("editingChecklistId");
const checklistTitleInput = document.getElementById("checklistTitle");
const checklistNoteInput = document.getElementById("checklistNote");
const checklistPhotoInput = document.getElementById("checklistPhoto");
const checklistSubmitBtn = document.getElementById("checklistSubmitBtn");
const cancelChecklistEditBtn = document.getElementById("cancelChecklistEditBtn");
const exportChecklistBtn = document.getElementById("exportChecklistBtn");
const checklistListView = document.getElementById("checklistListView");
const checklistTemplate = document.getElementById("checklistCardTemplate");

let currentUser = null;
let activeFeature = "records";
let currentRecordView = "map";
let currentCalendarMonth = "";
let recordSelections = new Set();
let records = [];
let checklistItems = [];

function zh(text) {
  return text;
}

function getRecordsCollection(userId) {
  return collection(db, "users", userId, "records");
}

function getChecklistCollection(userId) {
  return collection(db, "users", userId, "checklistItems");
}

function setFormsDisabled(disabled) {
  const controls = document.querySelectorAll("input, textarea, button");
  controls.forEach((control) => {
    if (control === signInBtn || control === signOutBtn) {
      return;
    }
    control.disabled = disabled;
  });
}

function resetSignedOutState() {
  records = [];
  checklistItems = [];
  recordSelections.clear();
  resetRecordEditing();
  resetChecklistEditing();
  renderAll();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("\u7167\u7247\u8acb\u63a7\u5236\u5728 600KB \u4ee5\u5167\uff0c\u9019\u6a23\u8f03\u9069\u5408\u76f4\u63a5\u5b58\u5230\u96f2\u7aef\u7d00\u9304\u88e1\u3002"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error("\u7167\u7247\u8b80\u53d6\u5931\u6557\uff0c\u8acb\u91cd\u65b0\u9078\u64c7\u4e00\u5f35\u5716\u7247\u3002"));
    reader.readAsDataURL(file);
  });
}

async function loadAllData(userId) {
  const [recordSnapshot, checklistSnapshot] = await Promise.all([
    getDocs(query(getRecordsCollection(userId), orderBy("createdAt", "desc"))),
    getDocs(query(getChecklistCollection(userId), orderBy("sortOrder", "asc")))
  ]);

  records = recordSnapshot.docs.map((recordDoc) => ({
    id: recordDoc.id,
    ...recordDoc.data()
  }));
  checklistItems = checklistSnapshot.docs.map((itemDoc) => ({
    id: itemDoc.id,
    ...itemDoc.data()
  }));

  recordSelections = new Set([...recordSelections].filter((id) => records.some((record) => record.id === id)));
  syncCalendarMonth();
  renderAll();
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

function getAvailableRecordMonths() {
  return [...new Set(records.map((record) => record.date.slice(0, 7)))]
    .filter(Boolean)
    .sort();
}

function syncCalendarMonth() {
  const months = getAvailableRecordMonths();

  if (!months.length) {
    currentCalendarMonth = "";
    return;
  }

  if (!currentCalendarMonth || !months.includes(currentCalendarMonth)) {
    currentCalendarMonth = months[months.length - 1];
  }
}

function changeCalendarMonth(direction) {
  const months = getAvailableRecordMonths();
  if (!months.length) {
    return;
  }

  const currentIndex = months.indexOf(currentCalendarMonth);
  const nextIndex = currentIndex + direction;

  if (nextIndex < 0 || nextIndex >= months.length) {
    return;
  }

  currentCalendarMonth = months[nextIndex];
  renderCalendarView();
}

function getMapQuery(record) {
  return (record.mapQuery || `${record.stadium} ${record.location}`).trim();
}

function getMapUrl(record) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getMapQuery(record))}`;
}

function updateSidebarSummary() {
  if (activeFeature === "records") {
    const stadiums = new Set(records.map((record) => record.stadium.trim()));
    const modeLabels = {
      map: zh("\u5730\u5716"),
      calendar: zh("\u65e5\u66c6"),
      list: zh("\u5217\u8868")
    };

    summaryLabel.textContent = zh("\u7403\u8cfd\u5834\u6b21");
    summaryValue.textContent = String(records.length);
    secondaryLabel.textContent = zh("\u4e0d\u540c\u7403\u5834");
    secondaryValue.textContent = String(stadiums.size);
    modeValue.textContent = modeLabels[currentRecordView];
  } else {
    summaryLabel.textContent = zh("\u6e05\u55ae\u9805\u76ee");
    summaryValue.textContent = String(checklistItems.length);
    secondaryLabel.textContent = zh("\u6709\u5716\u7247\u9805\u76ee");
    secondaryValue.textContent = String(checklistItems.filter((item) => item.photoData).length);
    modeValue.textContent = zh("\u6e05\u55ae");
  }
}

function switchFeature(featureName) {
  activeFeature = featureName;

  Object.entries(featurePanels).forEach(([name, panel]) => {
    panel.classList.toggle("active", name === featureName);
    panel.classList.toggle("hidden", name !== featureName);
  });

  featureButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.feature === featureName);
  });

  updateSidebarSummary();
}

function switchRecordView(nextView) {
  currentRecordView = nextView;
  mapView.classList.toggle("hidden", nextView !== "map");
  calendarView.classList.toggle("hidden", nextView !== "calendar");
  recordListView.classList.toggle("hidden", nextView !== "list");

  recordToggleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === nextView);
  });

  updateSidebarSummary();
}

function renderMapView() {
  mapView.innerHTML = "";

  if (!records.length) {
    mapView.innerHTML = `<div class="empty-state">${zh("\u65b0\u589e\u8a18\u9304\u5f8c\uff0c\u9019\u88e1\u6703\u51fa\u73fe\u53ef\u4ee5\u9ede\u9032 Google Maps \u7684\u7403\u5834\u5361\u7247\u3002")}</div>`;
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
      <div class="map-meta">${zh("\u9ede\u5361\u7247\u53ef\u76f4\u63a5\u6253\u958b\u771f\u5be6\u5730\u5716")}</div>
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

  syncCalendarMonth();

  const availableMonths = getAvailableRecordMonths();
  const currentMonthIndex = availableMonths.indexOf(currentCalendarMonth);
  const monthRecords = records.filter((record) => record.date.slice(0, 7) === currentCalendarMonth);
  const [yearString, monthString] = currentCalendarMonth.split("-");
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

  const title = document.createElement("div");
  title.className = "calendar-month-title";
  title.textContent = formatMonthLabel(`${currentCalendarMonth}-01`);

  const nav = document.createElement("div");
  nav.className = "calendar-nav";

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "calendar-nav-btn";
  prevButton.textContent = "←";
  prevButton.disabled = currentMonthIndex <= 0;
  prevButton.addEventListener("click", () => changeCalendarMonth(-1));

  const hint = document.createElement("span");
  hint.textContent = zh("\u6709\u8a18\u9304\u7684\u65e5\u5b50\u6703\u767c\u4eae");

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "calendar-nav-btn";
  nextButton.textContent = "→";
  nextButton.disabled = currentMonthIndex >= availableMonths.length - 1;
  nextButton.addEventListener("click", () => changeCalendarMonth(1));

  nav.appendChild(prevButton);
  nav.appendChild(hint);
  nav.appendChild(nextButton);
  header.appendChild(title);
  header.appendChild(nav);

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

  for (let fillerIndex = 0; fillerIndex < startDay; fillerIndex += 1) {
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
}

function renderRecordListView() {
  recordListView.innerHTML = "";

  if (!records.length) {
    recordListView.innerHTML = `<div class="empty-state">${zh("\u9084\u6c92\u6709\u4efb\u4f55\u770b\u7403\u8a18\u9304\uff0c\u5148\u8a18\u4e0b\u7b2c\u4e00\u5834\u5427\u3002")}</div>`;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "records-list";

  records.forEach((record, index) => {
    const fragment = recordTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".record-card");
    const image = fragment.querySelector(".record-image");
    const imageFallback = fragment.querySelector(".record-image-fallback");
    const checkbox = fragment.querySelector(".record-select-input");
    const mapLink = fragment.querySelector(".record-map-link");

    checkbox.checked = recordSelections.has(record.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        recordSelections.add(record.id);
      } else {
        recordSelections.delete(record.id);
      }
      selectedCount.textContent = String(recordSelections.size);
    });

    fragment.querySelector(".record-date").textContent = formatDate(record.date);
    fragment.querySelector(".record-location").textContent = record.location;
    fragment.querySelector(".record-title").textContent = record.title;
    fragment.querySelector(".record-stadium").textContent = `${zh("\u7403\u5834\uff1a")}${record.stadium}`;
    fragment.querySelector(".record-note").textContent = record.note || zh("\u6c92\u6709\u5099\u8a3b");

    mapLink.href = getMapUrl(record);
    mapLink.textContent = zh("\u958b\u555f\u771f\u5be6\u5730\u5716");

    if (record.photoData) {
      image.src = record.photoData;
      image.classList.add("show");
      imageFallback.style.display = "none";
    }

    card.querySelector('[data-action="up"]').addEventListener("click", () => moveRecord(index, -1));
    card.querySelector('[data-action="down"]').addEventListener("click", () => moveRecord(index, 1));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => startRecordEdit(record));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRecord(record.id));

    wrapper.appendChild(fragment);
  });

  recordListView.appendChild(wrapper);
  selectedCount.textContent = String(recordSelections.size);
}

function resetRecordEditing() {
  editingRecordId.value = "";
  recordFormTitle.textContent = zh("\u65b0\u589e\u7403\u8cfd\u7d00\u9304");
  recordSubmitBtn.textContent = zh("\u65b0\u589e\u7d00\u9304");
  cancelRecordEditBtn.classList.add("hidden");
  recordForm.reset();
}

function startRecordEdit(record) {
  switchFeature("records");
  switchRecordView("list");
  editingRecordId.value = record.id;
  recordFormTitle.textContent = zh("\u7de8\u8f2f\u7403\u8cfd\u7d00\u9304");
  recordSubmitBtn.textContent = zh("\u66f4\u65b0\u7d00\u9304");
  cancelRecordEditBtn.classList.remove("hidden");
  document.getElementById("title").value = record.title;
  document.getElementById("date").value = record.date;
  document.getElementById("stadium").value = record.stadium;
  document.getElementById("location").value = record.location;
  document.getElementById("mapQuery").value = record.mapQuery || "";
  document.getElementById("note").value = record.note || "";
  recordForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetChecklistEditing() {
  editingChecklistId.value = "";
  checklistFormTitle.textContent = zh("\u65b0\u589e\u6e05\u55ae\u9805\u76ee");
  checklistSubmitBtn.textContent = zh("\u65b0\u589e\u9805\u76ee");
  cancelChecklistEditBtn.classList.add("hidden");
  checklistForm.reset();
}

function startChecklistEdit(item) {
  switchFeature("checklist");
  editingChecklistId.value = item.id;
  checklistFormTitle.textContent = zh("\u7de8\u8f2f\u6e05\u55ae\u9805\u76ee");
  checklistSubmitBtn.textContent = zh("\u66f4\u65b0\u9805\u76ee");
  cancelChecklistEditBtn.classList.remove("hidden");
  checklistTitleInput.value = item.title;
  checklistNoteInput.value = item.note || "";
  checklistForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderChecklistView() {
  checklistListView.innerHTML = "";

  if (!checklistItems.length) {
    checklistListView.innerHTML = `<div class="empty-state">${zh("\u9084\u6c92\u6709\u6e05\u55ae\u9805\u76ee\uff0c\u5148\u65b0\u589e\u4e00\u7b46\u5427\u3002")}</div>`;
    return;
  }

  checklistItems.forEach((item, index) => {
    const fragment = checklistTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".checklist-card");
    const image = fragment.querySelector(".checklist-image");
    const imageFallback = fragment.querySelector(".record-image-fallback");

    fragment.querySelector(".checklist-title").textContent = item.title;
    fragment.querySelector(".checklist-note").textContent = item.note || zh("\u6c92\u6709\u5099\u8a3b");

    if (item.photoData) {
      image.src = item.photoData;
      image.classList.add("show");
      imageFallback.style.display = "none";
    }

    card.querySelector('[data-action="up"]').addEventListener("click", () => moveChecklistItem(index, -1));
    card.querySelector('[data-action="down"]').addEventListener("click", () => moveChecklistItem(index, 1));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => startChecklistEdit(item));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteChecklistItem(item.id));

    checklistListView.appendChild(fragment);
  });
}

function renderAll() {
  renderMapView();
  renderCalendarView();
  renderRecordListView();
  renderChecklistView();
  updateSidebarSummary();
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

  await loadAllData(currentUser.uid);
}

async function deleteRecord(recordId) {
  if (!currentUser) return;

  recordSelections.delete(recordId);
  await deleteDoc(doc(db, "users", currentUser.uid, "records", recordId));
  await loadAllData(currentUser.uid);
}

async function moveChecklistItem(index, direction) {
  if (!currentUser) return;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= checklistItems.length) {
    return;
  }

  const currentItem = checklistItems[index];
  const targetItem = checklistItems[targetIndex];

  await Promise.all([
    updateDoc(doc(db, "users", currentUser.uid, "checklistItems", currentItem.id), {
      sortOrder: targetItem.sortOrder
    }),
    updateDoc(doc(db, "users", currentUser.uid, "checklistItems", targetItem.id), {
      sortOrder: currentItem.sortOrder
    })
  ]);

  await loadAllData(currentUser.uid);
}

async function deleteChecklistItem(itemId) {
  if (!currentUser) return;

  await deleteDoc(doc(db, "users", currentUser.uid, "checklistItems", itemId));
  if (editingChecklistId.value === itemId) {
    resetChecklistEditing();
  }
  await loadAllData(currentUser.uid);
}

async function handleRecordSubmit(event) {
  event.preventDefault();

  if (!currentUser) {
    alert(zh("\u8acb\u5148\u767b\u5165 Google \u5e33\u865f\u3002"));
    return;
  }

  const currentEditingId = editingRecordId.value;
  const editingRecord = currentEditingId ? records.find((record) => record.id === currentEditingId) : null;

  const photoData = await readFileAsDataUrl(recordPhotoInput.files[0]).catch((error) => {
    alert(error.message);
    return null;
  });

  if (photoData === null) {
    return;
  }

  const formData = new FormData(recordForm);
  const payload = {
    title: formData.get("title").toString().trim(),
    date: formData.get("date").toString(),
    stadium: formData.get("stadium").toString().trim(),
    location: formData.get("location").toString().trim(),
    mapQuery: formData.get("mapQuery").toString().trim(),
    note: formData.get("note").toString().trim(),
    photoData: photoData || editingRecord?.photoData || "",
    createdAt: editingRecord?.createdAt || Date.now()
  };

  if (!payload.title || !payload.date || !payload.stadium || !payload.location) {
    alert(zh("\u8acb\u5148\u586b\u5b8c\u6a19\u984c\u3001\u65e5\u671f\u3001\u7403\u5834\u548c\u57ce\u5e02\u3002"));
    return;
  }

  if (editingRecord) {
    await updateDoc(doc(db, "users", currentUser.uid, "records", editingRecord.id), payload);
  } else {
    await addDoc(getRecordsCollection(currentUser.uid), payload);
  }

  resetRecordEditing();
  await loadAllData(currentUser.uid);
}

async function handleChecklistSubmit(event) {
  event.preventDefault();

  if (!currentUser) {
    alert(zh("\u8acb\u5148\u767b\u5165 Google \u5e33\u865f\u3002"));
    return;
  }

  const currentEditingId = editingChecklistId.value;
  const editingItem = currentEditingId ? checklistItems.find((item) => item.id === currentEditingId) : null;

  const newPhotoData = await readFileAsDataUrl(checklistPhotoInput.files[0]).catch((error) => {
    alert(error.message);
    return null;
  });

  if (newPhotoData === null) {
    return;
  }

  const payload = {
    title: checklistTitleInput.value.trim(),
    note: checklistNoteInput.value.trim(),
    photoData: newPhotoData || editingItem?.photoData || ""
  };

  if (!payload.title) {
    alert(zh("\u8acb\u5148\u586b\u5beb\u6e05\u55ae\u9805\u76ee\u540d\u7a31\u3002"));
    return;
  }

  if (editingItem) {
    await updateDoc(doc(db, "users", currentUser.uid, "checklistItems", editingItem.id), payload);
  } else {
    const lastSortOrder = checklistItems.length ? checklistItems[checklistItems.length - 1].sortOrder : 0;
    await addDoc(getChecklistCollection(currentUser.uid), {
      ...payload,
      sortOrder: lastSortOrder + 1,
      createdAt: Date.now()
    });
  }

  resetChecklistEditing();
  await loadAllData(currentUser.uid);
}

function selectAllRecords() {
  recordSelections = new Set(records.map((record) => record.id));
  renderRecordListView();
}

function clearRecordSelections() {
  recordSelections.clear();
  renderRecordListView();
}

function createRecordsPdf(recordsToExport) {
  const cardsMarkup = recordsToExport.map((record) => `
    <section style="page-break-inside: avoid; border: 1px solid #ddd; border-radius: 18px; padding: 18px; margin-bottom: 18px;">
      <h2 style="margin: 0 0 8px; color: #d55b00;">${record.title}</h2>
      <p style="margin: 0 0 8px;"><strong>${zh("\u65e5\u671f\uff1a")}</strong>${formatDate(record.date)}</p>
      <p style="margin: 0 0 8px;"><strong>${zh("\u7403\u5834\uff1a")}</strong>${record.stadium}</p>
      <p style="margin: 0 0 8px;"><strong>${zh("\u57ce\u5e02\uff1a")}</strong>${record.location}</p>
      <p style="margin: 0 0 8px;"><strong>${zh("\u5099\u8a3b\uff1a")}</strong>${record.note || zh("\u7121")}</p>
      ${record.photoData ? `<img src="${record.photoData}" alt="photo" style="max-width: 100%; border-radius: 14px; margin-top: 10px;" />` : ""}
    </section>
  `).join("");

  return createPrintHtml(zh("\u770b\u7403\u7d00\u9304\u532f\u51fa"), cardsMarkup);
}

function createChecklistPdf(itemsToExport) {
  const cardsMarkup = itemsToExport.map((item, index) => `
    <section style="page-break-inside: avoid; border: 1px solid #ddd; border-radius: 18px; padding: 18px; margin-bottom: 18px;">
      <h2 style="margin: 0 0 8px; color: #d55b00;">${index + 1}. ${item.title}</h2>
      <p style="margin: 0 0 8px;"><strong>${zh("\u5099\u8a3b\uff1a")}</strong>${item.note || zh("\u7121")}</p>
      ${item.photoData ? `<img src="${item.photoData}" alt="photo" style="max-width: 100%; border-radius: 14px; margin-top: 10px;" />` : ""}
    </section>
  `).join("");

  return createPrintHtml(zh("\u6e05\u55ae\u532f\u51fa"), cardsMarkup);
}

function createPrintHtml(title, cardsMarkup) {
  return `
    <!DOCTYPE html>
    <html lang="zh-Hant">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <style>
        body { font-family: "Microsoft JhengHei", sans-serif; padding: 24px; color: #222; }
        h1 { color: #ff6b00; margin-bottom: 10px; }
        .hint { color: #666; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p class="hint">${zh("\u958b\u555f\u5f8c\u8acb\u5728\u5217\u5370\u8996\u7a97\u9078\u64c7\u300c\u5132\u5b58\u70ba PDF\u300d\u3002")}</p>
      ${cardsMarkup}
      <script>
        window.onload = () => { window.print(); };
      <\/script>
    </body>
    </html>
  `;
}

function openPrintWindow(html) {
  const printWindow = window.open("", "_blank", "width=980,height=720");
  if (!printWindow) {
    alert(zh("\u700f\u89bd\u5668\u64cb\u4e0b\u4e86\u65b0\u8996\u7a97\uff0c\u8acb\u5141\u8a31\u5f8c\u518d\u8a66\u4e00\u6b21\u3002"));
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function exportSelectedRecords() {
  const selectedRecords = records.filter((record) => recordSelections.has(record.id));
  if (!selectedRecords.length) {
    alert(zh("\u8acb\u5148\u52fe\u9078\u60f3\u532f\u51fa\u7684\u6bd4\u8cfd\u3002"));
    return;
  }
  openPrintWindow(createRecordsPdf(selectedRecords));
}

function exportChecklist() {
  if (!checklistItems.length) {
    alert(zh("\u76ee\u524d\u6c92\u6709\u53ef\u532f\u51fa\u7684\u6e05\u55ae\u9805\u76ee\u3002"));
    return;
  }
  openPrintWindow(createChecklistPdf(checklistItems));
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

recordForm.addEventListener("submit", handleRecordSubmit);
checklistForm.addEventListener("submit", handleChecklistSubmit);
exportRecordsBtn.addEventListener("click", exportSelectedRecords);
exportChecklistBtn.addEventListener("click", exportChecklist);
selectAllBtn.addEventListener("click", selectAllRecords);
clearSelectionBtn.addEventListener("click", clearRecordSelections);
cancelChecklistEditBtn.addEventListener("click", resetChecklistEditing);
cancelRecordEditBtn.addEventListener("click", resetRecordEditing);
signInBtn.addEventListener("click", handleSignIn);
signOutBtn.addEventListener("click", handleSignOut);

featureButtons.forEach((button) => {
  button.addEventListener("click", () => switchFeature(button.dataset.feature));
});

recordToggleButtons.forEach((button) => {
  button.addEventListener("click", () => switchRecordView(button.dataset.view));
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (user) {
    authStatusText.textContent = `${zh("\u5df2\u767b\u5165\uff1a")}${user.displayName || user.email}`;
    signInBtn.classList.add("hidden");
    signOutBtn.classList.remove("hidden");
    setFormsDisabled(false);
    await loadAllData(user.uid);
  } else {
    authStatusText.textContent = zh("\u8acb\u5148\u7528 Google \u767b\u5165\uff0c\u7403\u8cfd\u7d00\u9304\u548c\u6e05\u55ae\u6703\u5404\u81ea\u540c\u6b65\u5230\u4f60\u7684 Firebase \u96f2\u7aef\u5e33\u865f\u4e0b\u3002");
    signInBtn.classList.remove("hidden");
    signOutBtn.classList.add("hidden");
    setFormsDisabled(true);
    resetSignedOutState();
  }
});

renderAll();
switchFeature("records");
switchRecordView("map");
