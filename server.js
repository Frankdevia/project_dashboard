const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'projects.json');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.listen(PORT, () => console.log(`Dashboard running on port ${PORT}`));
