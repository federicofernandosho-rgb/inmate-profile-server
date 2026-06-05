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
  comment: document.querySelector("#comment")
};

const intelDialog = document.querySelector("#intelDialog");
const modalPersonName = document.querySelector("#modalPersonName");
const gangAffiliation = document.querySelector("#gangAffiliation");
const personName = document.querySelector("#personName");
const inPrison = document.querySelector("#inPrison");
const outOfPrison = document.querySelector("#outOfPrison");
const admissionDateLabel = document.querySelector("#admissionDateLabel");
const dischargeDateLabel = document.querySelector("#dischargeDateLabel");
const admissionDate = document.querySelector("#admissionDate");
const dischargeDate = document.querySelector("#dischargeDate");
const historyTimeline = document.querySelector("#historyTimeline");
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
document.querySelector("#updateRecord").addEventListener("click", updateCurrentRecord);
document.querySelector("#generatePdf").addEventListener("click", generatePdfReport);
document.querySelector("#openIntelModal").addEventListener("click", openIntelModal);
document.querySelector("#closeModal").addEventListener("click", () => intelDialog.close());
document.querySelector("#saveIntel").addEventListener("click", saveIntelDetails);
inPrison.addEventListener("change", toggleDateFieldsVisibility);
outOfPrison.addEventListener("change", toggleDateFieldsVisibility);
document.querySelectorAll(".remove-image").forEach(button => {
  button.addEventListener("click", () => removeFaceImage(button.dataset.imageKey));
});
document.querySelector("#frontFaceUpload").addEventListener("change", event => setImage(event, "frontFace"));
document.querySelector("#rightFaceUpload").addEventListener("change", event => setImage(event, "rightFace"));
document.querySelector("#leftFaceUpload").addEventListener("change", event => setImage(event, "leftFace"));
document.querySelector("#tattooUpload").addEventListener("change", addTattooImages);
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

async function loadRecordsFromBackend() {
  const result = await apiFetch("/api/records");
  records = Array.isArray(result.records) && result.records.length ? result.records : [emptyRecord()];
  currentIndex = Math.min(currentIndex, records.length - 1);
}

async function persistRecords() {
  if (!canEdit()) return;
  const result = await apiFetch("/api/records", {
    method: "PUT",
    body: { records }
  });
  records = result.records;
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

  [gangAffiliation, personName, inPrison, outOfPrison, admissionDate, dischargeDate].forEach(field => {
    field.disabled = readOnly;
  });

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
    images: normalizeImages(current.images)
  };
}

function renderCurrentRecord() {
  const record = records[currentIndex] || emptyRecord();

  Object.entries(fields).forEach(([key, field]) => {
    field.value = record[key] || "";
  });

  fields.age.value = calculateAge(record.dob);

  const mugshot = getMainMugshot(record);
  mainPreview.src = mugshot;
  mainPreviewText.textContent = mugshot ? "" : "No photo";
  updateStatus();
}

function updateStatus() {
  recordStatus.textContent = records.length
    ? `Record ${currentIndex + 1} of ${records.length}`
    : "No records";
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

  await persistRecords();
  renderCurrentRecord();
  showMessage("Inmate record saved.");
}

async function updateCurrentRecord() {
  if (!canEdit()) {
    showMessage("Read-only users cannot update records.");
    return;
  }

  const record = getFormRecord();
  if (!validateRecord(record)) return;

  const duplicate = records.some((item, index) => item.inmateId === record.inmateId && index !== currentIndex);
  if (duplicate) {
    showMessage("Another record already uses that Inmate ID.");
    return;
  }

  records[currentIndex] = record;
  await persistRecords();
  renderCurrentRecord();
  showMessage("Inmate record updated.");
}

async function createNewRecord() {
  if (!canEdit()) {
    showMessage("Read-only users cannot create records.");
    return;
  }

  records.push(emptyRecord());
  currentIndex = records.length - 1;
  await persistRecords();
  renderCurrentRecord();
  showMessage("Ready for a new inmate record.");
  fields.inmateId.focus();
}

async function showPreviousRecord() {
  if (records.length < 2) {
    showMessage("There is no previous record yet.");
    return;
  }

  if (canEdit()) {
    records[currentIndex] = getFormRecord();
    await persistRecords();
  }

  currentIndex = (currentIndex - 1 + records.length) % records.length;
  renderCurrentRecord();
  showMessage("Previous record loaded.");
}

async function showNextRecord() {
  if (records.length < 2) {
    showMessage("There is no next record yet.");
    return;
  }

  if (canEdit()) {
    records[currentIndex] = getFormRecord();
    await persistRecords();
  }

  currentIndex = (currentIndex + 1) % records.length;
  renderCurrentRecord();
  showMessage("Next record loaded.");
}

