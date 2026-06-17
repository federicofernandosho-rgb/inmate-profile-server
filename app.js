const SESSION_KEY = "inmate-profile-api-token";
const LEGACY_RECORDS_KEY = "intel-inmate-profileing-records";

const emptyRecord = () => ({
  inmateId: "",
  firstName: "",
  middleName: "",
  lastName: "",
  alias: "",
  dob: "",
  age: "",
  address: "",
  affiliation: "",
  comment: "",
  gangAffiliation: "",
  personName: "",
  inPrison: false,
  admissionDate: "",
  dischargeDate: "",
  statusHistory: [],
  images: {
    frontFace: "",
    rightFace: "",
    leftFace: "",
    tattoos: []
  }
});

let records = [];
let currentIndex = 0;
let isNewRecord = false;
let currentUser = null;
let authToken = sessionStorage.getItem(SESSION_KEY) || "";

const loginShell = document.querySelector("#loginShell");
const appShell = document.querySelector("#appShell");
const loginForm = document.querySelector("#loginForm");
const firstUserForm = document.querySelector("#firstUserForm");
const loginIntro = document.querySelector("#loginIntro");
const loginMessage = document.querySelector("#loginMessage");
const sessionStatus = document.querySelector("#sessionStatus");
const manageUsersButton = document.querySelector("#manageUsers");
const logoutButton = document.querySelector("#logoutButton");
const message = document.querySelector("#message");
const recordStatus = document.querySelector("#recordStatus");
const fields = {
  inmateId: document.querySelector("#inmateId"),
  firstName: document.querySelector("#firstName"),
  middleName: document.querySelector("#middleName"),
  lastName: document.querySelector("#lastName"),
  alias: document.querySelector("#alias"),
  dob: document.querySelector("#dob"),
  age: document.querySelector("#age"),
  address: document.querySelector("#address"),
  affiliation: document.querySelector("#affiliation"),
  comment: document.querySelector("#comment"),
  incarcerationIn: document.querySelector("#incarcerationIn"),
  incarcerationOut: document.querySelector("#incarcerationOut"),
  statusDate: document.querySelector("#statusDate")
};

const searchInput = document.querySelector("#searchInput");
const searchButton = document.querySelector("#searchButton");

// Pagination & filter state
let pageSize = 10;
let currentPage = 1;
let filteredRecords = [];
let activeFilters = { status: "all", affiliation: "", gang: "", dateFrom: "", dateTo: "" };

const intelDialog = document.querySelector("#intelDialog");
const mainHistoryTimeline = document.querySelector("#mainHistoryTimeline");
const mainPreview = document.querySelector("#mainPreview");
const mainPreviewText = document.querySelector("#mainPreviewText");
const frontFacePreview = document.querySelector("#frontFacePreview");
const rightFacePreview = document.querySelector("#rightFacePreview");
const leftFacePreview = document.querySelector("#leftFacePreview");
const tattooList = document.querySelector("#tattooList");
const reportTemplate = document.querySelector("#reportTemplate");
const usersDialog = document.querySelector("#usersDialog");
const userList = document.querySelector("#userList");
const userMessage = document.querySelector("#userMessage");
const admissionDialog = document.querySelector("#admissionDialog");
const dischargeDialog = document.querySelector("#dischargeDialog");
const admissionForm = document.querySelector("#admissionForm");
const dischargeForm = document.querySelector("#dischargeForm");
const historyDialog = document.querySelector("#historyDialog");
let pendingStatusEvent = null;

// Tattoo Zoom State Management
let currentZoomLevel = 1;
const ZOOM_STEP = 0.2;
const MAX_ZOOM = 3;
const MIN_ZOOM = 0.5;

// Initialize Core Operational Hooks & Event Listeners
loginForm.addEventListener("submit", handleLogin);
firstUserForm.addEventListener("submit", handleFirstUserCreate);
manageUsersButton.addEventListener("click", openUsersModal);
logoutButton.addEventListener("click", logout);
document.querySelector("#closeUsersModal").addEventListener("click", () => usersDialog.close());
document.querySelector("#createUserForm").addEventListener("submit", handleCreateUser);
document.querySelector("#previousRecord").addEventListener("click", showPreviousRecord);
document.querySelector("#nextRecord").addEventListener("click", showNextRecord);
document.querySelector("#newRecord").addEventListener("click", createNewRecord);
document.querySelector("#saveRecord").addEventListener("click", saveNewRecord);
document.querySelector("#cancelRecord").addEventListener("click", cancelNewRecord);
document.querySelector("#updateRecord").addEventListener("click", updateCurrentRecord);
document.querySelector("#deleteRecord").addEventListener("click", deleteRecord);
document.querySelector("#generatePdf").addEventListener("click", generatePdfReport);
document.querySelector("#viewHistory").addEventListener("click", () => {
  const record = records[currentIndex];
  renderMainHistoryTimeline(record ? (record.statusHistory || []) : []);
  historyDialog.showModal();
});
document.querySelector("#closeHistoryModal").addEventListener("click", () => historyDialog.close());
document.querySelector("#openIntelModal").addEventListener("click", openIntelModal);
document.querySelector("#closeModal").addEventListener("click", () => intelDialog.close());

// Dark mode
document.querySelector("#darkModeToggle").addEventListener("click", toggleDarkMode);
if (localStorage.getItem("darkMode") === "1") applyDarkMode(true);

// Export CSV
document.querySelector("#exportCsvButton").addEventListener("click", exportCsv);

// Audit log
document.querySelector("#auditLogButton").addEventListener("click", openAuditLog);
document.querySelector("#closeAuditModal").addEventListener("click", () => document.querySelector("#auditDialog").close());
document.querySelector("#auditApplyFilter").addEventListener("click", renderAuditList);

// Filters
document.querySelector("#applyFilter").addEventListener("click", applyRecordFilters);
document.querySelector("#clearFilter").addEventListener("click", clearRecordFilters);

document.querySelector("#saveIntel").addEventListener("click", saveIntelDetails);
document.querySelectorAll(".remove-image").forEach(button => {
  button.addEventListener("click", () => removeFaceImage(button.dataset.imageKey));
});
document.querySelector("#frontFaceUpload").addEventListener("change", event => setImage(event, "frontFace"));
fields.incarcerationIn.addEventListener("click", handleIncarcerationClick);
fields.incarcerationOut.addEventListener("click", handleIncarcerationClick);

function handleIncarcerationClick(e) {
  if (!canEdit()) {
    e.preventDefault();
    return;
  }

  e.preventDefault();
  const targetId = e.target.id;
  const rec = records[currentIndex] || emptyRecord();

  if (targetId === "incarcerationIn") {
    admissionForm.reset();
    if (rec.inPrison) {
      document.querySelector("#modalAdmissionDate").value = rec.admissionDate || "";
      const lastEvent = rec.statusHistory && rec.statusHistory.slice().reverse().find(ev => ev.type === "Admitted");
      if (lastEvent && lastEvent.charge) {
        document.querySelector("#modalAdmissionCharge").value = lastEvent.charge;
      }
    }
    admissionDialog.showModal();
  } else {
    dischargeForm.reset();
    if (!rec.inPrison) {
      document.querySelector("#modalDischargeDate").value = rec.dischargeDate || "";
      const lastEvent = rec.statusHistory && rec.statusHistory.slice().reverse().find(ev => ev.type === "Discharged");
      if (lastEvent) {
        if (lastEvent.charge) document.querySelector("#modalDischargeCharge").value = lastEvent.charge;
        if (lastEvent.dischargeStatus) document.querySelector("#modalDischargeStatus").value = lastEvent.dischargeStatus;
      }
    }
    dischargeDialog.showModal();
  }
}

