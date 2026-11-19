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

## Desarrollo local

Requiere Node.js y una instancia de MongoDB accesible. Las variables de entorno
se configuran en `.env`; el servidor utiliza `MONGO_URI` y puede utilizar
`PORT`, `JWT_SECRET`, `EMAIL_USER` y `EMAIL_PASS` según la funcionalidad.

```bash
npm install
npm run dev
```

Para ejecutar las pruebas:

```bash
npm test
```

El servidor usa el puerto `5000` si no se define `PORT`. La interfaz se sirve en
`/web`.
