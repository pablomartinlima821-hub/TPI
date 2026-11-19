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
├── postman/                       # Recursos de Postman
├── .postman/                      # Configuración del espacio de trabajo Postman
└── .vscode/                       # Configuración del editor para el proyecto
```

`node_modules/` contiene dependencias instaladas y no forma parte del código
fuente. `.env` contiene configuración local y no debe compartirse ni subirse al
control de versiones.

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
- Python 3.14 o una versión compatible con Django 6.
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
git clone <URL_DEL_REPOSITORIO>
cd TPI
```

También se puede descargar como ZIP desde GitHub, extraerlo y abrir una terminal
PowerShell dentro de la carpeta `TPI`.

No copiar ni subir el archivo `.env`: debe crearse nuevamente en cada máquina.

### 3. Instalar las dependencias de Node.js

Desde la raíz del proyecto:

```powershell
npm install
```

### 4. Configurar MongoDB y las variables de entorno

Crear un archivo `.env` en la raíz del proyecto con este contenido:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/tpi_relevamiento
PORT=5000
JWT_SECRET=cambiar-por-una-clave-secreta
EMAIL_USER=
EMAIL_PASS=
```

`MONGO_URI` es obligatoria. Las variables `EMAIL_USER` y `EMAIL_PASS` solo son
necesarias si se utiliza el envío de correos; pueden quedar vacías para probar
el resto de la aplicación.

Si se usa MongoDB Atlas, reemplazar `MONGO_URI` por la cadena de conexión
proporcionada por Atlas y permitir el acceso desde la dirección IP del equipo.

### 5. Iniciar MongoDB

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

### 6. Iniciar el servidor Node.js

Desde la raíz del proyecto:

```powershell
npm start
```

Para desarrollo con reinicio automático:

```powershell
npm run dev
```

El servidor debe quedar disponible en:

- Aplicación web: http://localhost:5000/web
- Comprobación del servidor: http://localhost:5000/

Para detener el servidor, presionar `Ctrl+C` en la terminal.

### 7. Instalar y iniciar Django

Django es un backend independiente que utiliza una base SQLite propia. Abrir una
segunda terminal, ingresar a la carpeta y crear un entorno virtual:

```powershell
cd C:\ruta\al\proyecto\TPI\django_backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Si PowerShell impide la activación del entorno virtual, habilitar temporariamente
la ejecución para la sesión:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\Activate.ps1
```

Crear las tablas y iniciar el servidor:

```powershell
python manage.py migrate
python manage.py runserver
```

La interfaz y los endpoints de Django estarán disponibles en:

- Panel administrativo: http://127.0.0.1:8000/admin/
- Estado de Django: http://127.0.0.1:8000/api/health/
- API de relevamientos: http://127.0.0.1:8000/api/relevamientos/

Para detener Django, presionar `Ctrl+C` en esa terminal.

### 8. Crear el usuario administrador de Django

Con el servidor detenido, desde `django_backend` y con el entorno virtual activo:

```powershell
python manage.py createsuperuser
```

Ingresar el nombre de usuario, el correo y la contraseña solicitados. Luego
volver a iniciar Django:

```powershell
python manage.py runserver
```

Abrir http://127.0.0.1:8000/admin/ e iniciar sesión con esos datos.

### 9. Ejecutar las pruebas

Desde la raíz del proyecto:

```powershell
npm test
```

Desde la carpeta `django_backend`, con el entorno virtual activo:

```powershell
python manage.py test
```