document.querySelector("#closeAdmissionModal").addEventListener("click", () => admissionDialog.close());
document.querySelector("#admissionCancelBtn").addEventListener("click", () => admissionDialog.close());
admissionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  fields.incarcerationIn.checked = true;
  fields.incarcerationOut.checked = false;

  pendingStatusEvent = {
    type: "Admitted",
    date: document.querySelector("#modalAdmissionDate").value,
    charge: document.querySelector("#modalAdmissionCharge").value,
    timestamp: new Date().toISOString(),
    username: currentUser?.username || "system"
  };

  fields.statusDate.value = pendingStatusEvent.date;
  updateStatusDateVisibility();
  admissionDialog.close();
});

document.querySelector("#closeDischargeModal").addEventListener("click", () => document.querySelector("#dischargeDialog").close());
document.querySelector("#dischargeCancelBtn").addEventListener("click", () => document.querySelector("#dischargeDialog").close());
dischargeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  fields.incarcerationIn.checked = false;
  fields.incarcerationOut.checked = true;

  pendingStatusEvent = {
    type: "Discharged",
    date: document.querySelector("#modalDischargeDate").value,
    charge: document.querySelector("#modalDischargeCharge").value,
    dischargeStatus: document.querySelector("#modalDischargeStatus").value,
    timestamp: new Date().toISOString(),
    username: currentUser?.username || "system"
  };

  fields.statusDate.value = pendingStatusEvent.date;
  updateStatusDateVisibility();
  dischargeDialog.close();
});

document.querySelector("#rightFaceUpload").addEventListener("change", event => setImage(event, "rightFace"));
document.querySelector("#leftFaceUpload").addEventListener("change", event => setImage(event, "leftFace"));
document.querySelector("#tattooUpload").addEventListener("change", addTattooImages);
document.querySelector("#tattooModalClose").addEventListener("click", closeTattooModal);
document.querySelector("#zoomInBtn").addEventListener("click", () => zoomTattoo("in"));
document.querySelector("#zoomOutBtn").addEventListener("click", () => zoomTattoo("out"));
document.querySelector("#zoomResetBtn").addEventListener("click", resetTattooZoom);
document.querySelector("#tattooModal").addEventListener("click", (e) => {
  if (e.target.id === "tattooModal") closeTattooModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.getElementById("tattooModal").open) {
      closeTattooModal();
    } else if (isNewRecord) {
      cancelNewRecord();
    }
  }
});

searchButton.addEventListener("click", handleSearch);
searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSearch();
  }
});
fields.dob.addEventListener("change", setAgeFromDob);
fields.dob.addEventListener("input", setAgeFromDob);

window.addEventListener("afterprint", () => {
  document.body.classList.remove("printing");
  reportTemplate.innerHTML = "";
  const dynamicStyle = document.getElementById("dynamic-print-style");
  if (dynamicStyle) dynamicStyle.remove();
});

// Photo hover popover hook layout configurations
const photoStrip = document.querySelector(".photo-strip");
const photoPopover = document.querySelector(".photo-views-popover");
if (photoStrip && photoPopover) {
  photoStrip.addEventListener("mouseenter", () => {
    if (!document.querySelector(".photo-frame.has-no-photos")) {
      photoPopover.classList.add("popover-visible");
    }
  });
  photoStrip.addEventListener("mouseleave", () => {
    photoPopover.classList.remove("popover-visible");
  });
}

initializeAuth();

// ── CORE BACKEND API CORE INTERFACES ──────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const isAuthRequired = options.auth !== false;
  const headers = { ...options.headers };

  if (isAuthRequired && authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.message || `HTTP Request failed with status code ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function initializeAuth() {
  try {
    const bootstrap = await apiFetch("/api/bootstrap", { auth: false });

    if (!bootstrap.hasUsers) {
      showFirstUser();
      return;
    }

    if (authToken) {
      const session = await apiFetch("/api/me");
      currentUser = session.user;
      await showApp();
      return;
    }

    showLogin();
  } catch (error) {
    if (error.status === 401) {
      showLogin();
      return;
    }
    loginMessage.textContent = `Backend unavailable: ${error.message}`;
    loginShell.classList.remove("hidden");
    appShell.classList.add("hidden");
  }
}

function showFirstUser() {
  loginForm.classList.add("hidden");
  firstUserForm.classList.remove("hidden");
  loginIntro.textContent = "Create the first super admin user.";
  loginShell.classList.remove("hidden");
  appShell.classList.add("hidden");
}

function showLogin() {
  loginForm.classList.remove("hidden");
  firstUserForm.classList.add("hidden");
  loginIntro.textContent = "Sign in to continue.";
  loginShell.classList.remove("hidden");
  appShell.classList.add("hidden");
  currentUser = null;
}

async function showApp() {
  loginShell.classList.add("hidden");
  appShell.classList.remove("hidden");
  sessionStatus.textContent = `${currentUser.username} - ${roleLabel(currentUser.role)}`;
  manageUsersButton.classList.toggle("hidden", !canManageUsers());
  document.querySelector("#deleteRecord").classList.toggle("hidden", !canManageUsers());
  document.querySelector("#auditLogButton").classList.toggle("hidden", !canManageUsers());
  applyAccessMode();
  await loadRecordsFromBackend();
  await migrateLegacyRecordsIfNeeded();
  renderCurrentRecord();
}

async function handleLogin(event) {
  event.preventDefault();
  loginMessage.textContent = "";

  try {
    const result = await apiFetch("/api/login", {
      auth: false,
      method: "POST",
      body: {
        username: document.querySelector("#loginUsername").value.trim(),
        password: document.querySelector("#loginPassword").value
      }
    });
    setSession(result);
    loginForm.reset();
    await showApp();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
}

async function handleFirstUserCreate(event) {
  event.preventDefault();
  loginMessage.textContent = "";

  try {
    const result = await apiFetch("/api/users/first", {
      auth: false,
      method: "POST",
      body: {
        username: document.querySelector("#firstUsername").value.trim(),
        password: document.querySelector("#firstPassword").value
      }
    });
    setSession(result);
    firstUserForm.reset();
    await showApp();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
}

async function handleCreateUser(event) {
  event.preventDefault();
  if (!canManageUsers()) return;
  userMessage.textContent = "";

  try {
    await apiFetch("/api/users", {
      method: "POST",
      body: {
        username: document.querySelector("#newUsername").value.trim(),
        password: document.querySelector("#newPassword").value,
        role: document.querySelector("#newUserRole").value
      }
    });
    document.querySelector("#createUserForm").reset();
    userMessage.textContent = "User created.";
    await renderUserList();
  } catch (error) {
    userMessage.textContent = error.message;
  }
}

async function openUsersModal() {
  if (!canManageUsers()) return;
  userMessage.textContent = "";
  await renderUserList();
  usersDialog.showModal();
}

async function renderUserList() {
  const result = await apiFetch("/api/users");
  userList.innerHTML = "";

  result.users.forEach(user => {
    const row = document.createElement("div");
    row.className = "user-row";
    const disabled = user.id === currentUser.id && user.role === "admin" ? "disabled" : "";
    row.innerHTML = `
      <strong>${escapeHtml(user.username)}</strong>
      <label class="role-editor">
        <span>Role</span>
        <select data-user-role="${escapeHtml(user.id)}" ${disabled}>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>Super Admin</option>
          <option value="entry" ${user.role === "entry" ? "selected" : ""}>Data Entry</option>
          <option value="readonly" ${user.role === "readonly" ? "selected" : ""}>Read Only</option>
        </select>
      </label>
    `;
    userList.append(row);
  });

  userList.querySelectorAll("[data-user-role]").forEach(select => {
    select.addEventListener("change", () => updateUserRole(select.dataset.userRole, select.value));
  });
}

async function updateUserRole(userId, role) {
  if (!canManageUsers()) return;
  userMessage.textContent = "";

  try {
    await apiFetch(`/api/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      body: { role }
    });
    userMessage.textContent = "User role updated.";
    await renderUserList();
  } catch (error) {
    userMessage.textContent = error.message;
    await renderUserList();
  }
}

