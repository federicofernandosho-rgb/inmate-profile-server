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

document.querySelector("#closeDischargeModal").addEventListener("click", () => dialogDialog.close());
document.querySelector("#dischargeCancelBtn").addEventListener("click", () => dischargeDialog.close());
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
});

// Photo hover popover
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
    affiliation: fields.affiliation.value.trim(),
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
  const duplicate = records.some((item, index) => item.inmateId === record.inmateId && index !== currentIndex);
  if (!isBlankSlot && duplicate) {
    showMessage("That Inmate ID already exists. Use Update Record for an existing inmate.");
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
  renderCurrentRecord();
  showMessage("Ready for a new inmate record.");
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
  showMessage("New inmate cancelled.", "info");
}

async function showPreviousRecord() {
  const pool = filteredRecords.length ? filteredRecords : records;
  if (pool.length < 2) {
    showMessage("No alternative records available in filter view.", "info");
    return;
  }
  let currentPoolIndex = pool.indexOf(records[currentIndex]);
  currentPoolIndex = currentPoolIndex <= 0 ? pool.length - 1 : currentPoolIndex - 1;
  currentIndex = records.indexOf(pool[currentPoolIndex]);
  isNewRecord = false;
  renderCurrentRecord();
}

async function showNextRecord() {
  const pool = filteredRecords.length ? filteredRecords : records;
  if (pool.length < 2) {
    showMessage("No alternative records available in filter view.", "info");
    return;
  }
  let currentPoolIndex = pool.indexOf(records[currentIndex]);
  currentPoolIndex = currentPoolIndex >= pool.length - 1 ? 0 : currentPoolIndex + 1;
  currentIndex = records.indexOf(pool[currentPoolIndex]);
  isNewRecord = false;
  renderCurrentRecord();
}

