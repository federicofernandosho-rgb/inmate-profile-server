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
document.querySelector("#printAllRecords").addEventListener("click", printAllRecords);
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
fields.incarcerationIn.addEventListener("change", updateStatusDateVisibility);
fields.incarcerationOut.addEventListener("change", updateStatusDateVisibility);
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
});

initializeAuth();

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
  applyAccessMode();
  await loadRecordsFromBackend();
  await migrateLegacyRecordsIfNeeded();
  renderCurrentRecord();
}

async function handleLogin(event) {
  event.preventDefault();
  loginMessage.textContent = "";

  try {
    console.log("Attempting login...");
    const result = await apiFetch("/api/login", {
      auth: false,
      method: "POST",
      body: {
        username: document.querySelector("#loginUsername").value.trim(),
        password: document.querySelector("#loginPassword").value
      }
    });
    console.log("Login successful, setting session...");
    setSession(result);
    console.log("Session set, showing app...");
    loginForm.reset();
    await showApp();
    console.log("App shown successfully");
  } catch (error) {
    console.error("Login failed:", error);
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
    // Ignore legacy migration failures.
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

  // Modal fields removed; no modal text inputs to toggle.

  document.querySelectorAll("[data-edit-only]").forEach(element => {
    element.disabled = readOnly;
  });

  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.disabled = readOnly;
  });
}

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
    comment: fields.comment.value.trim(),
    inPrison: fields.incarcerationIn.checked,
    images: normalizeImages(current.images),
    admissionDate: fields.incarcerationIn.checked ? fields.statusDate.value : "",
    dischargeDate: fields.incarcerationOut.checked ? fields.statusDate.value : ""
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
  mainPreview.src = mugshot;
  mainPreviewText.textContent = mugshot ? "" : "No photo";
  renderMainHistoryTimeline(record.statusHistory || []);
  updateStatus();

  // Hide Update, Next, Previous, New buttons when creating a new record
  // Show Cancel button when creating a new record
  const updateButton = document.querySelector("#updateRecord");
  const nextButton = document.querySelector("#nextRecord");
  const prevButton = document.querySelector("#previousRecord");
  const newButton = document.querySelector("#newRecord");
  const cancelButton = document.querySelector("#cancelRecord");
  
  if (isNewRecord) {
    updateButton.classList.add("hidden");
    nextButton.classList.add("hidden");
    prevButton.classList.add("hidden");
    newButton.classList.add("hidden");
    cancelButton.classList.remove("hidden");
  } else {
    updateButton.classList.remove("hidden");
    nextButton.classList.remove("hidden");
    prevButton.classList.remove("hidden");
    newButton.classList.remove("hidden");
    cancelButton.classList.add("hidden");
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
  const event = getStatusChangeEvent(record, previousRecord);
  if (!event) return;

  record.statusHistory = [...(previousRecord.statusHistory || []), event];
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

// ── Pagination & Filtering ────────────────────────────────────────────────────
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

function validateRecord(record) {
  if (!record.inmateId || !record.firstName || !record.lastName) {
    showMessage("Inmate ID, first name, and last name are required.");
    return false;
  }

  return true;
}

async function saveNewRecord() {
  if (!canEdit()) {
    showMessage("Read-only users cannot save records.");
    return;
  }

  const record = getFormRecord();
  if (!validateRecord(record)) return;

  applyStatusHistory(record);

  const isBlankSlot = records.length === 1 && !records[0].inmateId && !records[0].firstName;
  const currentIsBlank = !records[currentIndex]?.inmateId && !records[currentIndex]?.firstName;
  if (!isBlankSlot && !currentIsBlank && records.some(item => item.inmateId === record.inmateId)) {
    showMessage("That Inmate ID already exists. Use Update Record for an existing inmate.");
    return;
  }

  if (isBlankSlot || currentIsBlank) {
    records[currentIndex] = record;
  } else {
    records.push(record);
    currentIndex = records.length - 1;
  }

  isNewRecord = false;
  await persistRecords("create_record", `ID ${record.inmateId} - ${record.firstName} ${record.lastName}`);
  renderCurrentRecord();
  showMessage("Inmate record saved.", "success");
}

async function updateCurrentRecord() {
  if (!canEdit()) {
    showMessage("Read-only users cannot update records.");
    return;
  }

  const record = getFormRecord();
  if (!validateRecord(record)) return;

  applyStatusHistory(record);

  const duplicate = records.some((item, index) => item.inmateId === record.inmateId && index !== currentIndex);
  if (duplicate) {
    showMessage("Another record already uses that Inmate ID.");
    return;
  }

  records[currentIndex] = record;
  await persistRecords("update_records", `ID ${record.inmateId} - ${record.firstName} ${record.lastName}`);
  renderCurrentRecord();
  showMessage("Inmate record updated.", "success");
}

async function deleteRecord() {
  if (!canManageUsers()) {
    showMessage("Only admins can delete records.");
    return;
  }

  if (records.length === 0) {
    showMessage("No records to delete.");
    return;
  }

  const record = records[currentIndex];
  const name = [record.firstName, record.lastName].filter(Boolean).join(" ") || "Unknown";
  const id = record.inmateId || "N/A";

  // Show custom confirmation dialog
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
    showMessage("Inmate record deleted.", "success");
  } catch (error) {
    showMessage(error.message || "Failed to delete record.", "error");
  }
}