function setSession(result) {
  authToken = result.token;
  currentUser = result.user;
  sessionStorage.setItem(SESSION_KEY, authToken);
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  authToken = "";
  currentUser = null;
  records = [];
  document.body.classList.remove("readonly-mode");
  showLogin();
}

// ── DATA PERSISTENCE PIPELINES ────────────────────────────────────────────────
async function loadRecordsFromBackend() {
  const result = await apiFetch("/api/records");
  records = Array.isArray(result.records) && result.records.length ? result.records : [emptyRecord()];
  applyFiltersToRecords();
  currentIndex = Math.min(currentIndex, records.length - 1);
}

async function persistRecords(auditAction, auditDetail) {
  if (!canEdit()) return;
  const result = await apiFetch("/api/records", {
    method: "PUT",
    body: { records, auditAction: auditAction || "update_records", auditDetail: auditDetail || "" }
  });
  records = result.records;
  applyFiltersToRecords();
}

async function migrateLegacyRecordsIfNeeded() {
  if (!canEdit() || records.length !== 1 || records[0].inmateId !== "2864") return;

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_RECORDS_KEY) || "[]");
    if (Array.isArray(legacy) && legacy.length && legacy.some(record => record.inmateId !== "2864" || record.comment || record.images?.frontFace)) {
      records = legacy;
      currentIndex = 0;
      await persistRecords();
      localStorage.removeItem(LEGACY_RECORDS_KEY);
    }
  } catch {
    // Fail silently on structural anomalies
  }
}

function roleLabel(role) {
  if (role === "admin") return "Super Admin";
  return role === "readonly" ? "Read Only" : "Data Entry";
}

function canEdit() {
  return currentUser?.role === "admin" || currentUser?.role === "entry";
}

function canManageUsers() {
  return currentUser?.role === "admin";
}

function applyAccessMode() {
  const readOnly = !canEdit();
  document.body.classList.toggle("readonly-mode", readOnly);

  Object.values(fields).forEach(field => {
    field.disabled = readOnly;
  });
  fields.age.disabled = true;

  document.querySelectorAll("[data-edit-only]").forEach(element => {
    element.disabled = readOnly;
  });

  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.disabled = readOnly;
  });
}

// ── PROFILE UTILITIES & CALCULATORS ───────────────────────────────────────────
function getFormRecord() {
  const current = records[currentIndex] || emptyRecord();
  const dob = parseDateInput(fields.dob.value);
  const age = calculateAge(dob);
  fields.age.value = age;

  return {
    ...current,
    inmateId: fields.inmateId.value.trim(),
    firstName: fields.firstName.value.trim(),
    middleName: fields.middleName.value.trim(),
    lastName: fields.lastName.value.trim(),
    alias: fields.alias.value.trim(),
    dob,
    age,
    address: fields.address.value.trim(),
    affiliation: fields.affiliation.value.trim(),
    comment: fields.comment.value.trim(),
    inPrison: fields.incarcerationIn.checked,
    images: normalizeImages(current.images),
    admissionDate: fields.incarcerationIn.checked ? fields.statusDate.value : (current.admissionDate || ""),
    dischargeDate: fields.incarcerationOut.checked ? fields.statusDate.value : (current.dischargeDate || "")
  };
}

function renderCurrentRecord() {
  const record = records[currentIndex] || emptyRecord();

  Object.entries(fields).forEach(([key, field]) => {
    if (key === "incarcerationIn") {
      field.checked = Boolean(record.inPrison);
    } else if (key === "incarcerationOut") {
      field.checked = !Boolean(record.inPrison);
    } else if (key === "statusDate") {
      field.value = record.inPrison ? record.admissionDate : record.dischargeDate || "";
    } else {
      field.value = record[key] || "";
    }
  });

  updateStatusDateVisibility();
  fields.age.value = calculateAge(record.dob);

  const mugshot = getMainMugshot(record);
  mainPreview.src = mugshot || "";
  mainPreviewText.textContent = mugshot ? "" : "No photo";

  const images = normalizeImages(record.images);
  const hoverFront = document.querySelector("#hoverFrontPreview");
  const hoverRight = document.querySelector("#hoverRightPreview");
  const hoverLeft = document.querySelector("#hoverLeftPreview");
  if (hoverFront && hoverRight && hoverLeft) {
    hoverFront.setAttribute("src", images.frontFace || "");
    hoverRight.setAttribute("src", images.rightFace || "");
    hoverLeft.setAttribute("src", images.leftFace || "");
    toggleEmptyHoverIndicator(hoverFront, "No Front Photo");
    toggleEmptyHoverIndicator(hoverRight, "No Right Photo");
    toggleEmptyHoverIndicator(hoverLeft, "No Left Photo");
  }

  const photoFrame = document.querySelector(".photo-frame");
  if (photoFrame) {
    photoFrame.classList.toggle("has-no-photos", !mugshot);
  }

  renderMainHistoryTimeline(record.statusHistory || []);
  updateStatus();

  const updateButton = document.querySelector("#updateRecord");
  const saveButton = document.querySelector("#saveRecord");
  const nextButton = document.querySelector("#nextRecord");
  const prevButton = document.querySelector("#previousRecord");
  const newButton = document.querySelector("#newRecord");
  const cancelButton = document.querySelector("#cancelRecord");
  const intelButton = document.querySelector("#openIntelModal");
  const generatePdfButton = document.querySelector("#generatePdf");
  const deleteButton = document.querySelector("#deleteRecord");
  const filterBar = document.querySelector("#filterBar");
  const historyButton = document.querySelector("#viewHistory");

  if (isNewRecord) {
    updateButton.classList.add("hidden");
    saveButton.classList.remove("hidden");
    nextButton.classList.add("hidden");
    prevButton.classList.add("hidden");
    newButton.classList.add("hidden");
    cancelButton.classList.remove("hidden");
    intelButton.classList.add("hidden");
    generatePdfButton.classList.add("hidden");
    deleteButton.classList.add("hidden");
    if (historyButton) historyButton.classList.add("hidden");
    if (filterBar) filterBar.classList.add("hidden");
  } else {
    updateButton.classList.remove("hidden");
    saveButton.classList.add("hidden");
    nextButton.classList.remove("hidden");
    prevButton.classList.remove("hidden");
    newButton.classList.remove("hidden");
    cancelButton.classList.add("hidden");
    intelButton.classList.remove("hidden");
    generatePdfButton.classList.remove("hidden");
    deleteButton.classList.toggle("hidden", !canManageUsers());
    if (historyButton) historyButton.classList.remove("hidden");
    if (filterBar) filterBar.classList.remove("hidden");
  }
}

