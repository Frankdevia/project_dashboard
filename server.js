const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const READ_ONLY_TOKEN = process.env.READ_ONLY_TOKEN || '';

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

// ── Read-only middleware ──
// If a request carries the read-only token (via cookie or query param)
// and is attempting a write operation, block it.
app.use((req, res, next) => {
  if (!READ_ONLY_TOKEN) return next();
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.ro_token || req.query.token;
  if (token === READ_ONLY_TOKEN && req.method !== 'GET') {
    return res.status(403).json({ error: 'Modo solo lectura: no se permiten modificaciones.' });
  }
  next();
});
const DATA_FILE = path.join(__dirname, 'data', 'projects.json');
const LEADERS_FILE = path.join(__dirname, 'data', 'leaders.json');
const TAREAS_FILE = path.join(__dirname, 'data', 'tareas-rutinarias.json');
const CATEGORIAS_FILE = path.join(__dirname, 'data', 'categorias-tareas.json');

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

// ── Token verification ──
app.get('/api/check-token', (req, res) => {
  const { token } = req.query;
  if (!READ_ONLY_TOKEN) return res.json({ readOnly: false });
  res.json({ readOnly: token === READ_ONLY_TOKEN });
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