function showDeleteConfirm(name, id) {
  return new Promise(resolve => {
    const dialog = document.getElementById("deleteConfirmDialog");
    const message = document.getElementById("deleteConfirmMessage");
    const confirmBtn = document.getElementById("deleteConfirmBtn");
    const cancelBtn = document.getElementById("deleteCancelBtn");

    message.textContent = `You are about to delete the record for ${name} (ID: ${id}).`;

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
    showMessage("Read-only users cannot create records.");
    return;
  }

  records.push(emptyRecord());
  currentIndex = records.length - 1;
  isNewRecord = true;
  // Don't persist yet - wait for save
  renderCurrentRecord();
  showMessage("Ready for a new inmate record.");
  fields.inmateId.focus();
}

function cancelNewRecord() {
  if (!isNewRecord) return;
  
  // Remove the unsaved record from the local array
  records.splice(currentIndex, 1);
  
  // Adjust current index
  if (currentIndex > 0) {
    currentIndex--;
  } else if (records.length === 0) {
    records.push(emptyRecord());
    currentIndex = 0;
  }
  
  isNewRecord = false;
  renderCurrentRecord();
  showMessage("New inmate cancelled.", "info");
}

async function showPreviousRecord() {
  const pool = filteredRecords.length ? filteredRecords : records;
  if (pool.length < 2) {
    showMessage("There is no previous record yet.");
    return;
  }

  if (canEdit()) {
    records[currentIndex] = getFormRecord();
    await persistRecords();
  }

  const posInPool = pool.indexOf(records[currentIndex]);
  const prevPos = (posInPool - 1 + pool.length) % pool.length;
  currentIndex = records.indexOf(pool[prevPos]);

  if (pageSize !== Infinity) {
    const filteredPos = filteredRecords.indexOf(pool[prevPos]);
    if (filteredPos >= 0) currentPage = Math.floor(filteredPos / pageSize) + 1;
  }

  renderCurrentRecord();
  showMessage("Previous record loaded.");
}

async function showNextRecord() {
  const pool = filteredRecords.length ? filteredRecords : records;
  if (pool.length < 2) {
    showMessage("There is no next record yet.");
    return;
  }

  if (canEdit()) {
    records[currentIndex] = getFormRecord();
    await persistRecords();
  }

  const posInPool = pool.indexOf(records[currentIndex]);
  const nextPos = (posInPool + 1) % pool.length;
  currentIndex = records.indexOf(pool[nextPos]);

  if (pageSize !== Infinity) {
    const filteredPos = filteredRecords.indexOf(pool[nextPos]);
    if (filteredPos >= 0) currentPage = Math.floor(filteredPos / pageSize) + 1;
  }

  renderCurrentRecord();
  showMessage("Next record loaded.");
}

// Modal history timeline removed; history rendered only in main view via `renderMainHistoryTimeline`.

function renderMainHistoryTimeline(history) {
  mainHistoryTimeline.innerHTML = "";

  if (!history || !history.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "No status changes recorded.";
    mainHistoryTimeline.append(empty);
    return;
  }

  const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  sortedHistory.forEach(item => {
    const el = document.createElement("div");
    el.className = "timeline-item";

    const content = document.createElement("div");
    content.className = "timeline-content";

    const header = document.createElement("div");
    header.className = "timeline-header";
    header.textContent = item.type;

    const date = document.createElement("div");
    date.className = "timeline-date";
    date.textContent = item.date ? formatDate(item.date) : "No date set";

    content.append(header, date);
    el.append(content);
    mainHistoryTimeline.append(el);
  });
}

function openIntelModal() {
  const record = getFormRecord();
  // Modal now focuses on image intel only
  updateFacePreviews(record);
  renderTattooList(record.images?.tattoos || []);
  intelDialog.showModal();
}

async function saveIntelDetails() {
  if (!canEdit()) {
    showMessage("Read-only users cannot save intel.");
    return;
  }

  const record = getFormRecord();

  // Save current record (images are updated via file inputs already)
  records[currentIndex] = record;
  await persistRecords();
  renderCurrentRecord();
  intelDialog.close();
  showMessage("Image intel saved.");
}

async function removeFaceImage(key) {
  if (!canEdit()) return;

  const record = getFormRecord();
  record.images = normalizeImages(record.images);
  record.images[key] = "";
  records[currentIndex] = record;
  updateFacePreviews(record);
  await persistRecords();
  renderCurrentRecord();
  showMessage("Photo removed.");
}

function setImage(event, key) {
  if (!canEdit()) return;

  const file = event.target.files[0];
  if (!file) return;

  fileToDataUrl(file).then(async dataUrl => {
    const record = getFormRecord();
    record.images = normalizeImages(record.images);
    record.images[key] = dataUrl;
    records[currentIndex] = record;
    await persistRecords();
    updateFacePreviews(record);
    renderCurrentRecord();
  });

  event.target.value = "";
}

function addTattooImages(event) {
  if (!canEdit()) return;

  const files = Array.from(event.target.files);
  if (!files.length) return;

  const pendingImages = [];
  let currentFileIndex = 0;

  const processFilesSequentially = async () => {
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);
      const description = await showTattooDescriptionModal(file.name, dataUrl);
      pendingImages.push({ src: dataUrl, description });
    }

    const record = getFormRecord();
    record.images = normalizeImages(record.images);
    record.images.tattoos = [...(record.images.tattoos || []), ...pendingImages];
    records[currentIndex] = record;
    await persistRecords();
    renderTattooList(record.images.tattoos);
  };

  processFilesSequentially();
  event.target.value = "";
}