function getStatusChangeEvent(record, previousRecord) {
  const selectedDate = record.inPrison ? record.admissionDate : record.dischargeDate;
  if (!selectedDate) return null;

  const currentType = record.inPrison ? "Admitted" : "Discharged";
  const previousType = previousRecord?.inPrison ? "Admitted" : "Discharged";

  if (previousRecord && currentType === previousType) {
    const previousDate = record.inPrison ? previousRecord.admissionDate : previousRecord.dischargeDate;
    if (selectedDate === previousDate) return null;
  }

  return {
    type: currentType,
    date: selectedDate,
    timestamp: new Date().toISOString(),
    username: currentUser?.username || "system"
  };
}

function applyStatusHistory(record) {
  const previousRecord = records[currentIndex] || emptyRecord();

  if (pendingStatusEvent) {
    record.statusHistory = [...(previousRecord.statusHistory || []), pendingStatusEvent];
    pendingStatusEvent = null;
  } else {
    const event = getStatusChangeEvent(record, previousRecord);
    if (event) {
      record.statusHistory = [...(previousRecord.statusHistory || []), event];
    } else {
      record.statusHistory = previousRecord.statusHistory || [];
    }
  }
}

function getStatusDateLabel() {
  return fields.incarcerationIn.checked ? "Admission Date" : "Discharge Date";
}

function updateStatusDateVisibility() {
  const dateFieldWrapper = document.querySelector(".status-date-field");
  if (!fields.incarcerationIn.checked && !fields.incarcerationOut.checked) {
    dateFieldWrapper.classList.add("hidden");
    return;
  }

  dateFieldWrapper.classList.remove("hidden");
  dateFieldWrapper.querySelector("span").textContent = getStatusDateLabel();
}

function toggleEmptyHoverIndicator(imgElement, placeholderText) {
  if (!imgElement) return;
  const src = imgElement.getAttribute("src");
  if (!src || src.trim() === "" || src === window.location.href) {
    imgElement.style.display = "none";
    let container = imgElement.parentElement;
    let label = container.querySelector(".popover-empty-placeholder");
    if (!label) {
      label = document.createElement("div");
      label.className = "popover-empty-placeholder";
      label.style.cssText = "height:110px; display:flex; align-items:center; justify-content:center; font-size:11px; color:#94a3b8; background:rgba(0,0,0,0.2); border-radius:4px;";
      label.textContent = placeholderText;
      container.insertBefore(label, imgElement);
    }
  } else {
    imgElement.style.display = "block";
    let label = imgElement.parentElement.querySelector(".popover-empty-placeholder");
    if (label) label.remove();
  }
}

function calculateAge(dobString) {
  if (!dobString) return "";
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : "";
}

function setAgeFromDob() {
  fields.age.value = calculateAge(fields.dob.value);
}

function parseDateInput(val) {
  if (!val) return "";
  return val;
}

function normalizeImages(imgs) {
  if (!imgs) return { frontFace: "", rightFace: "", leftFace: "", tattoos: [] };
  return {
    frontFace: imgs.frontFace || "",
    rightFace: imgs.rightFace || "",
    leftFace: imgs.leftFace || "",
    tattoos: Array.isArray(imgs.tattoos) ? imgs.tattoos : []
  };
}

function getMainMugshot(record) {
  if (!record || !record.images) return "";
  return record.images.frontFace || record.images.rightFace || record.images.leftFace || "";
}

// ── SEARCH, PAGINATION & SEARCH FILTERS ──────────────────────────────────────
function applyFiltersToRecords() {
  filteredRecords = records.filter(r => {
    if (activeFilters.status === "in" && !r.inPrison) return false;
    if (activeFilters.status === "out" && r.inPrison) return false;
    if (activeFilters.affiliation && !String(r.affiliation || "").toLowerCase().includes(activeFilters.affiliation.toLowerCase())) return false;
    if (activeFilters.gang && !String(r.gangAffiliation || "").toLowerCase().includes(activeFilters.gang.toLowerCase())) return false;
    if (activeFilters.dateFrom) {
      const d = r.admissionDate || r.dischargeDate || "";
      if (!d || d < activeFilters.dateFrom) return false;
    }
    if (activeFilters.dateTo) {
      const d = r.admissionDate || r.dischargeDate || "";
      if (!d || d > activeFilters.dateTo) return false;
    }
    return true;
  });
}

function applyRecordFilters() {
  activeFilters.status = document.querySelector("#filterStatus").value;
  activeFilters.affiliation = document.querySelector("#filterAffiliation").value.trim();
  activeFilters.gang = document.querySelector("#filterGang").value.trim();
  activeFilters.dateFrom = document.querySelector("#filterDateFrom").value;
  activeFilters.dateTo = document.querySelector("#filterDateTo").value;
  applyFiltersToRecords();
  currentPage = 1;
  currentIndex = filteredRecords.length ? records.indexOf(filteredRecords[0]) : 0;
  renderCurrentRecord();
  showMessage(`Filter applied. ${filteredRecords.length} record(s) found.`, "info");
}

function clearRecordFilters() {
  activeFilters = { status: "all", affiliation: "", gang: "", dateFrom: "", dateTo: "" };
  document.querySelector("#filterStatus").value = "all";
  document.querySelector("#filterAffiliation").value = "";
  document.querySelector("#filterGang").value = "";
  document.querySelector("#filterDateFrom").value = "";
  document.querySelector("#filterDateTo").value = "";
  applyFiltersToRecords();
  currentPage = 1;
  currentIndex = 0;
  renderCurrentRecord();
  showMessage("Filters cleared.", "info");
}

function updateStatus() {
  const pool = filteredRecords.length ? filteredRecords : records;
  const posInPool = pool.indexOf(records[currentIndex]);
  const displayPos = posInPool >= 0 ? posInPool + 1 : currentIndex + 1;
  const total = pool.length;
  recordStatus.textContent = total ? `Record ${displayPos} of ${total}` : "No records";
}

function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    showMessage("Please enter an Inmate ID to execute an exact index look up.");
    return;
  }

  const index = records.findIndex(r => r.inmateId === query);
  if (index !== -1) {
    currentIndex = index;
    isNewRecord = false;
    renderCurrentRecord();
    showMessage(`Record for Inmate ID ${query} successfully located.`);
  } else {
    showMessage(`No inmate profile tracking matches ID: "${query}" in standard indexing databases.`);
  }
}

// ── DATA CHANGE HANDLERS ─────────────────────────────────────────────────────
function validateRecord(record) {
  if (!record.inmateId || !record.firstName || !record.lastName) {
    showMessage("Inmate ID, First Name, and Last Name are strict system identity data requirements.");
    return false;
  }
  return true;
}

async function saveNewRecord() {
  if (!canEdit()) {
    showMessage("Read-only verification layers cannot save data sets.");
    return;
  }

  const record = getFormRecord();
  if (!validateRecord(record)) return;

  applyStatusHistory(record);

  const isBlankSlot = records.length === 1 && !records[0].inmateId && !records[0].firstName;
  const duplicate = records.some((item, index) => item.inmateId === record.inmateId && index !== currentIndex);
  if (!isBlankSlot && duplicate) {
    showMessage("Inmate ID duplication collision detected. Execute Update Record on original record instead.");
    return;
  }

  const currentIsBlank = !records[currentIndex]?.inmateId && !records[currentIndex]?.firstName;

  if (isBlankSlot || currentIsBlank) {
    records[currentIndex] = record;
  } else {
    records.push(record);
    currentIndex = records.length - 1;
  }

  isNewRecord = false;
  await persistRecords("create_record", `ID ${record.inmateId} - ${record.firstName} ${record.lastName}`);
  renderCurrentRecord();
  showMessage("Inmate intelligence file successfully added to database ledger.", "success");
}

