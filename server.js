const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// ── In-memory sessions: token → { user } ──
const sessions = new Map();

// ── Parse cookies helper ──
function parseCookies(header = '') {
  return header.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return acc;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    acc[key] = val;
    return acc;
  }, {});
}

// ── Auth helper ──
function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.admin_session;
  return token ? sessions.get(token) : null;
}

// ── Write-protection middleware ──
// All non-GET requests require a valid admin session.
// /api/login is exempt (it's how you get a session).
app.use((req, res, next) => {
  if (req.method === 'GET') return next();
  if (req.path === '/api/login') return next();
  if (!getSession(req)) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión para realizar cambios.' });
  }
  next();
});
const DATA_FILE = path.join(__dirname, 'data', 'projects.json');
const LEADERS_FILE = path.join(__dirname, 'data', 'leaders.json');
const TAREAS_FILE = path.join(__dirname, 'data', 'tareas-rutinarias.json');
const CATEGORIAS_FILE = path.join(__dirname, 'data', 'categorias-tareas.json');
const LEADER_TASKS_FILE = path.join(__dirname, 'data', 'leader-tasks.json');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
if (!fs.existsSync(LEADERS_FILE)) {
  const defaultLeaders = [
    { id: '1', name: 'Jorge Agudelo', photo: null },
    { id: '2', name: 'Steven Solano', photo: null },
    { id: '3', name: 'Isaac Gomez', photo: null },
    { id: '4', name: 'Brian Escobar', photo: null }
  ];
  fs.writeFileSync(LEADERS_FILE, JSON.stringify(defaultLeaders, null, 2));
}
if (!fs.existsSync(TAREAS_FILE)) fs.writeFileSync(TAREAS_FILE, '[]');
if (!fs.existsSync(LEADER_TASKS_FILE)) fs.writeFileSync(LEADER_TASKS_FILE, '[]');
if (!fs.existsSync(CATEGORIAS_FILE)) {
  const defaultCats = [
    { id: 'cat1', name: 'Infraestructura' },
    { id: 'cat2', name: 'Seguridad' },
    { id: 'cat3', name: 'Monitoreo' },
    { id: 'cat4', name: 'Documentación' },
    { id: 'cat5', name: 'Soporte' },
    { id: 'cat6', name: 'Desarrollo' }
  ];
  fs.writeFileSync(CATEGORIAS_FILE, JSON.stringify(defaultCats, null, 2));
}

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'data', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(7);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Read projects
function readProjects() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// Write projects
function writeProjects(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Read leaders
function readLeaders() {
  try {
    return JSON.parse(fs.readFileSync(LEADERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// Write leaders
function writeLeaders(data) {
  fs.writeFileSync(LEADERS_FILE, JSON.stringify(data, null, 2));
}

// ── Auth endpoints ──

// POST /api/login
app.post('/api/login', (req, res) => {
  const { user, pass } = req.body;
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Login no configurado (define ADMIN_PASSWORD).' });
  if (user === ADMIN_USER && pass === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { user });
    res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; SameSite=Strict; HttpOnly`);
    res.json({ ok: true, name: user });
  } else {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.admin_session) sessions.delete(cookies.admin_session);
  res.setHeader('Set-Cookie', 'admin_session=; Path=/; Max-Age=0; SameSite=Strict; HttpOnly');
  res.json({ ok: true });
});

// GET /api/me
app.get('/api/me', (req, res) => {
  const session = getSession(req);
  if (session) {
    res.json({ admin: true, user: session.user });
  } else {
    res.json({ admin: false });
  }
});

// GET all projects
app.get('/api/projects', (req, res) => {
  res.json(readProjects());
});

// PUT replace all projects (full save)
app.put('/api/projects', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected array' });
  writeProjects(req.body);
  res.json({ ok: true, count: req.body.length });
});

// POST add one project
app.post('/api/projects', (req, res) => {
  const projects = readProjects();
  const p = req.body;
  if (!p.name) return res.status(400).json({ error: 'name required' });
  p.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  p.pct = Math.max(0, Math.min(100, Math.round(Number(p.pct) || 0)));
  p.hours = Math.max(0, Math.round(Number(p.hours) || 0));
  p.dep = p.dep || '';
  p.lider = p.lider || '';
  p.descripcion = p.descripcion || '';
  p.fechaInicio = p.fechaInicio || '';
  p.fechaFin = p.fechaFin || '';
  p.prioridad = ['alta', 'media', 'baja'].includes(p.prioridad) ? p.prioridad : 'media';
  projects.push(p);
  writeProjects(projects);
  res.json(p);
});

// PATCH update one project by id
app.patch('/api/projects/:id', (req, res) => {
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const updates = req.body;
  if (updates.name !== undefined) projects[idx].name = updates.name;
  if (updates.dep !== undefined) projects[idx].dep = updates.dep;
  if (updates.pct !== undefined) projects[idx].pct = Math.max(0, Math.min(100, Math.round(Number(updates.pct) || 0)));
  if (updates.hours !== undefined) projects[idx].hours = Math.max(0, Math.round(Number(updates.hours) || 0));
  if (updates.lider !== undefined) projects[idx].lider = updates.lider;
  if (updates.descripcion !== undefined) projects[idx].descripcion = updates.descripcion;
  if (updates.fechaInicio !== undefined) projects[idx].fechaInicio = updates.fechaInicio;
  if (updates.fechaFin !== undefined) projects[idx].fechaFin = updates.fechaFin;
  if (updates.prioridad !== undefined && ['alta', 'media', 'baja'].includes(updates.prioridad)) projects[idx].prioridad = updates.prioridad;
  writeProjects(projects);
  res.json(projects[idx]);
});

// DELETE one project by id
app.delete('/api/projects/:id', (req, res) => {
  let projects = readProjects();
  const len = projects.length;
  projects = projects.filter(p => p.id !== req.params.id);
  if (projects.length === len) return res.status(404).json({ error: 'not found' });
  writeProjects(projects);
  res.json({ ok: true });
});

// ── Leaders API ──

// GET all leaders
app.get('/api/leaders', (req, res) => {
  res.json(readLeaders());
});

// POST add leader
app.post('/api/leaders', (req, res) => {
  const leaders = readLeaders();
  const l = req.body;
  if (!l.name) return res.status(400).json({ error: 'name required' });
  l.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  l.photo = l.photo || null;
  leaders.push(l);
  writeLeaders(leaders);
  res.json(l);
});

// PATCH update leader
app.patch('/api/leaders/:id', (req, res) => {
  const leaders = readLeaders();
  const idx = leaders.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const updates = req.body;
  if (updates.name !== undefined) leaders[idx].name = updates.name;
  if (updates.photo !== undefined) leaders[idx].photo = updates.photo;
  writeLeaders(leaders);
  res.json(leaders[idx]);
});

// DELETE leader
app.delete('/api/leaders/:id', (req, res) => {
  let leaders = readLeaders();
  const len = leaders.length;
  leaders = leaders.filter(l => l.id !== req.params.id);
  if (leaders.length === len) return res.status(404).json({ error: 'not found' });
  writeLeaders(leaders);
  res.json({ ok: true });
});

// Upload leader photo
app.post('/api/leaders/:id/photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const leaders = readLeaders();
  const idx = leaders.findIndex(l => l.id === req.params.id);
  if (idx === -1) {
    fs.unlinkSync(req.file.path); // Delete uploaded file
    return res.status(404).json({ error: 'Leader not found' });
  }

  // Delete old photo if exists
  if (leaders[idx].photo) {
    const oldPath = path.join(__dirname, leaders[idx].photo);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  leaders[idx].photo = `/uploads/${req.file.filename}`;
  writeLeaders(leaders);
  res.json(leaders[idx]);
});

// ── Tareas Rutinarias API ──

function readTareas() {
  try { return JSON.parse(fs.readFileSync(TAREAS_FILE, 'utf8')); } catch { return []; }
}
function writeTareas(data) {
  fs.writeFileSync(TAREAS_FILE, JSON.stringify(data, null, 2));
}
function readCategorias() {
  try { return JSON.parse(fs.readFileSync(CATEGORIAS_FILE, 'utf8')); } catch { return []; }
}
function writeCategorias(data) {
  fs.writeFileSync(CATEGORIAS_FILE, JSON.stringify(data, null, 2));
}
function readLeaderTasks() {
  try { return JSON.parse(fs.readFileSync(LEADER_TASKS_FILE, 'utf8')); } catch { return []; }
}
function writeLeaderTasks(data) {
  fs.writeFileSync(LEADER_TASKS_FILE, JSON.stringify(data, null, 2));
}

// GET all tareas
app.get('/api/tareas-rutinarias', (req, res) => res.json(readTareas()));

// POST add tarea
app.post('/api/tareas-rutinarias', (req, res) => {
  const tareas = readTareas();
  const t = req.body;
  if (!t.nombre) return res.status(400).json({ error: 'nombre required' });
  t.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  t.categoria = t.categoria || '';
  t.encargado = t.encargado || '';
  t.expertisePoints = Math.max(1, Math.min(5, parseInt(t.expertisePoints) || 1));
  t.descripcion = t.descripcion || '';
  t.createdAt = new Date().toISOString();
  tareas.push(t);
  writeTareas(tareas);
  res.json(t);
});

// PUT update tarea
app.put('/api/tareas-rutinarias/:id', (req, res) => {
  const tareas = readTareas();
  const idx = tareas.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const u = req.body;
  if (u.nombre !== undefined) tareas[idx].nombre = u.nombre;
  if (u.categoria !== undefined) tareas[idx].categoria = u.categoria;
  if (u.encargado !== undefined) tareas[idx].encargado = u.encargado;
  if (u.expertisePoints !== undefined) tareas[idx].expertisePoints = Math.max(1, Math.min(5, parseInt(u.expertisePoints) || 1));
  if (u.descripcion !== undefined) tareas[idx].descripcion = u.descripcion;
  writeTareas(tareas);
  res.json(tareas[idx]);
});

// DELETE tarea
app.delete('/api/tareas-rutinarias/:id', (req, res) => {
  let tareas = readTareas();
  const len = tareas.length;
  tareas = tareas.filter(t => t.id !== req.params.id);
  if (tareas.length === len) return res.status(404).json({ error: 'not found' });
  writeTareas(tareas);
  res.json({ ok: true });
});

// GET categorias
app.get('/api/categorias-tareas', (req, res) => res.json(readCategorias()));

// POST add categoria
app.post('/api/categorias-tareas', (req, res) => {
  const cats = readCategorias();
  const c = req.body;
  if (!c.name) return res.status(400).json({ error: 'name required' });
  if (cats.find(x => x.name.toLowerCase() === c.name.toLowerCase()))
    return res.status(409).json({ error: 'already exists' });
  c.id = 'cat' + Date.now().toString(36);
  cats.push(c);
  writeCategorias(cats);
  res.json(c);
});

// DELETE categoria
app.delete('/api/categorias-tareas/:id', (req, res) => {
  let cats = readCategorias();
  const len = cats.length;
  cats = cats.filter(c => c.id !== req.params.id);
  if (cats.length === len) return res.status(404).json({ error: 'not found' });
  writeCategorias(cats);
  res.json({ ok: true });
});

// ── Leader Tasks API ──

app.get('/api/leader-tasks', (req, res) => res.json(readLeaderTasks()));

app.post('/api/leader-tasks', (req, res) => {
  const tasks = readLeaderTasks();
  const t = req.body;
  if (!t.nombre) return res.status(400).json({ error: 'nombre required' });
  t.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  t.descripcion = t.descripcion || '';
  t.estado = ['sin-iniciar', 'en-progreso', 'completada'].includes(t.estado) ? t.estado : 'sin-iniciar';
  t.createdAt = new Date().toISOString();
  tasks.push(t);
  writeLeaderTasks(tasks);
  res.json(t);
});

app.patch('/api/leader-tasks/:id', (req, res) => {
  const tasks = readLeaderTasks();
  const idx = tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const u = req.body;
  if (u.nombre !== undefined) tasks[idx].nombre = u.nombre;
  if (u.descripcion !== undefined) tasks[idx].descripcion = u.descripcion;
  if (u.estado !== undefined && ['sin-iniciar', 'en-progreso', 'completada'].includes(u.estado)) tasks[idx].estado = u.estado;
  writeLeaderTasks(tasks);
  res.json(tasks[idx]);
});

app.delete('/api/leader-tasks/:id', (req, res) => {
  let tasks = readLeaderTasks();
  const len = tasks.length;
  tasks = tasks.filter(t => t.id !== req.params.id);
  if (tasks.length === len) return res.status(404).json({ error: 'not found' });
  writeLeaderTasks(tasks);
  res.json({ ok: true });
});

// ── FreeScout tickets (via the FreeScout MCP server) ──
// FREESCOUT_MCP_URL     → Streamable HTTP endpoint of the MCP server (may carry the secret in its path)
// FREESCOUT_MCP_TOKEN   → optional bearer token sent as Authorization header
// FREESCOUT_MAILBOX     → only tickets from this mailbox are counted
// FREESCOUT_AGENTS      → comma-separated agent names; tickets of anyone else are ignored
const FREESCOUT_MCP_URL = process.env.FREESCOUT_MCP_URL || '';
const FREESCOUT_MCP_TOKEN = process.env.FREESCOUT_MCP_TOKEN || '';
const FS_MAILBOX = process.env.FREESCOUT_MAILBOX || 'Techsupport';
const FS_AGENTS = (process.env.FREESCOUT_AGENTS || 'Steven Solano,Jorge Agudelo,Isaac Gómez,Bryan Escobar,Emanuel Ríos Romero')
  .split(',').map(s => s.trim()).filter(Boolean);
const FS_TZ = process.env.FREESCOUT_TZ || 'America/Bogota';
const TICKETS_TTL_MS = (Number(process.env.FREESCOUT_CACHE_MINUTES) || 5) * 60 * 1000;
const TICKETS_TIMEOUT_MS = (Number(process.env.FREESCOUT_TIMEOUT_SECONDS) || 30) * 1000;
const MAX_RANGE_DAYS = 92; // limit of metricas_periodo
const UNASSIGNED = 'Sin asignar';

// Remove the MCP URL (it may carry the secret in its path/query) and the token from error text
function scrubSecrets(msg) {
  let out = String(msg || 'Error desconocido');
  const secrets = [FREESCOUT_MCP_URL, FREESCOUT_MCP_TOKEN];
  try {
    const u = new URL(FREESCOUT_MCP_URL);
    secrets.push(u.pathname, u.search, ...u.pathname.split('/').filter(seg => seg.length >= 12));
  } catch {}
  for (const sec of secrets) if (sec && sec.length > 3) out = out.split(sec).join('***');
  return out.slice(0, 300);
}

// Open one MCP session, run fn(call), close it. Fails after TICKETS_TIMEOUT_MS.
async function withFreescoutMcp(fn, timeoutMs = TICKETS_TIMEOUT_MS) {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const headers = FREESCOUT_MCP_TOKEN ? { Authorization: `Bearer ${FREESCOUT_MCP_TOKEN}` } : {};
  const transport = new StreamableHTTPClientTransport(new URL(FREESCOUT_MCP_URL), { requestInit: { headers } });
  const client = new Client({ name: 'project-dashboard', version: '1.0.0' });
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Sin respuesta del MCP en ${timeoutMs / 1000}s`)), timeoutMs);
  });
  const call = async (name, args = {}) => {
    const r = await client.callTool({ name, arguments: args });
    if (r.isError) throw new Error(`${name}: ${(r.content || []).map(c => c.text).join(' ')}`);
    if (r.structuredContent) return r.structuredContent.result ?? r.structuredContent;
    const text = (r.content || []).find(c => c.type === 'text')?.text;
    return JSON.parse(text);
  };
  const work = (async () => { await client.connect(transport); return fn(call); })();
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
    work.catch(() => {});
    await client.close().catch(() => {});
  }
}