function showTattooDescriptionModal(fileName, dataUrl, currentDescription = "") {
  return new Promise(resolve => {
    const overlay = document.getElementById("tattooDescModal");
    const img = document.getElementById("tattooDescPreview");
    const input = document.getElementById("tattooDescInput");
    const fileNameEl = document.getElementById("tattooDescFileName");
    const saveBtn = document.getElementById("tattooDescSave");
    const cancelBtn = document.getElementById("tattooDescCancel");

    img.src = dataUrl;
    fileNameEl.textContent = fileName;
    input.value = currentDescription;

    const handleSave = () => {
      overlay.close();
      cleanup();
      resolve(input.value.trim() || "");
    };

    const handleCancel = () => {
      overlay.close();
      cleanup();
      resolve(currentDescription);
    };

    const handleKeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    };

    const cleanup = () => {
      saveBtn.removeEventListener("click", handleSave);
      cancelBtn.removeEventListener("click", handleCancel);
      overlay.removeEventListener("keydown", handleKeydown);
    };

    saveBtn.addEventListener("click", handleSave);
    cancelBtn.addEventListener("click", handleCancel);
    overlay.addEventListener("keydown", handleKeydown);

    overlay.showModal();
    setTimeout(() => input.focus(), 10);
  });
}

function renderTattooList(tattoos) {
  tattooList.innerHTML = "";

  if (!tattoos.length) {
    const empty = document.createElement("div");
    empty.className = "tattoo-empty";
    empty.textContent = "No tattoo pictures added";
    tattooList.append(empty);
    return;
  }

  tattoos.forEach((tattoo, index) => {
    const src = typeof tattoo === "string" ? tattoo : tattoo.src;
    const description = typeof tattoo === "string" ? "" : (tattoo.description || "");

    const thumb = document.createElement("div");
    thumb.className = "tattoo-thumb";

    const img = document.createElement("img");
    img.src = src;
    img.alt = description || `Tattoo picture ${index + 1}`;
    img.style.cursor = "pointer";
    img.addEventListener("click", () => openTattooModal(index));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "X";
    remove.disabled = !canEdit();
    remove.setAttribute("aria-label", `Remove tattoo picture ${index + 1}`);
    remove.addEventListener("click", () => removeTattoo(index));

    const descEl = document.createElement("p");
    descEl.className = "tattoo-desc";
    descEl.textContent = description || "No description";
    if (canEdit()) {
      descEl.style.cursor = "pointer";
      descEl.style.textDecoration = "underline dotted";
      descEl.title = "Click to edit description";
      descEl.addEventListener("click", () => editTattooDescription(index));
    }

    thumb.append(img, remove, descEl);
    tattooList.append(thumb);
  });
}