async function updateCurrentRecord() {
  if (!canEdit()) {
    showMessage("Read-only security roles cannot update record configurations.");
    return;
  }

  const record = getFormRecord();
  if (!validateRecord(record)) return;

  applyStatusHistory(record);

  const duplicate = records.some((item, index) => item.inmateId === record.inmateId && index !== currentIndex);
  if (duplicate) {
    showMessage("Primary Key Identity mismatch: Inmate ID assignment conflicts with another tracking module.");
    return;
  }

  records[currentIndex] = record;
  await persistRecords("update_records", `ID ${record.inmateId} - ${record.firstName} ${record.lastName}`);
  renderCurrentRecord();
  showMessage("Inmate file updated successfully.", "success");
}

async function deleteRecord() {
  if (!canManageUsers()) {
    showMessage("Security configuration requires Super Admin credentials to drop tables or rows.");
    return;
  }

  if (records.length === 0) {
    showMessage("No functional profiles mapped to run deletions against.");
    return;
  }

  const record = records[currentIndex];
  const name = [record.firstName, record.lastName].filter(Boolean).join(" ") || "Unknown";
  const id = record.inmateId || "N/A";

  const confirmed = await showDeleteConfirm(name, id);
  if (!confirmed) return;

  try {
    const result = await apiFetch("/api/records", {
      method: "DELETE",
      body: { index: currentIndex }
    });

    records = result.records;

    if (records.length === 0) {
      records = [emptyRecord()];
      currentIndex = 0;
    } else {
      currentIndex = Math.min(currentIndex, records.length - 1);
    }

    isNewRecord = false;
    applyFiltersToRecords();
    renderCurrentRecord();
    showMessage("Inmate record dropped from master system archives.", "success");
  } catch (error) {
    showMessage(error.message || "Failed to finalize database purge array mapping.", "error");
  }
}

function showDeleteConfirm(name, id) {
  return new Promise(resolve => {
    const dialog = document.getElementById("deleteConfirmDialog");
    const msg = document.getElementById("deleteConfirmMessage");
    const confirmBtn = document.getElementById("deleteConfirmBtn");
    const cancelBtn = document.getElementById("deleteCancelBtn");

    msg.textContent = `You are about to delete the record for ${name} (ID: ${id}).`;

    const cleanup = () => {
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      dialog.close();
    };

    const onConfirm = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);

    dialog.showModal();
  });
}

async function createNewRecord() {
  if (!canEdit()) {
    showMessage("Read-only status limits row addition operations.");
    return;
  }

  records.push(emptyRecord());
  currentIndex = records.length - 1;
  isNewRecord = true;
  renderCurrentRecord();
  showMessage("Instantiated blank row mapping parameters. Supply data stack then save.");
  fields.inmateId.focus();
}

function cancelNewRecord() {
  if (!isNewRecord) return;

  records.splice(currentIndex, 1);

  if (currentIndex > 0) {
    currentIndex--;
  } else if (records.length === 0) {
    records.push(emptyRecord());
    currentIndex = 0;
  }

  isNewRecord = false;
  pendingStatusEvent = null;
  renderCurrentRecord();
  showMessage("Operation aborted. Reverting configuration to structural history layers.", "info");
}

function showPreviousRecord() {
  const pool = filteredRecords.length ? filteredRecords : records;
  if (pool.length < 2) return;

  let pos = pool.indexOf(records[currentIndex]);
  pos = (pos - 1 + pool.length) % pool.length;
  currentIndex = records.indexOf(pool[pos]);
  isNewRecord = false;
  renderCurrentRecord();
}

function showNextRecord() {
  const pool = filteredRecords.length ? filteredRecords : records;
  if (pool.length < 2) return;

  let pos = pool.indexOf(records[currentIndex]);
  pos = (pos + 1) % pool.length;
  currentIndex = records.indexOf(pool[pos]);
  isNewRecord = false;
  renderCurrentRecord();
}

// ── INTEL DIAGNOSTIC IMAGE MANAGEMENT & POPUPS ───────────────────────────────
function openIntelModal() {
  const record = records[currentIndex] || emptyRecord();
  const images = normalizeImages(record.images);

  frontFacePreview.src = images.frontFace || "";
  rightFacePreview.src = images.rightFace || "";
  leftFacePreview.src = images.leftFace || "";

  toggleImageTextLabel(frontFacePreview, "No Facial view photo");
  toggleImageTextLabel(rightFacePreview, "No Right Side photo");
  toggleImageTextLabel(leftFacePreview, "No Left Side photo");

  renderTattoos(images.tattoos);
  intelDialog.showModal();
}

function toggleImageTextLabel(imgElement, text) {
  const span = imgElement.nextElementSibling;
  if (imgElement.getAttribute("src")) {
    span.textContent = "";
  } else {
    span.textContent = text;
  }
}

async function saveIntelDetails() {
  if (!canEdit()) return;
  const record = records[currentIndex];
  if (!record) return;

  record.images = {
    frontFace: frontFacePreview.src || "",
    rightFace: rightFacePreview.src || "",
    leftFace: leftFacePreview.src || "",
    tattoos: record.images?.tattoos || []
  };

  await persistRecords("update_images", `ID ${record.inmateId} - Mugshots and tattoo libraries transformed.`);
  renderCurrentRecord();
  intelDialog.close();
  showMessage("Image sub-tables integrated securely.", "success");
}

function setImage(event, key) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    if (key === "frontFace") {
      frontFacePreview.src = e.target.result;
      toggleImageTextLabel(frontFacePreview, "");
    } else if (key === "rightFace") {
      rightFacePreview.src = e.target.result;
      toggleImageTextLabel(rightFacePreview, "");
    } else if (key === "leftFace") {
      leftFacePreview.src = e.target.result;
      toggleImageTextLabel(leftFacePreview, "");
    }
  };
  reader.readAsDataURL(file);
}

function removeFaceImage(key) {
  if (!canEdit()) return;
  if (key === "frontFace") {
    frontFacePreview.removeAttribute("src");
    toggleImageTextLabel(frontFacePreview, "No Facial view photo");
  } else if (key === "rightFace") {
    rightFacePreview.removeAttribute("src");
    toggleImageTextLabel(rightFacePreview, "No Right Side photo");
  } else if (key === "leftFace") {
    leftFacePreview.removeAttribute("src");
    toggleImageTextLabel(leftFacePreview, "No Left Side photo");
  }
}

function addTattooImages(event) {
  if (!canEdit()) return;
  const files = Array.from(event.target.files);
  if (!files.length) return;

  const record = records[currentIndex];
  if (!record) return;
  if (!record.images) record.images = normalizeImages(null);
  if (!record.images.tattoos) record.images.tattoos = [];

  let processedCount = 0;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function (e) {
      openTattooDescModal(e.target.result, file.name, (description) => {
        record.images.tattoos.push({
          src: e.target.result,
          name: file.name,
          description: description || "No descriptive indexing tags added."
        });

        processedCount++;
        if (processedCount === files.length) {
          renderTattoos(record.images.tattoos);
          event.target.value = "";
        }
      });
    };
    reader.readAsDataURL(file);
  });
}

