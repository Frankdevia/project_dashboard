const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'projects.json');
const LEADERS_FILE = path.join(__dirname, 'data', 'leaders.json');

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

app.listen(PORT, () => console.log(`Dashboard running on port ${PORT}`));
