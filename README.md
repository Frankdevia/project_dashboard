# Project Dashboard — Shared

Dashboard de avance de proyectos con datos compartidos para todo el equipo.

## Características

✅ **4 Vistas diferentes:**
- 📊 Dashboard con tarjetas y métricas
- 📅 Gantt Chart con línea de tiempo
- 👤 Vista por Líder con estadísticas y proyectos agrupados
- 👥 Gestión de líderes con fotos

✅ **Campos de proyecto:**
- Nombre, Líder, Dependencia, Descripción
- Porcentaje de progreso, Horas ahorradas
- Fechas de inicio y finalización

✅ **Filtros:**
- Por líder
- Por estado (Inicio, En progreso, Avanzado, Completado)

✅ **Gestión de líderes:**
- Agregar/eliminar líderes
- Subir fotos de perfil
- Las fotos aparecen en las tarjetas de proyectos

## Archivos
```
├── server.js          ← API + servidor estático (Express)
├── package.json
├── Dockerfile
├── public/
│   ├── index.html     ← Dashboard principal
│   ├── gantt.html     ← Vista Gantt Chart
│   ├── by-leader.html ← Vista por Líder
│   └── leaders.html   ← Administración de líderes
└── data/
    ├── projects.json  ← Datos de proyectos (persistente)
    ├── leaders.json   ← Datos de líderes (persistente)
    └── uploads/       ← Fotos de líderes (persistente)
```

## Deploy en EasyPanel

### Paso 1: Preparar el repositorio
1. Sube este proyecto a **GitHub**

### Paso 2: Configurar en EasyPanel
1. En EasyPanel → **New Project** → nombre: `project-dashboard`
2. **+ Service** → **App**
3. **Build** tab → conecta con GitHub → selecciona el repo
4. Build method: **Dockerfile** (se detecta automáticamente)

### Paso 3: Configurar persistencia de datos ⚠️ IMPORTANTE
**En la pestaña "Mounts" o "Volumes":**
- **Mount path:** `/app/data`
- **Size:** 1GB (o más si esperas muchas fotos)

Esto es CRÍTICO para que no pierdas:
- Los proyectos creados
- Los líderes registrados
- Las fotos subidas

### Paso 4: Deploy
1. Click **Deploy**
2. Espera a que termine el build
3. **Domains** tab → agrega tu dominio o usa el generado

### Paso 5: Instalar dependencias
Asegúrate de ejecutar:
```bash
npm install
```

Esto instalará:
- express
- multer (para subir fotos)

## API Endpoints

### Proyectos
| Método | Ruta                  | Descripción            |
|--------|-----------------------|------------------------|
| GET    | /api/projects         | Listar todos           |
| POST   | /api/projects         | Crear uno nuevo        |
| PATCH  | /api/projects/:id     | Actualizar por ID      |
| DELETE | /api/projects/:id     | Eliminar por ID        |

### Líderes
| Método | Ruta                     | Descripción            |
|--------|--------------------------|------------------------|
| GET    | /api/leaders             | Listar todos           |
| POST   | /api/leaders             | Crear uno nuevo        |
| PATCH  | /api/leaders/:id         | Actualizar por ID      |
| DELETE | /api/leaders/:id         | Eliminar por ID        |
| POST   | /api/leaders/:id/photo   | Subir foto (multipart) |

## Uso Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor
npm start

# Abrir en navegador
http://localhost:3000
```

## Auto-refresh

- El dashboard se sincroniza cada 15 segundos
- Los líderes se actualizan cada 30 segundos
- Cambios en tiempo real para todo el equipo

## Navegación

- **📊 Dashboard:** Vista principal con tarjetas de proyectos
- **📅 Gantt:** Línea de tiempo de proyectos con fechas
- **👤 Por Líder:** Proyectos agrupados por líder con estadísticas (total, completados, pendientes, promedio de avance)
- **👥 Líderes:** Administración de líderes y fotos