function openTattooDescModal(src, filename, callback) {
  const descModal = document.getElementById("tattooDescModal");
  const preview = document.getElementById("tattooDescPreview");
  const nameLabel = document.getElementById("tattooDescFileName");
  const input = document.getElementById("tattooDescInput");
  const saveBtn = document.getElementById("tattooDescSave");
  const cancelBtn = document.getElementById("tattooDescCancel");

  preview.src = src;
  nameLabel.textContent = filename;
  input.value = "";

  const onSave = () => {
    cleanup();
    callback(input.value.trim());
  };

  const onCancel = () => {
    cleanup();
  };

  const cleanup = () => {
    saveBtn.removeEventListener("click", onSave);
    cancelBtn.removeEventListener("click", onCancel);
    descModal.close();
  };

  saveBtn.addEventListener("click", onSave);
  cancelBtn.addEventListener("click", onCancel);
  descModal.showModal();
}

function renderTattoos(tattoos) {
  tattooList.innerHTML = "";
  if (!tattoos || !tattoos.length) return;

  tattoos.forEach((tat, index) => {
    const card = document.createElement("div");
    card.className = "tattoo-card";
    card.style.cssText = "position:relative; border:1px solid var(--border-color); padding:4px; border-radius:4px; background:var(--bg-main); text-align:center; overflow:hidden;";

    card.innerHTML = `
      <img src="${tat.src}" alt="Tattoo file" style="width:100%; height:80px; object-fit:cover; border-radius:2px; cursor:pointer;">
      <div class="tattoo-desc" style="font-size:13px; font-weight:600; color:#111111; background:#ffffff; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; margin-top:4px; padding:3px 4px; border-radius:2px;">${escapeHtml(tat.description)}</div>
      <button type="button" class="danger-button" style="position:absolute; top:2px; right:2px; padding:2px 6px; font-size:9px; line-height:1;" ${canEdit() ? "" : "disabled"}>&times;</button>
    `;

    card.querySelector("img").addEventListener("click", () => openTattooModal(tat));
    card.querySelector("button").addEventListener("click", (e) => {
      e.stopPropagation();
      if (!canEdit()) return;
      records[currentIndex].images.tattoos.splice(index, 1);
      renderTattoos(records[currentIndex].images.tattoos);
    });

    tattooList.appendChild(card);
  });
}

function openTattooModal(tat) {
  const modal = document.getElementById("tattooModal");
  const img = document.getElementById("tattooModalImg");
  const desc = document.getElementById("tattooModalDesc");

  img.src = tat.src;
  desc.textContent = tat.description || "No classification annotations provided.";
  currentZoomLevel = 1;
  resetTattooZoom();

  modal.showModal();
}

function closeTattooModal() {
  document.getElementById("tattooModal").close();
}

function zoomTattoo(direction) {
  const img = document.getElementById("tattooModalImg");
  if (direction === "in" && currentZoomLevel < MAX_ZOOM) {
    currentZoomLevel += ZOOM_STEP;
  } else if (direction === "out" && currentZoomLevel > MIN_ZOOM) {
    currentZoomLevel -= ZOOM_STEP;
  }
  img.style.transform = `scale(${currentZoomLevel})`;
}

function resetTattooZoom() {
  currentZoomLevel = 1;
  document.getElementById("tattooModalImg").style.transform = "scale(1)";
}

// ── SYSTEM AUDIT LOG MODULES ──────────────────────────────────────────────────
async function openAuditLog() {
  if (!canManageUsers()) return;
  document.getElementById("auditFilterUser").value = "";
  document.getElementById("auditFilterAction").value = "";
  await renderAuditList();
  document.querySelector("#auditDialog").showModal();
}

async function renderAuditList() {
  const listContainer = document.getElementById("auditList");
  listContainer.innerHTML = "<p>Querying audit records...</p>";

  try {
    const userFilter = document.getElementById("auditFilterUser").value.trim();
    const actionFilter = document.getElementById("auditFilterAction").value;

    let queryParams = [];
    if (userFilter) queryParams.push(`user=${encodeURIComponent(userFilter)}`);
    if (actionFilter) queryParams.push(`action=${encodeURIComponent(actionFilter)}`);

    const queryString = queryParams.length ? `?${queryParams.join("&")}` : "";
    const result = await apiFetch(`/api/audit${queryString}`);

    listContainer.innerHTML = "";
    if (!result.logs || !result.logs.length) {
      listContainer.innerHTML = "<p style='font-size:13px; color:var(--text-muted); padding:10px;'>No system matching events found inside current parameter sets.</p>";
      return;
    }

    result.logs.forEach(log => {
      const item = document.createElement("div");
      item.className = "audit-item";
      item.style.cssText = "padding:8px; border-bottom:1px solid var(--border-color); font-size:12px; display:flex; flex-direction:column; gap:2px;";

      const dateStr = new Date(log.timestamp).toLocaleString();
      item.innerHTML = `
        <div style='display:flex; justify-content:between; font-weight:600;'>
          <span style='color:var(--primary);'>${escapeHtml(log.username)}</span>
          <span style='color:var(--text-muted); font-size:11px;'>${dateStr}</span>
        </div>
        <div>Action: <strong style='color:var(--accent);'>${escapeHtml(log.action)}</strong></div>
        <div style='color:var(--text-muted); font-style:italic;'>Meta: ${escapeHtml(log.detail || "None")}</div>
      `;
      listContainer.appendChild(item);
    });
  } catch (err) {
    listContainer.innerHTML = `<p style='color:var(--danger); padding:10px;'>Audit capture failure: ${escapeHtml(err.message)}</p>`;
  }
}

// ── TIMELINE RENDERERS ────────────────────────────────────────────────────────
function renderMainHistoryTimeline(historyArray) {
  mainHistoryTimeline.innerHTML = "";
  if (!historyArray || !historyArray.length) {
    mainHistoryTimeline.innerHTML = '<div class="history-empty">No classification track details found.</div>';
    return;
  }

  historyArray.slice().reverse().forEach(evt => {
    const el = document.createElement("div");
    el.className = "timeline-event";
    el.style.cssText = "padding:8px; border-left:3px solid var(--primary); margin-left:8px; padding-left:12px; background:var(--bg-main); border-radius:0 4px 4px 0; font-size:12px; display:flex; flex-direction:column; gap:2px;";

    const localTime = new Date(evt.timestamp).toLocaleString();
    let detailHtml = `<div><strong>${evt.type}</strong> on <u>${evt.date}</u></div>`;
    if (evt.charge) {
      detailHtml += `<div style='color:var(--text-muted); font-size:11px;'>Context Case Charge: ${escapeHtml(evt.charge)}</div>`;
    }
    if (evt.dischargeStatus) {
      detailHtml += `<div style='color:var(--text-muted); font-size:11px;'>Discharge Category Status: ${escapeHtml(evt.dischargeStatus)}</div>`;
    }
    detailHtml += `<div style='font-size:10px; color:var(--text-muted); margin-top:2px;'>Logged by ${escapeHtml(evt.username)} (${localTime})</div>`;

    el.innerHTML = detailHtml;
    mainHistoryTimeline.appendChild(el);
  });
}

