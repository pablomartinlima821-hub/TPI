# Monitoreo Territorial de Goya

Aplicación web para consultar mediciones del río Paraná en la estación Goya y
registrar relevamientos territoriales con información de barrios, coordenadas,
personas afectadas y necesidades.

## Estructura del proyecto

```text
TPI/
├── app.js                         # Configura Express, middleware y rutas
├── server.js                      # Carga configuración, conecta servicios e inicia
├── index.html                     # Interfaz web y lógica del navegador
├── frontend.css                   # Estilos propios de la interfaz
├── controllers/                   # Controladores del río y de barrios
├── models/                        # Modelos de MongoDB del río y de barrios
├── routes/                        # Rutas de la API del río y de barrios
├── services/                      # Consulta y sincronización de datos del río
├── Pruebas/                       # Pruebas del proyecto principal
├── relevamiento_territorial/      # Módulo de autenticación y relevamientos
│   ├── config/                    # Configuración de la base de datos
│   ├── controllers/               # Controladores de usuarios y relevamientos
│   ├── middlewares/               # Autenticación, roles y validaciones
│   ├── models/                    # Modelos de usuarios y relevamientos
│   ├── routes/                    # Rutas de autenticación y relevamientos
│   ├── Servicios/                 # Reglas de negocio del relevamiento
│   └── Pruebas/                   # Pruebas de la API de relevamientos
├── django_backend/                # Backend Django independiente
├── postman/                       # Recursos de Postman
├── .postman/                      # Configuración del espacio de trabajo Postman
└── .vscode/                       # Configuración del editor para el proyecto
```

`node_modules/` contiene dependencias instaladas y no forma parte del código
fuente. `.env` contiene configuración local y no debe compartirse ni subirse al
control de versiones. `.env.example` documenta las variables necesarias sin
incluir credenciales reales.

Node.js y MongoDB son la fuente principal de los datos de la aplicación. Django
se integra como servicio de reportes: Node envía métricas agregadas y Django
calcula indicadores para el panel. El flujo no duplica datos personales ni
relevamientos en la base SQLite.

La arquitectura y el recorrido de presentación están en
[docs/ARQUITECTURA.md](./docs/ARQUITECTURA.md) y
[docs/GUION_PRESENTACION.md](./docs/GUION_PRESENTACION.md). El uso de la
aplicación está descrito en [docs/GUIA_USUARIO.md](./docs/GUIA_USUARIO.md).

## Recorrido para entender el código

1. Comenzar por `server.js` para ver cómo se inicia el servidor.
2. Continuar con `app.js` para ubicar las rutas de la API y las páginas web.
3. Seguir cada ruta hacia su controlador y, cuando corresponda, hacia el modelo
   o servicio asociado.
4. Consultar `index.html` para la interfaz y la comunicación con la API.
5. Revisar las pruebas en `Pruebas/` y
   `relevamiento_territorial/Pruebas/` para conocer comportamientos verificados.

El directorio `relevamiento_territorial/` agrupa el flujo de usuarios y
relevamientos; el resto de los directorios principales reúne las funciones de
monitoreo del río y administración de barrios.

Los administradores pueden quitar barrios mal cargados de la lista. La baja es
lógica para evitar que un barrio vuelva a aparecer por la importación automática
de relevamientos; los relevamientos históricos asociados no se eliminan. También
pueden marcar cada barrio como crítico, estable o sin datos desde su formulario
de edición.
Los barrios nuevos comienzan como “sin datos”, y los cambios de situación
registran fecha, administrador y motivo. Esa situación se refleja también en
los puntos del mapa del panel de relevamientos, sincronizado cada minuto mientras
permanece abierto. Al cargar un relevamiento se puede usar el nivel más reciente
guardado desde Prefectura o ingresar uno manualmente. Los administradores pueden
seguir cada reporte como pendiente, en atención o resuelto. La clasificación de
evacuación usa el umbral de 7 m definido por el proyecto; no es una alerta oficial
ni modifica automáticamente la situación manual de los barrios.

## Ejecutar el proyecto en otra computadora

Las instrucciones siguientes corresponden a Windows y permiten iniciar tanto el
backend principal de Node.js como el backend Django.

### 1. Instalar los programas necesarios

Instalar:

- Git.
- Node.js 24 o una versión compatible.
- Python 3.12 o posterior, compatible con Django 6.
- MongoDB Community Server.

Comprobar las instalaciones desde PowerShell:

```powershell
git --version
node --version
npm --version
python --version
mongod --version
```

Si `mongod --version` no funciona porque MongoDB no está en el `PATH`, iniciar
MongoDB desde su aplicación o servicio de Windows antes de continuar.

### 2. Obtener el proyecto

Si el proyecto está publicado en GitHub:

```powershell
git clone --recurse-submodules https://github.com/pablomartinlima821-hub/TPI.git TPI
Set-Location TPI
```

La opción `--recurse-submodules` descarga el módulo
`relevamiento_territorial`, que contiene parte del backend Node. Si ya se había
clonado sin esa opción, ejecutar `git submodule update --init --recursive`.

No copiar ni subir el archivo `.env`: debe crearse nuevamente en cada máquina.