async function editTattooDescription(index) {
  if (!canEdit()) return;

  const record = getFormRecord();
  const tattoos = record.images?.tattoos || [];
  const tattoo = tattoos[index];
  const src = typeof tattoo === "string" ? tattoo : tattoo.src;
  const currentDesc = typeof tattoo === "string" ? "" : (tattoo.description || "");

  const newDesc = await showTattooDescriptionModal("Edit description", src, currentDesc);

  record.images = normalizeImages(record.images);
  record.images.tattoos[index] = { src, description: newDesc };
  records[currentIndex] = record;
  await persistRecords();
  renderTattooList(record.images.tattoos);
}

async function removeTattoo(index) {
  if (!canEdit()) return;

  const record = getFormRecord();
  record.images = normalizeImages(record.images);
  record.images.tattoos.splice(index, 1);
  records[currentIndex] = record;
  await persistRecords();
  renderTattooList(record.images.tattoos);
}

let tattooZoomLevel = 1;
let tattooPanX = 0;
let tattooPanY = 0;
let tattooIsDragging = false;
let tattooDragStart = { x: 0, y: 0 };
let tattooDragOffset = { x: 0, y: 0 };

function openTattooModal(index) {
  const record = getFormRecord();
  const tattoos = record.images?.tattoos || [];
  const tattoo = tattoos[index];
  const src = typeof tattoo === "string" ? tattoo : tattoo.src;
  const description = typeof tattoo === "string" ? "" : (tattoo.description || "");

  const modal = document.getElementById("tattooModal");
  const img = document.getElementById("tattooModalImg");
  const desc = document.getElementById("tattooModalDesc");

  img.src = src;
  img.alt = description || `Tattoo picture ${index + 1}`;
  desc.textContent = description || "No description";
  tattooZoomLevel = 1;
  tattooPanX = 0;
  tattooPanY = 0;
  updateTattooTransform(img);
  modal.showModal();
  document.body.classList.add("modal-open");
}

function closeTattooModal() {
  const modal = document.getElementById("tattooModal");
  modal.close();
  document.body.classList.remove("modal-open");
}

function updateTattooTransform(img) {
  img.style.transform = `translate(${tattooPanX}px, ${tattooPanY}px) scale(${tattooZoomLevel})`;
}