// ── EXPLOITATION SYSTEM EXPORTS (CSV) ──────────────────────────────────────────
function exportCsv() {
  if (!records || !records.length || (records.length === 1 && !records[0].inmateId)) {
    showMessage("Empty analytical data matrices cannot execute file conversions.");
    return;
  }

  const headers = ["Inmate ID", "First Name", "Middle Name", "Last Name", "Alias", "DOB", "Age", "In Prison Status", "Admission Date", "Discharge Date", "Affiliation", "Comments"];
  const rows = records.map(r => [
    r.inmateId || "",
    r.firstName || "",
    r.middleName || "",
    r.lastName || "",
    r.alias || "",
    r.dob || "",
    calculateAge(r.dob),
    r.inPrison ? "TRUE" : "FALSE",
    r.admissionDate || "",
    r.dischargeDate || "",
    r.affiliation || "",
    r.comment || ""
  ]);

  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
    ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `BZE_Central_Prison_Inmate_Intel_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showMessage("CSV dataset generated and downloaded successfully.", "success");
}

// ── SECURE PRINT AND AUTOMATED REPORT MATRIX PIPELINES ────────────────────────
function generatePdfReport() {
  const record = records[currentIndex] || emptyRecord();
  const reportGeneratedDate = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const inmateId = fields.inmateId.value || 'N/A';
  const firstName = fields.firstName.value || '';
  const middleName = fields.middleName.value || '';
  const lastName = fields.lastName.value || '';
  const alias = fields.alias.value || 'None';
  const dobRaw = fields.dob.value || '';
  const age = fields.age.value || 'N/A';
  const address = fields.address.value || 'N/A';
  const affiliation = fields.affiliation.value || 'None';
  const comment = fields.comment.value || 'No institutional remarks recorded.';

  const statusText = fields.incarcerationIn.checked ? 'IN PRISON' : 'OUT OF PRISON';

  // Format DOB to Medium Date (e.g., Apr 16, 1975)
  let dobMedium = 'N/A';
  if (dobRaw) {
    const dobDate = new Date(dobRaw + 'T00:00:00');
    if (!isNaN(dobDate.getTime())) {
      dobMedium = dobDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }

  // Determine history date based on incarceration status
  const dateAddedRaw = fields.dateAdded ? fields.dateAdded.value : '';
  const dateDischargedRaw = fields.dateDischarged ? fields.dateDischarged.value : '';
  let historicDateRaw = dateAddedRaw;

  if (statusText === 'OUT OF PRISON' && dateDischargedRaw) {
    historicDateRaw = dateDischargedRaw;
  }

  let historicDateFormatted = 'N/A';
  if (historicDateRaw) {
    const parsedHistDate = new Date(historicDateRaw + 'T00:00:00');
    if (!isNaN(parsedHistDate.getTime())) {
      historicDateFormatted = parsedHistDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  }

  // Primary profile picture setup
  const mainMugshotSrc = mainPreview.src;
  const standardMugshotHtml = (mainMugshotSrc && !mainMugshotSrc.endsWith('#') && !mainMugshotSrc.includes(window.location.host + '/'))
    ? `<img src="${mainMugshotSrc}" style="width:130px; height:155px; object-fit:contain; background:#f8fafc; border:2px solid #1e3a8a; border-radius:4px;" alt="Primary Mugshot">`
    : `<div style="width:130px; height:155px; border:2px dashed #cbd5e1; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:11px;">No Mugshot</div>`;

  // Safely extract and normalize images structure from the record data source
  const images = normalizeImages(record.images);

  // Dynamic Multi-Angle Facial Profiles Construction
  let facialViewsHtml = '';
  if (images.frontFace || images.rightFace || images.leftFace) {
    facialViewsHtml += `
      <div class="print-section-block">
        <div class="print-section-heading">Facial Angle Profiles</div>
        <div class="print-photos-grid">
    `;
    if (images.leftFace) {
      facialViewsHtml += `<div class="print-photo-item"><img src="${images.leftFace}"><div class="print-photo-caption">Left Profile</div></div>`;
    }
    if (images.frontFace) {
      facialViewsHtml += `<div class="print-photo-item"><img src="${images.frontFace}"><div class="print-photo-caption">Front View</div></div>`;
    }
    if (images.rightFace) {
      facialViewsHtml += `<div class="print-photo-item"><img src="${images.rightFace}"><div class="print-photo-caption">Right Profile</div></div>`;
    }
    facialViewsHtml += `</div></div>`;
  }

  // Array Distribution Logic to handle explicit pagination breaks safely
  const allTattoos = images.tattoos || [];
  const primaryBatch = allTattoos.slice(0, 8);
  const overflowBatch = allTattoos.slice(8);

  // Render Page 1 Tattoo Group (Cap at 8 items max)
  let primaryTattoosHtml = '';
  if (primaryBatch.length > 0) {
    primaryTattoosHtml += `
      <div class="print-section-block">
        <div class="print-section-heading">Registered Body Tattoos & Identifying Marks</div>
        <div class="print-tattoos-grid">
    `;
    primaryBatch.forEach((tat) => {
      primaryTattoosHtml += `
        <div class="print-tattoo-card">
          <img src="${tat.src}">
          <div class="print-tattoo-desc">${escapeHtml(tat.description || '')}</div>
        </div>
      `;
    });
    primaryTattoosHtml += `</div></div>`;
  }

  // Render Page 2 Tattoo Group with an explicit (CONTINUED) indicator markup
  let overflowPageHtml = '';
  if (overflowBatch.length > 0) {
    overflowPageHtml += `
      <div class="print-page-break"></div>
      <div class="print-section-block">
        <div class="print-section-heading">Registered Body Tattoos & Identifying Marks <span class="continued-label">(CONTINUED)</span></div>
        <div class="print-tattoos-grid">
    `;
    overflowBatch.forEach((tat) => {
      overflowPageHtml += `
        <div class="print-tattoo-card">
          <img src="${tat.src}">
          <div class="print-tattoo-desc">${escapeHtml(tat.description || '')}</div>
        </div>
      `;
    });
    overflowPageHtml += `</div></div>`;
  }

  // Create style element dynamically and append it to head so paged media styles (like @page) are parsed correctly
  const printStyle = document.createElement("style");
  printStyle.id = "dynamic-print-style";
  printStyle.innerHTML = `
    @media print {
      html, body {
        background: #fff;
        margin: 0 !important;
        padding: 0 !important;
      }
      body * { 
        visibility: hidden; 
      }
      #reportTemplate, #reportTemplate * { 
        visibility: visible; 
      }
      #reportTemplate { 
        position: static !important; 
        width: 100%;
        margin: 0;
        padding: 0; 
        box-sizing: border-box;
      }
      @page {
        size: auto; 
        margin: 15mm 12mm 15mm 12mm !important; 
      }
      .print-page-break {
        display: block;
        page-break-before: always !important;
        break-before: always !important;
        height: 0;
        margin: 0;
        border: none;
      }
      .print-footer-container {
        margin: 0 !important;
        background: #fff;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }

    .print-wrapper {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #1f2937;
      line-height: 1.4;
      width: 100%;
    }

    .print-profile-grid,
    .print-section-block {
      width: 100%;
    }

    .print-tattoo-card,
    .print-photo-item,
    .print-history-table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .print-header {
      text-align: center;
      border-bottom: 3px double #1e3a8a;
      padding-bottom: 4px;
      margin-top: 0px; 
      margin-bottom: 12px;
    }
    .print-header h1 {
      font-size: 21px;
      font-weight: 800;
      text-transform: uppercase;
      color: #1e3a8a;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .print-header h2 {
      font-size: 14px;
      font-weight: 600;
      color: #4b5563;
      margin: 2px 0 0 0;
      letter-spacing: 1px;
    }

    .print-title-banner {
      background-color: #f1f5f9;
      border-left: 5px solid #1e3a8a;
      padding: 6px 10px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
    }

    .print-profile-grid {
      display: flex;
      gap: 20px;
      margin-bottom: 10px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .print-data-table {
      flex: 1;
      border-collapse: collapse;
      width: 100%;
    }
    .print-data-table td {
      padding: 4px 6px;
      font-size: 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .print-data-table td.label {
      font-weight: 600;
      color: #4b5563;
      width: 28%;
      text-transform: uppercase;
      font-size: 10px;
    }

    .print-section-heading {
      font-size: 12px;
      font-weight: 700;
      color: #1e3a8a;
      border-bottom: 1px solid #1e3a8a;
      padding-bottom: 3px;
      margin-top: 18px;
      margin-bottom: 10px;
      text-transform: uppercase;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }

    .continued-label {
      color: #dc2626 !important;
      font-weight: 700;
      margin-left: 4px;
    }

    .print-comment-box {
      font-size: 11px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px;
      border-radius: 4px;
      white-space: pre-wrap;
    }

    .print-history-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      margin-bottom: 10px;
    }
    .print-history-table th {
      background-color: #f1f5f9;
      color: #1e3a8a;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      text-align: left;
      padding: 6px;
      border: 1px solid #cbd5e1;
    }
    .print-history-table td {
      font-size: 11px;
      padding: 6px;
      border: 1px solid #cbd5e1;
    }

    .print-photos-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 10px;
    }
    .print-photo-item {
      flex: 1;
      border: 1px solid #e2e8f0;
      padding: 4px;
      border-radius: 4px;
      text-align: center;
      background: #f8fafc;
    }
    .print-photo-item img {
      width: 100%;
      height: 115px; 
      object-fit: contain; 
      background: #f1f5f9;
      border-radius: 2px;
    }
    .print-photo-caption {
      font-size: 9px;
      font-weight: 600;
      color: #64748b;
      margin-top: 3px;
      text-transform: uppercase;
    }

    .print-tattoos-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .print-tattoo-card {
      border: 1px solid #e2e8f0;
      padding: 4px;
      border-radius: 4px;
      background: #f8fafc;
      text-align: center;
    }
    .print-tattoo-card img {
      width: 100%;
      height: 85px;
      object-fit: contain; 
      background: #f1f5f9;
      border-radius: 2px;
    }
    .print-tattoo-desc {
      font-size: 9px;
      color: #4b5563;
      margin-top: 3px;
      text-align: left;
      line-height: 1.3;
    }

    .print-footer-container {
      margin-top: 30px;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    
    .print-notice-box {
      border: 2px solid #dc2626;
      padding: 6px 10px;
      text-align: center;
      margin-bottom: 10px;
    }
    .print-notice-box p {
      font-family: "Times New Roman", Times, serif; 
      font-size: 11px; 
      color: #dc2626; 
      font-weight: 700;
      text-transform: uppercase; 
      margin: 0;
      line-height: 1.3;
      letter-spacing: 0.3px;
    }

    .print-kolbe-aim-footer {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #4b5563;
      font-size: 10px;
      width: 100%;
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
    }
    .aim-title {
      font-style: italic;
      font-weight: 700;
      text-decoration: underline;
      text-align: center;
      margin-bottom: 6px;
      font-size: 10px;
    }
    .address-columns {
      display: flex;
      justify-content: space-between;
      line-height: 1.4;
    }
    .address-col { width: 33%; }
    .address-col.center { text-align: center; }
    .address-col.right { text-align: right; }
  `;
  document.head.appendChild(printStyle);

  reportTemplate.innerHTML = `
    <div class="print-wrapper">
      <table style="width: 100%; border-collapse: collapse; border: none; margin: 0; padding: 0;">
        <tbody>
          <tr>
            <td style="padding: 0; border: none;">
              <header class="print-header">
                <h1>The Belize Central Prison</h1>
                <h2>Kolbe Foundation</h2>
              </header>

              <div class="print-title-banner">
                <span>INMATE INTELLIGENCE RECORD</span>
                <span style="color:${statusText === 'IN PRISON' ? '#b91c1c' : '#4b5563'}">${statusText}</span>
              </div>

              <div class="print-profile-grid">
                <div class="print-mugshot-panel">
                  ${standardMugshotHtml}
                </div>
                
                <table class="print-data-table">
                  <tr>
                    <td class="label">Inmate ID</td>
                    <td style="font-weight: 700; font-size: 13px;">${inmateId}</td>
                  </tr>
                  <tr>
                    <td class="label">Full Name</td>
                    <td>${firstName} ${middleName} ${lastName}</td>
                  </tr>
                  <tr>
                    <td class="label">Alias / AKA</td>
                    <td>${alias}</td>
                  </tr>
                  <tr>
                    <td class="label">Date of Birth</td>
                    <td>${dobMedium}</td>
                  </tr>
                  <tr>
                    <td class="label">Age</td>
                    <td>${age}</td>
                  </tr>
                  <tr>
                    <td class="label">Affiliation</td>
                    <td>${affiliation}</td>
                  </tr>
                  <tr>
                    <td class="label">Last Known Address</td>
                    <td>${address}</td>
                  </tr>
                </table>
              </div>

              <div class="print-section-block">
                <div class="print-section-heading">Intelligence Case Commentary & Remarks</div>
                <div class="print-comment-box">${comment}</div>
              </div>

              ${facialViewsHtml}
              
              ${primaryTattoosHtml}

              ${overflowPageHtml}

              <div class="print-section-block">
                <div class="print-section-heading">Status & Institutional Date History</div>
                <table class="print-history-table">
                  <thead>
                    <tr>
                      <th>Current Status</th>
                      <th>Date of Admission / Discharge</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="font-weight: 600; color: ${statusText === 'IN PRISON' ? '#b91c1c' : '#1e3a8a'}">${statusText}</td>
                      <td>${historicDateFormatted}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="padding: 0; border: none;">
              <div class="print-footer-container" style="margin-top: 20px;">
                <div class="print-notice-box">
                  <p>the information contained in this file is confidential and is the sole property of the belize central prison kolbe foundation. the information is not to be used without direct approval of the ceo of prison.</p>
                </div>

                <div class="print-kolbe-aim-footer">
                  <div class="aim-title">Kolbe's Aim - To Provide a Secure, Humane Facility that is geared towards Meaningful Rehabilitation and Successful Re-Integration</div>
                  <div class="address-columns">
                    <div class="address-col">
                      P.O Box 88<br>
                      Belize City, Belize
                    </div>
                    <div class="address-col center">
                      www.kolbe.bz<br>
                      Email: info@kolbe.bz
                    </div>
                    <div class="address-col right">
                      Tel: (501)225-6190/6191<br>
                      Fax: (501)225-6188
                    </div>
                  </div>
                  <div style="text-align: center; margin-top: 8px; font-size: 8px; color: #4b5563; font-weight: bold; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
                    REPORT GENERATED: ${reportGeneratedDate}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  document.body.classList.add("printing");
  window.print();
}
// ── USER INTERFACE THEME ALTERATIONS ─────────────────────────────────────────
function toggleDarkMode() {
  const active = document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", active ? "1" : "0");
}

function applyDarkMode(enable) {
  document.body.classList.toggle("dark-mode", enable);
}

// ── SCREEN NOTICE DECORATORS ──────────────────────────────────────────────────
function showMessage(txt, type = "error") {
  message.textContent = txt;
  message.className = "message global-notice";

  if (!txt) return;

  if (type === "success") {
    message.style.cssText = "background-color:rgba(16,185,129,0.1); border:1px solid #10b981; color:#10b981;";
  } else if (type === "info") {
    message.style.cssText = "background-color:rgba(59,130,246,0.1); border:1px solid #3b82f6; color:#3b82f6;";
  } else {
    message.style.cssText = "background-color:rgba(239,68,68,0.1); border:1px solid #ef4444; color:#ef4444;";
  }

  setTimeout(() => {
    message.textContent = "";
    message.style.cssText = "";
  }, 6000);
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}