### 3. Instalar las dependencias de Node.js

Desde la raíz del proyecto:

```powershell
npm ci
```

### 4. Configurar las variables de entorno

Crear el archivo local a partir de la plantilla:

```powershell
Copy-Item .env.example .env
```

Editar `.env` y reemplazar los valores de ejemplo por secretos aleatorios. En
particular, `INTERNAL_API_TOKEN` debe conservar el mismo valor para Node y
Django. `DJANGO_REPORTS_URL` se puede dejar como está para desarrollo local.
No compartir ni subir este archivo.

Para recuperar contraseñas, crear una clave API en Brevo y verificar allí la
dirección remitente. Configurar `BREVO_API_KEY` con la clave y `EMAIL_FROM` con
esa dirección. El envío se realiza por HTTPS, compatible con el plan gratuito
de Render. No subir la clave al repositorio.

### 5. Iniciar MongoDB

Si se usa MongoDB Atlas, reemplazar `MONGO_URI` por la cadena de conexión
proporcionada por Atlas y permitir el acceso desde la dirección IP del equipo.

Con MongoDB instalado como servicio, puede iniciarse desde PowerShell como
administrador:

```powershell
Start-Service MongoDB
```

Verificar que el servicio esté activo:

```powershell
Get-Service MongoDB
```

También se puede iniciar MongoDB desde MongoDB Compass o desde el método usado
durante el desarrollo del proyecto.

### 6. Preparar e iniciar Django

En una terminal:

```powershell
Set-Location "C:\ruta\al\proyecto\TPI\django_backend"
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 127.0.0.1:8000
```

`createsuperuser` se ejecuta una sola vez. Si PowerShell bloquea la activación
del entorno virtual, ejecutar `Set-ExecutionPolicy -Scope Process Bypass` y
volver a activar `.venv`.

### 7. Iniciar el servidor Node.js

Desde la raíz del proyecto:

```powershell
npm run dev
```

Para iniciar el modo normal en lugar del modo de desarrollo:

```powershell
npm start
```

El servidor debe quedar disponible en:

- Aplicación web: http://localhost:5000/web
- Comprobación del servidor: http://localhost:5000/
- Comprobación Django: http://127.0.0.1:8000/api/health/

Para el resumen integrado, mantener ambos servidores ejecutándose en terminales
separadas. Node seguirá atendiendo la página si Django se detiene, pero el
endpoint de resumen responderá `503` hasta que Django vuelva a estar disponible.

### 8. Probar el panel de Django

El superusuario creado en el paso de preparación es independiente de las
cuentas de Node. Iniciar sesión en:

- Panel administrativo: http://127.0.0.1:8000/admin/
- Estado de Django: http://127.0.0.1:8000/api/health/

La ruta interna `POST /api/internal/reportes/resumen/` requiere el encabezado
`X-Internal-Token`; solo Node debe invocarla. El token no se incluye en el
frontend ni en el repositorio.

El CRUD autónomo de `/api/relevamientos/` de Django es una API de demostración
que guarda en `django_backend/db.sqlite3`; la página principal no la consume.
Para el flujo integrado, la fuente oficial es MongoDB y Django procesa solo las
métricas que Node le envía.

### 9. Ejecutar pruebas y medir cobertura

Desde la raíz del proyecto:

```powershell
npm test
npm run test:coverage
```

Desde `django_backend`, con el entorno virtual activo:

```powershell
python -m coverage run --branch --source=api manage.py test
python -m coverage report --fail-under=85
```

Jest aplica umbrales mínimos globales de 65% de sentencias, 45% de ramas,
70% de funciones y 68% de líneas. Los resultados detallados se generan
localmente y no se suben al repositorio.

## Desplegar en Render

El repositorio incluye `render.yaml` para crear dos servicios web:

- `tpi-node`: aplicación Express y frontend.
- `tpi-django`: API de reportes y panel administrativo.

Requisitos previos:

1. Crear una base MongoDB en MongoDB Atlas.
2. Permitir conexiones desde Render y guardar la URI de Atlas.
3. Subir el proyecto a GitHub.
4. En Render, elegir **New > Blueprint** y conectar el repositorio.

Durante la configuración, completar manualmente:

- `MONGO_URI` en `tpi-node` con la URI de MongoDB Atlas.
- `DJANGO_ALLOWED_HOSTS` en `tpi-django` con el hostname público de Django,
  por ejemplo `tpi-django.onrender.com`.
- `DJANGO_CORS_ALLOWED_ORIGINS` en `tpi-django` con la URL pública completa de
  Node, por ejemplo `https://tpi-node.onrender.com`.
- `DJANGO_REPORTS_URL` en `tpi-node` con la URL interna pública de Django,
  por ejemplo `https://tpi-django.onrender.com/api/internal/reportes/resumen/`.
- `BREVO_API_KEY` en `tpi-node` con una clave API de Brevo.
- `EMAIL_FROM` en `tpi-node` con la dirección de remitente verificada en Brevo.

Render genera automáticamente las claves `JWT_SECRET`, `DJANGO_SECRET_KEY` y
`INTERNAL_API_TOKEN`. El último se comparte entre Node y Django.
