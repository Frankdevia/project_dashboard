# Project Dashboard — Shared

Dashboard de avance de proyectos con datos compartidos para todo el equipo.

## Archivos
```
├── server.js          ← API + servidor estático (Express)
├── package.json
├── Dockerfile
├── public/
│   └── index.html     ← Dashboard frontend
└── data/
    └── projects.json  ← Se crea automáticamente (persistencia)
```

## Deploy en EasyPanel

1. Sube este repo a **GitHub**
2. En EasyPanel → **New Project** → nombre: `dashboard`
3. **+ Service** → **App**
4. **Build** tab → GitHub → selecciona el repo
5. Build method: **Dockerfile** (se detecta solo)
6. Click **Deploy**
7. **Domains** tab → agrega tu dominio o usa el generado
8. **IMPORTANTE**: En **Volumes** tab → agrega un volumen:
   - Mount path: `/app/data`
   - Esto persiste los datos entre re-deploys

## API endpoints

| Método | Ruta                  | Descripción            |
|--------|-----------------------|------------------------|
| GET    | /api/projects         | Listar todos           |
| POST   | /api/projects         | Crear uno nuevo        |
| PATCH  | /api/projects/:id     | Actualizar por ID      |
| DELETE | /api/projects/:id     | Eliminar por ID        |

## Auto-refresh

El dashboard se sincroniza automáticamente cada 15 segundos,
así que cuando alguien agrega o edita un proyecto, todos lo ven.
