# Guía de Configuración de EasyPanel - Persistencia de Datos

## Problema
Si los datos se borran cada vez que haces deploy, es porque el volumen no está configurado correctamente en EasyPanel.

## Solución: Configurar Volumen Persistente

### Paso 1: Acceder a la configuración del servicio
1. En EasyPanel, ve a tu proyecto `project-dashboard`
2. Haz clic en el servicio de la aplicación
3. Ve a la pestaña **"Mounts"** o **"Volumes"** (depende de la versión de EasyPanel)

### Paso 2: Crear el volumen (si no existe)
1. Busca la sección de **"Volumes"** o **"Persistent Storage"**
2. Haz clic en **"Add Volume"** o **"Create Volume"**
3. Configura:
   - **Name:** `project-data` (o el nombre que prefieras)
   - **Mount Path:** `/app/data` (DEBE ser exactamente esto)
   - **Size:** `1GB` (o más si planeas muchas fotos)

### Paso 3: Guardar y redesplegar
1. Haz clic en **"Save"** o **"Apply"**
2. **IMPORTANTE:** Haz un nuevo deploy para que los cambios tomen efecto
3. El volumen ahora persistirá entre deploys

## Verificación

### Opción 1: Desde la consola de EasyPanel
Si EasyPanel tiene una terminal/console:
```bash
# Verificar que el directorio existe
ls -la /app/data

# Verificar permisos
ls -ld /app/data

# Ver contenido
ls -la /app/data/uploads
```

### Opción 2: Crear un endpoint de diagnóstico
Agrega temporalmente este endpoint en `server.js` para verificar:

```javascript
// Agregar antes de la línea: app.listen(PORT, ...)
app.get('/api/debug/volume', (req, res) => {
  const fs = require('fs');
  const path = require('path');

  const dataDir = path.join(__dirname, 'data');
  const uploadsDir = path.join(dataDir, 'uploads');

  const check = {
    dataExists: fs.existsSync(dataDir),
    uploadsExists: fs.existsSync(uploadsDir),
    projectsExists: fs.existsSync(path.join(dataDir, 'projects.json')),
    leadersExists: fs.existsSync(path.join(dataDir, 'leaders.json')),
    uploadedFiles: fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : []
  };

  res.json(check);
});
```

Luego visita: `https://tu-dominio.com/api/debug/volume`

Deberías ver:
```json
{
  "dataExists": true,
  "uploadsExists": true,
  "projectsExists": true,
  "leadersExists": true,
  "uploadedFiles": ["photo1.jpg", "photo2.jpg"]
}
```

## Alternativa: Si EasyPanel no tiene UI para Volumes

Algunas versiones de EasyPanel usan Docker Compose. En ese caso:

1. Busca la configuración de **Docker Compose** en EasyPanel
2. Agrega la sección de volumes:

```yaml
services:
  app:
    # ... resto de configuración
    volumes:
      - project_data:/app/data

volumes:
  project_data:
    driver: local
```

## Solución de Problemas

### Los datos siguen borrándose
1. **Verifica el mount path:** DEBE ser exactamente `/app/data`
2. **Verifica que el volumen esté asociado al servicio correcto**
3. **Redeploy después de configurar** el volumen

### Error de permisos
Si ves errores de escritura:
```bash
# Desde la terminal del contenedor
chmod -R 755 /app/data
chown -R node:node /app/data
```

O modifica el Dockerfile agregando antes de `CMD`:
```dockerfile
RUN chown -R node:node /app/data
```

### El directorio data/ no existe después del deploy
El Dockerfile ya lo crea, pero puedes verificar agregando logs en `server.js`:

```javascript
// Al inicio del archivo, después de los requires
console.log('📁 Checking data directory...');
console.log('   Data dir exists:', fs.existsSync('./data'));
console.log('   Uploads dir exists:', fs.existsSync('./data/uploads'));
console.log('   Current working directory:', process.cwd());
```

## Migración de Datos (opcional)

Si ya tienes datos locales que quieres subir:

1. **Crear los datos localmente** (ejecuta `npm start` en tu máquina)
2. **Agregar proyectos y líderes** desde el navegador
3. **Copiar los archivos al servidor:**

   Opción A - Desde la terminal de EasyPanel:
   ```bash
   # Subir projects.json
   cat > /app/data/projects.json << 'EOF'
   [{"id":1,"name":"Proyecto 1",...}]
   EOF
   ```

   Opción B - Usar la API después del deploy:
   ```bash
   # Crear proyectos vía API
   curl -X POST https://tu-dominio.com/api/projects \
     -H "Content-Type: application/json" \
     -d '{"name":"Proyecto 1","leader":"Juan",...}'
   ```

## Confirmación Final

Una vez configurado correctamente:

1. ✅ Crea un proyecto de prueba
2. ✅ Haz un nuevo deploy
3. ✅ Verifica que el proyecto sigue ahí
4. ✅ Sube una foto a un líder
5. ✅ Haz otro deploy
6. ✅ Verifica que la foto sigue ahí

Si todos los pasos pasan, ¡el volumen está funcionando correctamente!

## Resumen de la Configuración

```
EasyPanel Settings:
├── Service: project-dashboard
├── Tab: Mounts / Volumes
└── Volume Configuration:
    ├── Mount Path: /app/data
    ├── Size: 1GB+
    └── Type: Persistent
```

**¡IMPORTANTE!** Siempre redeploy después de cambiar la configuración de volumes.