function zoomTattoo(direction) {
  const img = document.getElementById("tattooModalImg");
  if (direction === "in") {
    tattooZoomLevel = Math.min(tattooZoomLevel + 0.25, 5);
  } else {
    tattooZoomLevel = Math.max(tattooZoomLevel - 0.25, 0.5);
  }
  if (tattooZoomLevel === 1) {
    tattooPanX = 0;
    tattooPanY = 0;
  }
  updateTattooTransform(img);
}

function resetTattooZoom() {
  const img = document.getElementById("tattooModalImg");
  tattooZoomLevel = 1;
  tattooPanX = 0;
  tattooPanY = 0;
  updateTattooTransform(img);
}

function initTattooPan() {
  const wrapper = document.querySelector(".tattoo-modal-img-wrapper");
  const img = document.getElementById("tattooModalImg");

  wrapper.addEventListener("mousedown", (e) => {
    if (tattooZoomLevel <= 1) return;
    e.preventDefault();
    tattooIsDragging = true;
    tattooDragStart = { x: e.clientX, y: e.clientY };
    tattooDragOffset = { x: tattooPanX, y: tattooPanY };
    wrapper.classList.add("panning");
  });

  document.addEventListener("mousemove", (e) => {
    if (!tattooIsDragging) return;
    e.preventDefault();
    const dx = e.clientX - tattooDragStart.x;
    const dy = e.clientY - tattooDragStart.y;
    tattooPanX = tattooDragOffset.x + dx;
    tattooPanY = tattooDragOffset.y + dy;
    updateTattooTransform(img);
  });

  document.addEventListener("mouseup", () => {
    if (!tattooIsDragging) return;
    tattooIsDragging = false;
    wrapper.classList.remove("panning");
  });

  img.addEventListener("click", (e) => {
    if (Math.abs(tattooPanX - tattooDragOffset.x) > 5 || Math.abs(tattooPanY - tattooDragOffset.y) > 5) {
      return;
    }
    if (tattooZoomLevel < 2) {
      tattooZoomLevel = 2;
    } else if (tattooZoomLevel < 3) {
      tattooZoomLevel = 3;
    } else {
      tattooZoomLevel = 1;
      tattooPanX = 0;
      tattooPanY = 0;
    }
    updateTattooTransform(img);
  });

  wrapper.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    tattooZoomLevel = Math.min(Math.max(tattooZoomLevel + delta, 0.5), 5);
    if (tattooZoomLevel <= 1) {
      tattooPanX = 0;
      tattooPanY = 0;
    }
    updateTattooTransform(img);
  }, { passive: false });
}

initTattooPan();

function setAgeFromDob() {
  const dob = parseDateInput(fields.dob.value);
  fields.age.value = calculateAge(dob);
}

function parseDateInput(value) {
  const input = value.trim();
  if (!input) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return toIsoDate(parsed);
}