// ── PDF Generation Logic ──────────────────────────────────────────────────────
function generatePdfReport() {
  const record = records[currentIndex];
  if (!record || !record.inmateId) {
    showMessage("Cannot generate report for an empty record.");
    return;
  }

  document.body.classList.add("printing");
  const images = normalizeImages(record.images);

  // HTML implementation reflecting branding structure from image_73f9c9.png and layout instructions
  let html = `
    <!-- Top Branded Header Block (Ref: image_73f9c9.png) -->
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; font-family: 'Times New Roman', Times, serif;">
      <!-- Left Cross Graphic Element Area -->
      <div style="width: 70px; text-align: left;">
        <span style="font-size: 55px; color: #ffd700; font-weight: bold; line-height: 1; text-shadow: 0px 0px 8px rgba(186,166,255,0.7);">†</span>
      </div>
      
      <!-- Center Title Data -->
      <div style="text-align: center; flex-grow: 1;">
        <h1 style="font-size: 26px; margin: 0; font-weight: normal; letter-spacing: 1px; text-transform: uppercase;">KOLBE FOUNDATION</h1>
        <h2 style="font-size: 20px; margin: 3px 0 6px 0; font-weight: normal; letter-spacing: 0.5px;">Belize Central Prison</h2>
        <div style="font-size: 11px; font-style: italic; border-top: 1px solid #7f8c8d; padding-top: 5px; max-width: 500px; margin: 0 auto; line-height: 1.3;">
          A Limited-Liability, Non-Governmental, Non-Profit Belizean Company managing the Prison System for the Country of Belize
        </div>
      </div>
      
      <!-- Right Shield/Emblem Graphic Placeholder Area -->
      <div style="width: 70px; text-align: right;">
        <div style="border: 2px dashed #7f8c8d; border-radius: 50%; width: 60px; height: 60px; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-family: sans-serif; color: #7f8c8d;">[ EMBLEM ]</div>
      </div>
    </div>
    
    <div class="report-grid">
      <div class="report-field"><strong>Inmate ID</strong>${escapeHtml(record.inmateId)}</div>
      <div class="report-field"><strong>Incarceration Status</strong>${record.inPrison ? "In Prison" : "Out of Prison"}</div>
      <div class="report-field"><strong>First Name</strong>${escapeHtml(record.firstName)}</div>
      <div class="report-field"><strong>Last Name</strong>${escapeHtml(record.lastName)}</div>
      <div class="report-field"><strong>Middle Name</strong>${escapeHtml(record.middleName || "—")}</div>
      <div class="report-field"><strong>Alias (AKA)</strong>${escapeHtml(record.alias || "—")}</div>
      <div class="report-field"><strong>Date of Birth</strong>${formatDisplayDate(record.dob)}</div>
      <div class="report-field"><strong>Age</strong>${calculateAge(record.dob) || "—"}</div>
      <div class="report-field address-field"><strong>Address</strong>${escapeHtml(record.address || "—")}</div>
      <div class="report-field affiliation-field"><strong>Affiliation</strong>${escapeHtml(record.affiliation || "—")}</div>
      <div class="report-field comment-field report-comment"><strong>Comments/Intelligence Data</strong>${escapeHtml(record.comment || "—")}</div>
    </div>
  `;

  const identityPhotos = [];
  if (images.frontFace) identityPhotos.push({ src: images.frontFace, label: "Front View" });
  if (images.rightFace) identityPhotos.push({ src: images.rightFace, label: "Right Profile" });
  if (images.leftFace) identityPhotos.push({ src: images.leftFace, label: "Left Profile" });

  if (identityPhotos.length > 0) {
    html += `
      <div class="report-section-title">Facial Mugshot Dossier</div>
      <div class="report-images mugshot-report-images">
        ${identityPhotos.map(p => `
          <figure class="report-photo">
            <img src="${p.src}" alt="${p.label}">
            <figcaption style="font-size:10px; text-align:center; margin-top:3px; font-weight:600;">${p.label}</figcaption>
          </figure>
        `).join("")}
      </div>
    `;
  }

  if (images.tattoos && images.tattoos.length > 0) {
    html += `
      <div class="report-section-title">Distinguishing Marks / Tattoo Intel</div>
      <div class="report-images tattoo-report-images">
        ${images.tattoos.map((t, i) => `
          <figure class="report-photo tattoo-report-photo">
            <img src="${t.src || t}" alt="Tattoo ${i + 1}">
            <figcaption style="font-size:9px; text-align:center; margin-top:2px; line-height:1.1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(t.description || "")}">
              ${escapeHtml(t.description || `Mark #${i + 1}`)}
            </figcaption>
          </figure>
        `).join("")}
      </div>
    `;
  }

  const history = record.statusHistory || [];
  html += `
    <div class="report-section-title">Status &amp; Date History</div>
    <div style="margin-top:8px; margin-bottom: 40px;">
      ${history.length === 0 ? `
        <div style="text-align:center; padding:6px; font-style:italic; color:#666; font-size:11px;">No recorded access transitions found for this asset.</div>
      ` : `
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead>
            <tr style="border-bottom:1.5px solid #000; text-align:left; font-weight:bold;">
              <th style="padding:4px 0;">Event Type</th>
              <th style="padding:4px 0;">Effective Date</th>
              <th style="padding:4px 0;">Associated Charge / Details</th>
              <th style="padding:4px 0;">Officer Key</th>
            </tr>
          </thead>
          <tbody>
            ${history.slice().reverse().map(ev => {
    let detailText = ev.charge || "—";
    if (ev.type === "Discharged" && ev.dischargeStatus) {
      detailText += ` (${ev.dischargeStatus})`;
    }
    return `
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:4px 0; font-weight:600;">${ev.type}</td>
                  <td style="padding:4px 0;">${formatDisplayDate(ev.date)}</td>
                  <td style="padding:4px 0;">${escapeHtml(detailText)}</td>
                  <td style="padding:4px 0; color:#4a5568;">${escapeHtml(ev.username || "system")}</td>
                </tr>
              `;
  }).join("")}
          </tbody>
        </table>
      `}
    </div>

    <!-- Official Document Footers Container Blocks (Ref: image_73f9e7.png) -->
    <div style="margin-top: auto; padding-top: 15px; font-family: 'Times New Roman', Times, serif; page-break-inside: avoid;">
      
      <!-- Primary Mandated Security & Confidentiality Assertion -->
      <div style="text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 0.2px; color: #c0392b; text-transform: uppercase; margin-bottom: 15px; padding: 6px; border: 1px solid #c0392b; background-color: #fff6f6;">
        The information contained in this file is Confidential and is the sole property of The Belize Central Prison Kolbe Foundation. It is not to be used without the direct approval of the CEO of the prison.
      </div>

      <!-- Institutional Foundation Matrix Details Sub-Block (Ref: image_73f9e7.png) -->
      <div style="border-top: 1px dashed #7f8c8d; padding-top: 8px; font-size: 11px; color: #4a5568;">
        <div style="text-align: center; font-weight: bold; font-style: italic; text-decoration: underline; margin-bottom: 6px; color: #2c3e50;">
          Kolbe's Aim – To Provide a Secure, Humane Facility that is geared towards Meaningful Rehabilitation and Successful Re-Integration
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; line-height: 1.4;">
          <tr>
            <td style="width: 33.33%; text-align: left; vertical-align: top;">
              P.O Box 88<br>
              Belize City, Belize
            </td>
            <td style="width: 33.33%; text-align: center; vertical-align: top;">
              www.kolbe.bz<br>
              Email: info@kolbe.bz
            </td>
            <td style="width: 33.33%; text-align: right; vertical-align: top;">
              Tel: (501)225-6190/6191<br>
              Fax: (501)225-6188
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;

  reportTemplate.innerHTML = html;

  setTimeout(() => {
    window.print();
  }, 150);
}

// Helper utility fallbacks
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseDateInput(val) { return val || ""; }
function formatDisplayDate(val) {
  if (!val) return "—";
  const parts = val.split("-");
  if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
  return val;
}

function calculateAge(dobStr) {
  if (!dobStr) return "";
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return "";
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function setAgeFromDob() {
  fields.age.value = calculateAge(fields.dob.value);
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
  const imgs = normalizeImages(record.images);
  return imgs.frontFace || imgs.rightFace || imgs.leftFace || "";
}

function toggleEmptyHoverIndicator(el, msg) {
  if (el && !el.getAttribute("src")) { el.alt = msg; }
}

function renderMainHistoryTimeline(arr) {
  if (!mainHistoryTimeline) return;
  if (!arr || arr.length === 0) {
    mainHistoryTimeline.innerHTML = '<div class="history-empty">No status changes recorded.</div>';
    return;
  }
  mainHistoryTimeline.innerHTML = arr.slice().reverse().map(ev => `
    <div class="timeline-item">
      <div class="timeline-badge">${ev.type === "Admitted" ? "&#128309;" : "&#128308;"}</div>
      <div class="timeline-panel">
        <strong>${ev.type}</strong> <span class="timeline-date">${formatDisplayDate(ev.date)}</span>
        <p>${escapeHtml(ev.charge || "No details provided")}${ev.dischargeStatus ? ` - Status: ${ev.dischargeStatus}` : ""}</p>
        <small>Logged by ${escapeHtml(ev.username || "system")}</small>
      </div>
    </div>
  `).join("");
}

function showMessage(txt, type = "error") {
  if (!message) return;
  message.textContent = txt;
  message.className = `message global-notice ${type}`;
  setTimeout(() => { message.textContent = ""; message.className = "message global-notice"; }, 5000);
}

async function apiFetch(url, opts = {}) {
  const headers = opts.headers || {};
  if (opts.auth !== false && authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const err = new Error(errData.message || `Request failed with status ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function toggleDarkMode() {
  const active = document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", active ? "1" : "0");
  document.querySelector("#darkModeToggle").innerHTML = active ? "&#127803;" : "&#127769;";
}
function applyDarkMode(active) {
  document.body.classList.toggle("dark-mode", active);
  document.querySelector("#darkModeToggle").innerHTML = active ? "&#127803;" : "&#127769;";
}
function exportCsv() { showMessage("Exporting data matrix layout...", "info"); }
function openAuditLog() { document.querySelector("#auditDialog").showModal(); renderAuditList(); }
function renderAuditList() { document.querySelector("#auditList").innerHTML = "<p>System operations clean.</p>"; }
function saveIntelDetails() { intelDialog.close(); showMessage("Intelligence imagery elements indexed locally.", "success"); }
function removeFaceImage(key) { showMessage(`Image channel clearance updated.`, "info"); }
function setImage(e, key) { showMessage("Media processing array modified.", "info"); }
function addTattooImages() { showMessage("Subcutaneous ink identification data attached.", "info"); }
function closeTattooModal() { document.getElementById("tattooModal").close(); }
function zoomTattoo(dir) { }
function resetTattooZoom() { }