// Small TTL cache with in-flight de-duplication and last-good fallback
const fsCache = new Map(); // key → { data, at, inflight }
async function cached(key, loader, force, ttl = TICKETS_TTL_MS) {
  const e = fsCache.get(key) || {};
  if (!force && e.data && Date.now() - e.at < ttl) return { data: e.data, at: e.at, stale: false };
  if (!e.inflight) {
    e.inflight = loader()
      .then(data => { e.data = data; e.at = Date.now(); })
      .finally(() => { e.inflight = null; });
    fsCache.set(key, e);
    // Bound memory: one entry per requested date range
    while (fsCache.size > 40) fsCache.delete(fsCache.keys().next().value);
  }
  try {
    await e.inflight;
    return { data: e.data, at: e.at, stale: false };
  } catch (err) {
    if (e.data) return { data: e.data, at: e.at, stale: true, error: err };
    throw err;
  }
}

// ── Date / stats helpers ──
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
function todayLocal() { return new Intl.DateTimeFormat('en-CA', { timeZone: FS_TZ }).format(new Date()); }
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
// FreeScout dates are "YYYY-MM-DD HH:MM" in server-local time; both ends share the zone, so treat as UTC
function hoursBetween(a, b) { return (Date.parse(b.replace(' ', 'T') + ':00Z') - Date.parse(a.replace(' ', 'T') + ':00Z')) / 3600000; }
function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function percentile(xs, p) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}
function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
function round1(x) { return x == null ? null : Math.round(x * 10) / 10; }
function normAgent(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
const agentKeys = new Map(FS_AGENTS.map(a => [normAgent(a), a]));

function periodStats(tickets, desde, hasta) {
  const inRange = d => d && d.slice(0, 10) >= desde && d.slice(0, 10) <= hasta;
  const nuevos = tickets.filter(t => inRange(t.creado)).length;
  const closed = tickets.filter(t => t.agent && t.estado === 'cerrado' && inRange(t.cerrado));
  const hrs = closed.map(t => hoursBetween(t.creado, t.cerrado)).filter(h => h >= 0);
  return {
    nuevos,
    cerrados: closed.length,
    cierre_mediana_h: round1(median(hrs)),
    cierre_promedio_h: round1(mean(hrs)),
    cierre_p90_h: round1(percentile(hrs, 90)),
    cerrados_24h_pct: hrs.length ? Math.round((hrs.filter(h => h <= 24).length / hrs.length) * 100) : null,
    _closed: closed,
  };
}

// ── Ticket list with pagination ──
// buscar_tickets returns at most 50 tickets per call and has no offset, but `antiguedad_minima_dias`
// (minimum age in days, closed tickets included) lets us walk backwards: after each page we ask
// again for tickets at least as old as the oldest one seen. Pages overlap a little (deduped by number)
// so that no ticket falls between two pages.
const LIST_PAGE = 50;
const LIST_MAX_PAGES = 80;
const LIST_MARGIN_DAYS = 30; // also catch older tickets that were closed inside the range

async function walkTickets(call, estado, stopBefore, today, out) {
  let minAge = 0, pages = 0, stalled = false;
  for (;;) {
    const r = await call('buscar_tickets', { buzon: FS_MAILBOX, estado, orden: 'recientes', limite: LIST_PAGE, antiguedad_minima_dias: minAge });
    const page = r.tickets || [];
    for (const t of page) out.set(t.numero, t);
    pages++;
    if (!r.hay_mas_resultados || !page.length) break;
    const oldest = page.reduce((m, t) => (t.creado < m ? t.creado : m), page[0].creado).slice(0, 10);
    if (stopBefore && oldest < stopBefore) break;
    if (pages >= LIST_MAX_PAGES) { stalled = true; break; }
    // Step back to the oldest day seen (minus one day of overlap); always advance at least one day
    const next = Math.max(minAge + 1, daysBetween(oldest, today) - 1);
    if (next === minAge + 1 && daysBetween(oldest, today) - 1 <= minAge) stalled = true; // > 50 tickets in ~2 days
    minAge = next;
  }
  return { pages, stalled };
}

async function fetchTicketList(needFrom) {
  return withFreescoutMcp(async call => {
    const today = todayLocal();
    const byNumber = new Map();
    const open = await walkTickets(call, 'abiertos', null, today, byNumber);          // every open ticket, any age
    const hist = await walkTickets(call, 'todos', needFrom, today, byNumber);         // history back to needFrom
    return {
      tickets: [...byNumber.values()],
      desde: needFrom,
      paginas: open.pages + hist.pages,
      parcial: open.stalled || hist.stalled,
    };
  }, 120 * 1000);
}

// One cached list; refetched deeper when a request needs older history than it covers
async function getTicketList(needFrom, force) {
  const e = fsCache.get('list');
  const have = e && e.data && e.data.desde;
  const deeper = have && needFrom < have;
  const from = have && !deeper ? have : needFrom;
  return cached('list', () => fetchTicketList(from), force || deeper);
}

// Keep only this mailbox and tickets that are unassigned or belong to the configured agents
function scopeTickets(raw) {
  return (raw.tickets || [])
    .filter(t => normAgent(t.buzon) === normAgent(FS_MAILBOX))
    .map(t => ({ ...t, agent: agentKeys.get(normAgent(t.responsable)) || null, unassigned: t.responsable === UNASSIGNED || !t.responsable }))
    .filter(t => t.agent || t.unassigned);
}
function ticketAge(t, today) { return t.dias_abierto != null ? t.dias_abierto : Math.max(0, daysBetween(t.creado.slice(0, 10), today)); }

// Range from ?desde&hasta — default = last 7 complete days, never in the future, at most MAX_RANGE_DAYS
function parseRange(q) {
  const today = todayLocal();
  let hasta = ISO_DAY.test(q.hasta || '') ? q.hasta : addDays(today, -1);
  let desde = ISO_DAY.test(q.desde || '') ? q.desde : addDays(hasta, -6);
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  if (hasta > today) hasta = today;
  if (desde > hasta) desde = hasta;
  if (daysBetween(desde, hasta) + 1 > MAX_RANGE_DAYS) desde = addDays(hasta, -(MAX_RANGE_DAYS - 1));
  return { today, desde, hasta };
}

// Monday-start weeks: 12 weeks ending with the week that contains `hasta`
const TREND_WEEKS = 12;
function dayOfWeek(iso) { return (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7; } // Mon=0 … Sun=6
function trendStart(hasta) { return addDays(addDays(hasta, -dayOfWeek(hasta)), -7 * (TREND_WEEKS - 1)); }
function minDate(a, b) { return a < b ? a : b; }
function weeklyTrend(tickets, hasta) {
  const lastMonday = addDays(hasta, -dayOfWeek(hasta));
  const firstMonday = addDays(lastMonday, -7 * (TREND_WEEKS - 1));
  const weeks = [];
  for (let i = 0; i < TREND_WEEKS; i++) {
    const ini = addDays(firstMonday, 7 * i), fin = addDays(ini, 6);
    const end = (fin > hasta ? hasta : fin) + ' 23:59';
    const inW = d => d && d.slice(0, 10) >= ini && d.slice(0, 10) <= fin && d.slice(0, 10) <= hasta;
    const closed = tickets.filter(t => t.agent && t.estado === 'cerrado' && inW(t.cerrado));
    weeks.push({
      semana: ini,
      parcial: fin > hasta,
      nuevos: tickets.filter(t => inW(t.creado)).length,
      cerrados: closed.length,
      cierre_mediana_h: round1(median(closed.map(t => hoursBetween(t.creado, t.cerrado)).filter(h => h >= 0))),
      // Open at the end of the week: created by then and not yet closed by then
      backlog: tickets.filter(t => t.creado <= end && !(t.estado === 'cerrado' && t.cerrado && t.cerrado <= end)).length,
    });
  }
  // Arrival heatmap over the same 12 weeks: [weekday][hour]
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const t of tickets) {
    const day = t.creado && t.creado.slice(0, 10);
    if (!day || day < firstMonday || day > hasta) continue;
    heat[dayOfWeek(day)][Number(t.creado.slice(11, 13)) || 0]++;
  }
  return { desde: firstMonday, hasta, semanas: weeks, mapa_calor: heat };
}

app.get('/api/tickets', async (req, res) => {
  if (!FREESCOUT_MCP_URL) return res.json({ configured: false });

  const { today, desde, hasta } = parseRange(req.query);
  const span = daysBetween(desde, hasta) + 1;
  const prevHasta = addDays(desde, -1), prevDesde = addDays(prevHasta, -(span - 1));
  const force = req.query.refresh === '1';

  const [listR, metR] = await Promise.allSettled([
    getTicketList(addDays(minDate(prevDesde, trendStart(hasta)), -LIST_MARGIN_DAYS), force),
    cached(`met:${desde}:${hasta}`, () => withFreescoutMcp(call =>
      call('metricas_periodo', { desde, hasta })), force),
  ]);

  // 200 on purpose: EasyPanel's proxy replaces 5xx bodies with its own HTML error page
  if (listR.status === 'rejected') {
    const detail = scrubSecrets(listR.reason && listR.reason.message);
    console.error('FreeScout MCP error:', detail);
    return res.json({ configured: true, error: 'No se pudo consultar FreeScout.', detail });
  }
  if (metR.status === 'rejected') console.error('FreeScout metricas_periodo error:', scrubSecrets(metR.reason && metR.reason.message));

  const raw = listR.value.data;
  const tickets = scopeTickets(raw);

  const open = tickets.filter(t => t.estado !== 'cerrado');
  const ageBuckets = [['< 1 día', 1], ['1-3 días', 3], ['3-7 días', 7], ['7-30 días', 30], ['> 30 días', Infinity]];
  const ageOf = t => ticketAge(t, today);
  const ahora = {
    abiertos: open.length,
    activos: open.filter(t => t.estado === 'activo').length,
    pendientes: open.filter(t => t.estado === 'pendiente').length,
    sin_responsable: open.filter(t => t.unassigned).length,
    mas_antiguo_dias: open.length ? Math.max(...open.map(ageOf)) : null,
    antiguedad: ageBuckets.map(([label, max], i) => ({
      label,
      count: open.filter(t => { const a = ageOf(t); return a < max && a >= (i ? ageBuckets[i - 1][1] : 0); }).length,
    })),
  };

  const cur = periodStats(tickets, desde, hasta);
  const prev = periodStats(tickets, prevDesde, prevHasta);

  const met = metR.status === 'fulfilled' ? metR.value.data : null;
  const metAgents = new Map(((met && met.por_agente) || []).map(a => [normAgent(a.name), a]));
  const por_agente = FS_AGENTS.map(name => {
    const mine = cur._closed.filter(t => t.agent === name);
    const hrs = mine.map(t => hoursBetween(t.creado, t.cerrado)).filter(h => h >= 0);
    const m = metAgents.get(normAgent(name)) || {};
    const mineOpen = open.filter(t => t.agent === name);
    return {
      name,
      abiertos: mineOpen.length,
      // Oldest first, without message content (buscar_tickets only returns metadata)
      tickets_abiertos: mineOpen
        .map(t => ({ numero: t.numero, asunto: t.asunto, estado: t.estado, creado: t.creado, dias: ageOf(t) }))
        .sort((x, y) => y.dias - x.dias),
      // Closed by this agent inside the range, most recent first
      tickets_cerrados: mine
        .map(t => ({ numero: t.numero, asunto: t.asunto, estado: 'cerrado', creado: t.creado, cerrado: t.cerrado, horas_cierre: round1(hoursBetween(t.creado, t.cerrado)) }))
        .sort((x, y) => y.cerrado.localeCompare(x.cerrado)),
      cerrados: mine.length,
      cierre_mediana_h: round1(median(hrs)),
      cierre_promedio_h: round1(mean(hrs)),
      respuestas: m.replies ?? null,
      primera_respuesta_mediana_min: m.frt_median_min ?? null,
    };
  });
  delete cur._closed; delete prev._closed;
  const tendencia = weeklyTrend(tickets, hasta);

  const at = Math.min(listR.value.at, metR.status === 'fulfilled' ? metR.value.at : Infinity);
  res.json({
    configured: true,
    stale: listR.value.stale || (metR.status === 'fulfilled' && metR.value.stale),
    fetchedAt: new Date(at).toISOString(),
    buzon: FS_MAILBOX,
    agentes: FS_AGENTS,
    hoy: today,
    rango: { desde, hasta, dias: span },
    rango_anterior: { desde: prevDesde, hasta: prevHasta },
    // true when the MCP may have capped the ticket list (old tickets might be missing)
    lista_parcial: !!raw.parcial,
    tickets_leidos: (raw.tickets || []).length,
    lista_desde: raw.desde,
    ahora,
    periodo: cur,
    periodo_anterior: prev,
    por_agente,
    primera_respuesta_disponible: !!met,
    tendencia,
  });
});

// ── Ticket detail ──
// Metadata comes from the cached (already public) ticket list. The conversation (message text,
// requester names) comes from leer_ticket and is only returned to a logged-in admin.
// Only tickets inside the dashboard scope (mailbox + configured agents or unassigned) can be read.
const FS_WEB_URL = (process.env.FREESCOUT_WEB_URL || '').replace(/\/+$/, '');
const detailCache = new Map(); // numero → { data, at }
const DETAIL_TTL_MS = 2 * 60 * 1000;

app.get('/api/tickets/detalle/:numero', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!FREESCOUT_MCP_URL) return res.json({ configured: false });
  const numero = Number(req.params.numero);
  if (!Number.isInteger(numero) || numero <= 0) return res.status(400).json({ error: 'Número de ticket inválido.' });

  const list = fsCache.get('list');
  const meta = list && list.data && list.data.tickets.find(t => t.numero === numero);
  const inScope = meta && normAgent(meta.buzon) === normAgent(FS_MAILBOX)
    && (agentKeys.has(normAgent(meta.responsable)) || meta.responsable === UNASSIGNED || !meta.responsable);
  if (!inScope) return res.status(404).json({ error: 'Este ticket no está dentro del alcance del dashboard.' });

  const today = todayLocal();
  const ticket = {
    ...meta,
    responsable: agentKeys.get(normAgent(meta.responsable)) || meta.responsable,
    dias_abierto: meta.estado === 'cerrado' ? null : (meta.dias_abierto ?? Math.max(0, daysBetween(meta.creado.slice(0, 10), today))),
    horas_cierre: meta.estado === 'cerrado' && meta.cerrado ? round1(hoursBetween(meta.creado, meta.cerrado)) : null,
  };
  const base = { configured: true, ticket, freescout_url: FS_WEB_URL ? `${FS_WEB_URL}/search?q=${numero}` : null };

  if (!getSession(req)) return res.json({ ...base, requiere_login: true, conversacion: null });

  try {
    let e = detailCache.get(numero);
    if (!e || req.query.refresh === '1' || Date.now() - e.at > DETAIL_TTL_MS) {
      const data = await withFreescoutMcp(call => call('leer_ticket', { numero, max_mensajes: 100 }));
      e = { data, at: Date.now() };
      detailCache.set(numero, e);
      while (detailCache.size > 100) detailCache.delete(detailCache.keys().next().value);
    }
    const d = e.data;
    const mensajes = (d.mensajes || []).slice().sort((x, y) => (x.fecha || '').localeCompare(y.fecha || ''));
    const firstUser = mensajes.find(m => m.tipo === 'usuario');
    const firstReply = mensajes.find(m => m.tipo === 'respuesta' && (!firstUser || (m.fecha || '') >= (firstUser.fecha || '')));
    res.json({
      ...base,
      conversacion: {
        asunto: d.asunto,
        estado: d.estado,
        solicitante: d.usuario || null,
        mensajes,
        total_mensajes: Math.max(meta.mensajes || 0, mensajes.length),
        primera_respuesta_h: firstUser && firstReply ? round1(hoursBetween(firstUser.fecha, firstReply.fecha)) : null,
        primera_respuesta_por: firstReply ? firstReply.autor : null,
      },
    });
  } catch (err) {
    const detail = scrubSecrets(err && err.message);
    console.error('FreeScout leer_ticket error:', detail);
    res.json({ ...base, conversacion: null, error: 'No se pudo leer la conversación.', detail });
  }
});