function calculateAge(dobValue) {
  if (!dobValue) return "";

  const dob = new Date(`${dobValue}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
}

function generatePdfReport() {
  const record = getFormRecord();

  if (!validateRecord(record)) return;

  records[currentIndex] = record;
  reportTemplate.innerHTML = buildReportMarkup(record);
  document.body.classList.add("printing");
  window.print();
}

function buildReportMarkup(record) {
  const tattoos = record.images?.tattoos || [];
  const generatedAt = new Date();
  const tattooMarkup = tattoos.map((tattoo, index) => {
    const src = typeof tattoo === "string" ? tattoo : tattoo.src;
    const description = typeof tattoo === "string" ? "" : (tattoo.description || "");
    const caption = description || `Tattoo ${index + 1}`;
    return `
    <figure class="report-photo tattoo-report-photo">
      <img src="${src}" alt="${escapeHtml(description || `Tattoo picture ${index + 1}`)}">
      <figcaption>${escapeHtml(caption)}</figcaption>
    </figure>
  `;
  }).join("");

  const history = record.statusHistory || [];
  const historyMarkup = history.map(item => `
    <div class="report-history-item">
      <strong>${escapeHtml(item.type)}</strong>
      <span>Date: ${item.date ? formatDate(item.date) : "Not set"}</span>
      <span class="report-meta">By ${escapeHtml(item.username)} on ${formatMediumDateTime(new Date(item.timestamp))}</span>
    </div>
  `).join("");

  return `
    <div class="report-heading">
      <h1>Inmate Profile Report</h1>
      <p>Generated ${escapeHtml(formatMediumDateTime(generatedAt))}</p>
    </div>
    <div class="report-grid">
      ${reportField("Inmate ID", record.inmateId)}
      ${reportField("Name", fullName(record))}
      ${reportField("Alias AKA", record.alias)}
      ${reportField("DOB", formatDate(record.dob))}
      ${reportField("Age", record.age)}
      ${reportField("Address", record.address)}
      ${reportField("Affiliation", record.affiliation)}
      ${reportField("Gang Affiliation", record.gangAffiliation)}
      ${reportField("Currently in prison", record.inPrison ? "Yes" : "No")}
      ${record.inPrison && record.admissionDate ? reportField("Admission Date", formatDate(record.admissionDate)) : ""}
      ${!record.inPrison && record.dischargeDate ? reportField("Discharge Date", formatDate(record.dischargeDate)) : ""}
      <div class="report-field report-comment"><strong>Comment</strong>${escapeHtml(record.comment || "None")}</div>
    </div>
    <div class="report-images mugshot-report-images">
      ${reportImage("Left Face", record.images?.leftFace)}
      ${reportImage("Facial View", record.images?.frontFace)}
      ${reportImage("Right Face", record.images?.rightFace)}
    </div>
    <h3 class="report-section-title">Tattoo Pictures</h3>
    <div class="report-images tattoo-report-images">
      ${tattooMarkup || '<div class="report-photo tattoo-report-photo empty-photo"><strong>Tattoo Pictures</strong><span>No tattoo pictures added</span></div>'}
    </div>
    <h3 class="report-section-title">Status & Date History</h3>
    <div class="report-history-list">
      ${historyMarkup || '<div class="report-history-item" style="justify-content: center;"><span>No status changes recorded.</span></div>'}
    </div>
  `;
}

function reportField(label, value) {
  return `<div class="report-field"><strong>${escapeHtml(label)}</strong>${escapeHtml(value || "Not provided")}</div>`;
}

function reportImage(label, src) {
  if (!src) {
    return `<div class="report-photo empty-photo"><strong>${escapeHtml(label)}</strong><span>No image added</span></div>`;
  }

  return `<figure class="report-photo"><img src="${src}" alt="${escapeHtml(label)}"><figcaption>${escapeHtml(label)}</figcaption></figure>`;
}

function normalizeImages(images) {
  const tattoos = Array.isArray(images?.tattoos)
    ? images.tattoos.map(t => typeof t === "string" ? { src: t, description: "" } : { src: t.src || "", description: t.description || "" })
    : [];
  return {
    ...emptyRecord().images,
    ...(images || {}),
    tattoos
  };
}

function getMainMugshot(record) {
  const images = normalizeImages(record.images);
  return images.frontFace || images.rightFace || images.leftFace || "";
}

function updateFacePreviews(record) {
  const images = normalizeImages(record.images);
  frontFacePreview.src = images.frontFace;
  rightFacePreview.src = images.rightFace;
  leftFacePreview.src = images.leftFace;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  return formatMediumDate(value);
}

function formatMediumDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatMediumDateTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function apiFetch(path, options = {}) {
  const fetchOptions = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json"
    }
  };

  if (options.auth !== false && authToken) {
    fetchOptions.headers.Authorization = `Bearer ${authToken}`;
  }

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, fetchOptions);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && options.auth !== false) logout();
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function fullName(record) {
  return [record.firstName, record.middleName, record.lastName].filter(Boolean).join(" ");
}

function showMessage(text, type = "info", duration = 4000) {
  // display message with type class
  message.textContent = text;
  message.classList.remove("message-success", "message-error", "message-info");
  message.classList.add(`message-${type}`);

  // clear any previous hide timer
  if (message._timeout) {
    clearTimeout(message._timeout);
    message._timeout = null;
  }

  // auto-hide for non-error messages
  if (type === "success" || type === "info") {
    message.style.opacity = "1";
    message._timeout = setTimeout(() => {
      // fade then clear
      message.style.opacity = "0";
      setTimeout(() => {
        message.textContent = "";
        message.classList.remove("message-success", "message-error", "message-info");
        message.style.opacity = "";
      }, 220);
    }, duration);
  } else {
    // keep error messages visible until next message
    message.style.opacity = "1";
  }
}

function handleSearch(event) {
  if (event && event.preventDefault) event.preventDefault();
  const lookupId = (searchInput.value || "").trim();
  if (!lookupId) {
    showMessage("Enter an Inmate ID to search.");
    return;
  }

  const matchIndex = records.findIndex(record => record.inmateId === lookupId);
  if (matchIndex === -1) {
    showMessage(`No inmate record found for ID ${lookupId}.`);
    return;
  }

  currentIndex = matchIndex;
  renderCurrentRecord();
  showMessage(`Loaded inmate ${lookupId}.`);
}

// ── Dark Mode ────────────────────────────────────────────────────────────────
function applyDarkMode(on) {
  document.body.classList.toggle("dark-mode", on);
  const btn = document.querySelector("#darkModeToggle");
  if (btn) btn.textContent = on ? "\u2600\uFE0F" : "\uD83C\uDF19";
}

function toggleDarkMode() {
  const on = !document.body.classList.contains("dark-mode");
  applyDarkMode(on);
  localStorage.setItem("darkMode", on ? "1" : "0");
}

// ── Export CSV ───────────────────────────────────────────────────────────────
function exportCsv() {
  const link = document.createElement("a");
  link.href = "/api/export/csv";
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
  showMessage("CSV export started.", "success");
}

// ── Audit Log ────────────────────────────────────────────────────────────────
async function openAuditLog() {
  if (!canManageUsers()) {
    showMessage("Only admins can view the audit log.");
    return;
  }
  document.querySelector("#auditList").innerHTML = "<p>Loading...</p>";
  document.querySelector("#auditDialog").showModal();
  await renderAuditList();
}

async function renderAuditList() {
  try {
    const result = await apiFetch("/api/audit");
    const filterUser = (document.querySelector("#auditFilterUser").value || "").trim().toLowerCase();
    const filterAction = document.querySelector("#auditFilterAction").value || "";

    let log = [...result.log].reverse();
    if (filterUser) log = log.filter(e => (e.username || "").toLowerCase().includes(filterUser));
    if (filterAction) log = log.filter(e => e.action === filterAction);

    const list = document.querySelector("#auditList");
    if (!log.length) {
      list.innerHTML = "<p>No audit entries found.</p>";
      return;
    }

    list.innerHTML = log.map(e => `
      <div class="audit-entry">
        <span class="audit-action">${escapeHtml(e.action || "")}</span>
        <span class="audit-user">${escapeHtml(e.username || "")}</span>
        <span class="audit-detail">${escapeHtml(e.detail || "")}</span>
        <span class="audit-time">${e.timestamp ? new Date(e.timestamp).toLocaleString() : ""}</span>
      </div>
    `).join("");
  } catch (error) {
    document.querySelector("#auditList").innerHTML = `<p>Error: ${escapeHtml(error.message)}</p>`;
  }
}

// ── Print All Records ────────────────────────────────────────────────────────
function printAllRecords() {
  const pool = filteredRecords.length ? filteredRecords : records;
  if (!pool.length) {
    showMessage("No records to print.");
    return;
  }

  const reportTemplate = document.querySelector("#reportTemplate");
  reportTemplate.innerHTML = pool.map((record, i) => {
    const divider = i < pool.length - 1 ? '<div class="report-page-break"></div>' : "";
    return buildReportMarkup(record) + divider;
  }).join("");

  document.body.classList.add("printing");
  window.print();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