function toggleDateFieldsVisibility() {
  if (inPrison.checked) {
    admissionDateLabel.classList.remove("hidden");
    dischargeDateLabel.classList.add("hidden");
  } else {
    admissionDateLabel.classList.add("hidden");
    dischargeDateLabel.classList.remove("hidden");
  }
}

function renderHistoryTimeline(history) {
  historyTimeline.innerHTML = "";

  if (!history || !history.length) {
    const empty = document.createElement("div");
    empty.className = "tattoo-empty";
    empty.textContent = "No status changes recorded.";
    historyTimeline.append(empty);
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

    const meta = document.createElement("div");
    meta.className = "timeline-meta";
    const changeTime = formatMediumDateTime(new Date(item.timestamp));
    meta.textContent = `By ${escapeHtml(item.username)} on ${changeTime}`;

    content.append(header, date, meta);
    el.append(content);
    historyTimeline.append(el);
  });
}

function openIntelModal() {
  const record = getFormRecord();
  const displayName = fullName(record) || "Unnamed inmate";

  gangAffiliation.value = record.gangAffiliation || "";
  personName.value = record.personName || displayName;
  inPrison.checked = Boolean(record.inPrison);
  outOfPrison.checked = !record.inPrison;
  modalPersonName.textContent = displayName;
  
  admissionDate.value = record.admissionDate || "";
  dischargeDate.value = record.dischargeDate || "";

  toggleDateFieldsVisibility();
  renderHistoryTimeline(record.statusHistory || []);

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
  
  const oldInPrison = Boolean(record.inPrison);
  const oldAdmissionDate = record.admissionDate || "";
  const oldDischargeDate = record.dischargeDate || "";

  const newInPrison = inPrison.checked;
  const newAdmissionDate = admissionDate.value;
  const newDischargeDate = dischargeDate.value;

  let changed = false;
  let eventType = "";
  let eventDate = "";

  if (oldInPrison !== newInPrison) {
    changed = true;
    eventType = newInPrison ? "Admitted" : "Discharged";
    eventDate = newInPrison ? newAdmissionDate : newDischargeDate;
  } else if (newInPrison && oldAdmissionDate !== newAdmissionDate) {
    changed = true;
    eventType = "Admission Date Updated";
    eventDate = newAdmissionDate;
  } else if (!newInPrison && oldDischargeDate !== newDischargeDate) {
    changed = true;
    eventType = "Discharge Date Updated";
    eventDate = newDischargeDate;
  }

  if (changed) {
    if (!record.statusHistory) record.statusHistory = [];
    record.statusHistory.push({
      type: eventType,
      date: eventDate,
      timestamp: new Date().toISOString(),
      username: currentUser?.username || "system"
    });
  }

  record.gangAffiliation = gangAffiliation.value.trim();
  record.personName = personName.value.trim();
  record.inPrison = newInPrison;
  record.admissionDate = newAdmissionDate;
  record.dischargeDate = newDischargeDate;

  records[currentIndex] = record;
  await persistRecords();
  renderCurrentRecord();
  intelDialog.close();
  showMessage("Gang and image intel saved.");
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

  Promise.all(files.map(fileToDataUrl)).then(async images => {
    const record = getFormRecord();
    record.images = normalizeImages(record.images);
    record.images.tattoos = [...(record.images.tattoos || []), ...images];
    records[currentIndex] = record;
    await persistRecords();
    renderTattooList(record.images.tattoos);
  });

  event.target.value = "";
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

  tattoos.forEach((src, index) => {
    const thumb = document.createElement("div");
    thumb.className = "tattoo-thumb";

    const img = document.createElement("img");
    img.src = src;
    img.alt = `Tattoo picture ${index + 1}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "X";
    remove.disabled = !canEdit();
    remove.setAttribute("aria-label", `Remove tattoo picture ${index + 1}`);
    remove.addEventListener("click", () => removeTattoo(index));

    thumb.append(img, remove);
    tattooList.append(thumb);
  });
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
  const tattooMarkup = tattoos.map((src, index) => `
    <figure class="report-photo tattoo-report-photo">
      <img src="${src}" alt="Tattoo picture ${index + 1}">
      <figcaption>Tattoo ${index + 1}</figcaption>
    </figure>
  `).join("");

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
  return {
    ...emptyRecord().images,
    ...(images || {}),
    tattoos: Array.isArray(images?.tattoos) ? images.tattoos : []
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

function showMessage(text) {
  message.textContent = text;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