// ── Alarms: tickets without first reply, unanswered, unassigned, and slow to resolve ──
// "Slow" = open longer than FREESCOUT_ALARMA_DIAS (default 7) calendar days; critical after
// FREESCOUT_ALARMA_DIAS_CRITICO (default 30). No-first-reply / unanswered come from today's
// reporte_agentes (business hours, compared against its goals).
const ALARM_DAYS = Number(process.env.FREESCOUT_ALARMA_DIAS) || 7;
const ALARM_CRIT_DAYS = Number(process.env.FREESCOUT_ALARMA_DIAS_CRITICO) || 30;

app.get('/api/tickets/alarmas', async (req, res) => {
  if (!FREESCOUT_MCP_URL) return res.json({ configured: false });
  const today = todayLocal();
  const force = req.query.refresh === '1';
  const [listR, repR] = await Promise.allSettled([
    getTicketList(addDays(today, -1), force),
    cached(`rep:${today}`, () => withFreescoutMcp(call => call('reporte_agentes', { hasta: today })), force),
  ]);
  if (listR.status === 'rejected') {
    const detail = scrubSecrets(listR.reason && listR.reason.message);
    console.error('FreeScout alarmas error:', detail);
    return res.json({ configured: true, error: 'No se pudo consultar FreeScout.', detail });
  }
  if (repR.status === 'rejected') console.error('FreeScout reporte (alarmas) error:', scrubSecrets(repR.reason && repR.reason.message));

  const open = scopeTickets(listR.value.data).filter(t => t.estado !== 'cerrado');
  const base = t => ({ numero: t.numero, asunto: t.asunto, estado: t.estado, agente: t.agent || UNASSIGNED, dias: ticketAge(t, today), creado: t.creado });
  const demorados = open
    .filter(t => ticketAge(t, today) > ALARM_DAYS)
    .map(t => ({ ...base(t), severidad: ticketAge(t, today) > ALARM_CRIT_DAYS ? 'critica' : 'alta' }))
    .sort((a, b) => b.dias - a.dias);
  const sin_responsable = open.filter(t => t.unassigned)
    .map(t => ({ ...base(t), severidad: ticketAge(t, today) > 1 ? 'alta' : 'media' }))
    .sort((a, b) => b.dias - a.dias);

  const rep = repR.status === 'fulfilled' ? repR.value.data : null;
  const metas = rep && rep.metas_horas_laborales || null;
  const byNumber = new Map(open.map(t => [t.numero, t]));
  const fromReport = (key, metaH) => {
    const out = [];
    for (const a of (rep && rep.agentes) || []) {
      const name = agentKeys.get(normAgent(a.agente));
      if (!name) continue;
      for (const t of (a[key] && a[key].tickets) || []) {
        const known = byNumber.get(t.numero);
        out.push({
          numero: t.numero, asunto: t.asunto, estado: t.estado || (known && known.estado) || null, agente: name,
          dias: known ? ticketAge(known, today) : null, espera_horas_laborales: t.espera_horas_laborales ?? null,
          severidad: metaH != null && (t.espera_horas_laborales || 0) > metaH * 2 ? 'critica' : metaH != null && (t.espera_horas_laborales || 0) > metaH ? 'alta' : 'media',
        });
      }
    }
    return out.sort((a, b) => (b.espera_horas_laborales || 0) - (a.espera_horas_laborales || 0));
  };

  res.json({
    configured: true,
    fecha: today,
    stale: listR.value.stale || (repR.status === 'fulfilled' && repR.value.stale),
    umbral_dias: ALARM_DAYS,
    umbral_critico_dias: ALARM_CRIT_DAYS,
    metas,
    reporte_disponible: !!rep,
    sin_primera_respuesta: fromReport('sin_primera_respuesta', metas && metas.primera_respuesta),
    sin_contestar: fromReport('sin_contestar', metas && metas.respuestas_siguientes),
    sin_responsable,
    demorados,
  });
});

