const http = require("http");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const crypto = require("crypto");

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const RECORDS_FILE = path.join(DATA_DIR, "records.json");
const SECRET_FILE = path.join(DATA_DIR, "secret.txt");
const MAX_BODY_BYTES = 60 * 1024 * 1024;
const USE_MYSQL = Boolean(process.env.DB_HOST);
let dbPool = null;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

start().catch(error => {
  console.error(error);
  process.exit(1);
});

async function start() {
  await ensureDataFiles();
  await initializeDatabase();

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch(error => {
      console.error(error);
      sendJson(res, error.status || 500, { error: error.status ? error.message : "Server error" });
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`Inmate Profile server running at http://${HOST}:${PORT}`);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }

  await serveStatic(req, res, url);
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    const users = await getUsers();
    sendJson(res, 200, { hasUsers: users.length > 0 });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/users/first") {
    const users = await getUsers();
    if (users.length) {
      sendJson(res, 409, { error: "First user already exists" });
      return;
    }

    const body = await readBody(req);
    const user = await createUser(body.username, body.password, "admin");
    await insertUser(user);
    sendJson(res, 201, await loginPayload(user));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req);
    const users = await getUsers();
    const user = users.find(item => item.username.toLowerCase() === String(body.username || "").toLowerCase());

    if (!user || !verifyPassword(body.password || "", user.password)) {
      sendJson(res, 401, { error: "Invalid username or password" });
      return;
    }

    sendJson(res, 200, await loginPayload(user));
    return;
  }

  const currentUser = await authenticate(req);
  if (!currentUser) {
    sendJson(res, 401, { error: "Authentication required" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    sendJson(res, 200, { user: publicUser(currentUser) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/records") {
    sendJson(res, 200, { records: await getRecords() });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/records") {
    if (!canEditRecords(currentUser)) {
      sendJson(res, 403, { error: "Data Entry access required" });
      return;
    }

    const body = await readBody(req);
    const records = Array.isArray(body.records) ? body.records : [];
    await saveRecords(records);
    sendJson(res, 200, { records });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/users") {
    if (!canManageUsers(currentUser)) {
      sendJson(res, 403, { error: "Admin access required" });
      return;
    }

    const users = await getUsers();
    sendJson(res, 200, { users: users.map(publicUser) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/users") {
    if (!canManageUsers(currentUser)) {
      sendJson(res, 403, { error: "Admin access required" });
      return;
    }

    const body = await readBody(req);
    const users = await getUsers();
    const username = String(body.username || "").trim();

    if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
      sendJson(res, 409, { error: "That username already exists" });
      return;
    }

    const user = await createUser(username, body.password, normalizeRole(body.role));
    await insertUser(user);
    const updatedUsers = await getUsers();
    sendJson(res, 201, { user: publicUser(user), users: updatedUsers.map(publicUser) });
    return;
  }

  const userRoleMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/role$/);
  if (req.method === "PATCH" && userRoleMatch) {
    if (!canManageUsers(currentUser)) {
      sendJson(res, 403, { error: "Admin access required" });
      return;
    }

    const body = await readBody(req);
    const userId = userRoleMatch[1];
    const users = await getUsers();
    const targetUser = users.find(user => String(user.id) === userId);

    if (!targetUser) {
      sendJson(res, 404, { error: "User not found" });
      return;
    }

    const adminCount = users.filter(user => user.role === "admin").length;
    if (targetUser.role === "admin" && normalizeRole(body.role) !== "admin" && adminCount <= 1) {
      sendJson(res, 400, { error: "At least one admin user is required" });
      return;
    }

    await updateUserRole(userId, normalizeRole(body.role));
    const updatedUsers = await getUsers();
    sendJson(res, 200, { users: updatedUsers.map(publicUser) });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = path.normalize(path.join(ROOT, decodedPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await ensureJson(USERS_FILE, []);
  await ensureJson(RECORDS_FILE, defaultRecords());

  try {
    await fs.access(SECRET_FILE);
  } catch {
    await fs.writeFile(SECRET_FILE, crypto.randomBytes(48).toString("hex"), "utf8");
  }
}

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fsSync.existsSync(envPath)) return;

  const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function initializeDatabase() {
  if (!USE_MYSQL) {
    console.log("Using JSON file storage. Set DB_HOST to use MySQL.");
    return;
  }

  let mysql;
  try {
    mysql = require("mysql2/promise");
  } catch {
    throw new Error("MySQL is configured but mysql2 is not installed. Run: npm install");
  }

  dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    maxIdle: 10,
    idleTimeout: 60000
  });

  await dbPool.query("SELECT 1");
  console.log(`Using MySQL database ${process.env.DB_NAME} at ${process.env.DB_HOST}`);
}

async function getUsers() {
  if (!dbPool) return readJson(USERS_FILE, []);

  const [rows] = await dbPool.query(
    "SELECT id, username, role, password_hash AS password, created_at AS createdAt FROM users ORDER BY username"
  );
  return rows.map(row => ({
    ...row,
    id: String(row.id),
    createdAt: toIso(row.createdAt)
  }));
}

function canEditRecords(user) {
  return user?.role === "admin" || user?.role === "entry";
}

function canManageUsers(user) {
  return user?.role === "admin";
}

function normalizeRole(role) {
  return role === "admin" || role === "entry" || role === "readonly" ? role : "readonly";
}

async function insertUser(user) {
  if (!dbPool) {
    const users = await readJson(USERS_FILE, []);
    users.push(user);
    await writeJson(USERS_FILE, users);
    return;
  }

  const [result] = await dbPool.execute(
    "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
    [user.id, user.username, user.password, user.role, mysqlDateTime(user.createdAt)]
  );
  user.id = String(result.insertId);
}

async function updateUserRole(userId, role) {
  if (!dbPool) {
    const users = await readJson(USERS_FILE, []);
    const user = users.find(item => String(item.id) === String(userId));
    if (user) user.role = role;
    await writeJson(USERS_FILE, users);
    return;
  }

  await dbPool.execute("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
}

async function getRecords() {
  if (!dbPool) return readJson(RECORDS_FILE, defaultRecords());

  const [inmateRows] = await dbPool.query(`
    SELECT
      id, inmate_id AS inmateId, first_name AS firstName, middle_name AS middleName,
      last_name AS lastName, alias, dob, age, address, comment,
      gang_affiliation AS gangAffiliation, person_name AS personName, in_prison AS inPrison
    FROM inmates
    ORDER BY id
  `);

  if (!inmateRows.length) return defaultRecords();

  const [photoRows] = await dbPool.query("SELECT inmate_id AS inmateDbId, photo_type AS photoType, image_data AS imageData FROM inmate_photos");
  const [tattooRows] = await dbPool.query("SELECT inmate_id AS inmateDbId, image_data AS imageData FROM inmate_tattoos ORDER BY id");
  const photosByInmate = groupBy(photoRows, "inmateDbId");
  const tattoosByInmate = groupBy(tattooRows, "inmateDbId");

  return inmateRows.map(row => {
    const images = emptyImages();

    for (const photo of photosByInmate.get(row.id) || []) {
      if (photo.photoType === "front_face") images.frontFace = photo.imageData || "";
      if (photo.photoType === "right_face") images.rightFace = photo.imageData || "";
      if (photo.photoType === "left_face") images.leftFace = photo.imageData || "";
    }

    images.tattoos = (tattoosByInmate.get(row.id) || []).map(tattoo => tattoo.imageData || "");

    return {
      inmateId: row.inmateId || "",
      firstName: row.firstName || "",
      middleName: row.middleName || "",
      lastName: row.lastName || "",
      alias: row.alias || "",
      dob: mysqlDate(row.dob),
      age: row.age === null || row.age === undefined ? "" : String(row.age),
      address: row.address || "",
      comment: row.comment || "",
      gangAffiliation: row.gangAffiliation || "",
      personName: row.personName || "",
      inPrison: Boolean(row.inPrison),
      images
    };
  });
}

async function saveRecords(records) {
  if (!dbPool) {
    await writeJson(RECORDS_FILE, records);
    return;
  }

  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM inmates");

    for (const record of records) {
      const [result] = await connection.execute(`
        INSERT INTO inmates (
          inmate_id, first_name, middle_name, last_name, alias, dob, age, address,
          comment, gang_affiliation, person_name, in_prison
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        record.inmateId || "",
        record.firstName || "",
        record.middleName || "",
        record.lastName || "",
        record.alias || "",
        record.dob || null,
        record.age ? Number(record.age) : null,
        record.address || "",
        record.comment || "",
        record.gangAffiliation || "",
        record.personName || "",
        record.inPrison ? 1 : 0
      ]);

      const inmateDbId = result.insertId;
      const images = normalizeImages(record.images);
      await insertPhoto(connection, inmateDbId, "front_face", images.frontFace);
      await insertPhoto(connection, inmateDbId, "left_face", images.leftFace);
      await insertPhoto(connection, inmateDbId, "right_face", images.rightFace);

      for (const tattoo of images.tattoos) {
        if (!tattoo) continue;
        await connection.execute(
          "INSERT INTO inmate_tattoos (inmate_id, image_data, mime_type) VALUES (?, ?, ?)",
          [inmateDbId, tattoo, getMimeType(tattoo)]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function insertPhoto(connection, inmateDbId, photoType, imageData) {
  if (!imageData) return;

  await connection.execute(
    "INSERT INTO inmate_photos (inmate_id, photo_type, image_data, mime_type) VALUES (?, ?, ?, ?)",
    [inmateDbId, photoType, imageData, getMimeType(imageData)]
  );
}

async function ensureJson(filePath, value) {
  try {
    await fs.access(filePath);
  } catch {
    await writeJson(filePath, value);
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on("data", chunk => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

async function createUser(username, password, role) {
  username = String(username || "").trim();
  password = String(password || "");

  if (!username || password.length < 4) {
    const error = new Error("Username and password of at least 4 characters are required");
    error.status = 400;
    throw error;
  }

  return {
    id: USE_MYSQL ? null : crypto.randomUUID(),
    username,
    role,
    password: hashPassword(password),
    createdAt: new Date().toISOString()
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;

  const actual = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

async function authenticate(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const users = await getUsers();
  return users.find(user => user.id === payload.id) || null;
}

async function loginPayload(user) {
  return {
    token: await signToken({ id: user.id, username: user.username, role: user.role }),
    user: publicUser(user)
  };
}

async function signToken(payload) {
  const secret = await getSecret();
  const body = base64Url(JSON.stringify({ ...payload, exp: Date.now() + 12 * 60 * 60 * 1000 }));
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

async function verifyToken(token) {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const secret = await getSecret();
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

async function getSecret() {
  return fs.readFile(SECRET_FILE, "utf8");
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt
  };
}

function emptyImages() {
  return {
    frontFace: "",
    rightFace: "",
    leftFace: "",
    tattoos: []
  };
}

function normalizeImages(images) {
  return {
    ...emptyImages(),
    ...(images || {}),
    tattoos: Array.isArray(images?.tattoos) ? images.tattoos : []
  };
}

function groupBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(row);
  }
  return grouped;
}

function toIso(value) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

function mysqlDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mysqlDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function getMimeType(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);/);
  return match ? match[1] : "image/jpeg";
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function defaultRecords() {
  return [{
    inmateId: "2864",
    firstName: "Justin",
    middleName: "",
    lastName: "Goff",
    alias: "",
    dob: "1975-04-16",
    age: "51",
    address: "Mayflower Drive, Orange Walk",
    comment: "",
    gangAffiliation: "",
    personName: "",
    inPrison: false,
    images: {
      frontFace: "",
      rightFace: "",
      leftFace: "",
      tattoos: []
    }
  }];
}