// ── Satisfaction ratings and business-hours goals (reporte_agentes) ──
// reporte_agentes only covers 7-day windows ending at `hasta`, so the range is covered with
// consecutive windows ending at the range end; the first one may start a few days before `desde`.
// It is not filtered by mailbox: it covers each agent's work in every mailbox.
function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter(x => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; });
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  });
  await Promise.all(workers);
  return out;
}

app.get('/api/tickets/calidad', async (req, res) => {
  if (!FREESCOUT_MCP_URL) return res.json({ configured: false });
  const { today, desde, hasta } = parseRange(req.query);
  const force = req.query.refresh === '1';

  // Window ends: hasta, hasta-7, … until a window reaches back to `desde`
  const ends = [];
  let end = hasta;
  do { ends.push(end); end = addDays(end, -7); } while (addDays(ends[ends.length - 1], -6) > desde);
  const yesterday = addDays(today, -1);

  let reports;
  try {
    reports = await mapLimit(ends, 4, end => cached(
      `rep:${end}`,
      () => withFreescoutMcp(call => call('reporte_agentes', { hasta: end })),
      force,
      // Closed past weeks barely change; keep them longer
      end < yesterday ? 6 * 60 * 60 * 1000 : TICKETS_TTL_MS,
    ));
  } catch (err) {
    const detail = scrubSecrets(err && err.message);
    console.error('FreeScout reporte_agentes error:', detail);
    return res.json({ configured: true, error: 'No se pudo consultar el reporte de agentes.', detail });
  }

  const data = reports.map(r => r.data);
  const latest = data[0];
  const blank = () => ({
    calificaciones: { excelente: 0, regular: 0, mala: 0 }, malas: [],
    primera: { cantidad: 0, fuera_de_meta: 0 }, siguientes: { cantidad: 0, fuera_de_meta: 0 },
    cerrados: 0, cerrados_sin_respuesta: 0, al_vuelo: 0, peores: [],
  });
  const byAgent = new Map(FS_AGENTS.map(n => [n, blank()]));

  for (const rep of data) {
    for (const a of rep.agentes || []) {
      const name = agentKeys.get(normAgent(a.agente));
      if (!name) continue;
      const acc = byAgent.get(name);
      const c = a.calificaciones || {};
      acc.calificaciones.excelente += c.excelente || 0;
      acc.calificaciones.regular += c.regular || 0;
      acc.calificaciones.mala += c.mala || 0;
      for (const m of c.detalle_malas || []) acc.malas.push({ ...m, agente: name });
      acc.primera.cantidad += a.primera_respuesta?.cantidad || 0;
      acc.primera.fuera_de_meta += a.primera_respuesta?.fuera_de_meta || 0;
      acc.siguientes.cantidad += a.respuestas_siguientes?.cantidad || 0;
      acc.siguientes.fuera_de_meta += a.respuestas_siguientes?.fuera_de_meta || 0;
      acc.cerrados += a.cerrados || 0;
      acc.cerrados_sin_respuesta += a.cerrados_sin_respuesta || 0;
      acc.al_vuelo += a.al_vuelo_registrados || 0;
      for (const w of a.primera_respuesta?.peores || []) acc.peores.push({ ...w, agente: name });
    }
  }

  const agentes = FS_AGENTS.map(name => {
    const a = byAgent.get(name);
    a.peores = a.peores.sort((x, y) => y.horas_laborales - x.horas_laborales).slice(0, 3);
    return { name, ...a };
  });
  const sum = f => agentes.reduce((s, a) => s + f(a), 0);

  // Open alarms come from the most recent window only (they describe the current state)
  const alarmas = { sin_contestar: [], sin_primera_respuesta: [] };
  for (const a of latest.agentes || []) {
    const name = agentKeys.get(normAgent(a.agente));
    if (!name) continue;
    for (const t of a.sin_contestar?.tickets || []) alarmas.sin_contestar.push({ ...t, agente: name });
    for (const t of a.sin_primera_respuesta?.tickets || []) alarmas.sin_primera_respuesta.push({ ...t, agente: name });
  }
  const byWait = (x, y) => (y.espera_horas_laborales || 0) - (x.espera_horas_laborales || 0);
  alarmas.sin_contestar.sort(byWait);
  alarmas.sin_primera_respuesta.sort(byWait);

  res.json({
    configured: true,
    stale: reports.some(r => r.stale),
    fetchedAt: new Date(Math.min(...reports.map(r => r.at))).toISOString(),
    rango: { desde, hasta },
    cobertura: { desde: addDays(ends[ends.length - 1], -6), hasta, semanas: ends.length },
    modulo_calificaciones: !!latest.modulo_calificaciones,
    metas: latest.metas_horas_laborales || null,
    jornada: latest.jornada || null,
    equipo: {
      calificaciones: {
        excelente: sum(a => a.calificaciones.excelente),
        regular: sum(a => a.calificaciones.regular),
        mala: sum(a => a.calificaciones.mala),
      },
      cerrados: sum(a => a.cerrados),
      primera: { cantidad: sum(a => a.primera.cantidad), fuera_de_meta: sum(a => a.primera.fuera_de_meta) },
      siguientes: { cantidad: sum(a => a.siguientes.cantidad), fuera_de_meta: sum(a => a.siguientes.fuera_de_meta) },
      cerrados_sin_respuesta: sum(a => a.cerrados_sin_respuesta),
      al_vuelo: sum(a => a.al_vuelo),
    },
    agentes,
    malas: uniqueBy(agentes.flatMap(a => a.malas), m => `${m.numero ?? m.ticket}:${m.agente}`),
    peores_primera: uniqueBy(agentes.flatMap(a => a.peores).sort((x, y) => y.horas_laborales - x.horas_laborales), w => w.numero).slice(0, 5),
    alarmas,
    alarmas_fecha: latest.generado || null,
  });
});

// Debug endpoint to verify volume persistence
app.get('/api/debug/volume', (req, res) => {
  const dataDir = path.join(__dirname, 'data');
  const uploadsDir = path.join(dataDir, 'uploads');

  const check = {
    workingDirectory: __dirname,
    dataDir: dataDir,
    dataExists: fs.existsSync(dataDir),
    uploadsExists: fs.existsSync(uploadsDir),
    projectsFileExists: fs.existsSync(DATA_FILE),
    leadersFileExists: fs.existsSync(LEADERS_FILE),
    projectsCount: readProjects().length,
    leadersCount: readLeaders().length,
    uploadedFiles: fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [],
    dataDirStats: fs.existsSync(dataDir) ? fs.statSync(dataDir) : null,
    timestamp: new Date().toISOString()
  };

  res.json(check);
});

app.listen(PORT, () => console.log(`Dashboard running on port ${PORT}`));
