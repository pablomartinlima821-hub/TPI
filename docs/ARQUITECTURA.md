# Arquitectura técnica

## Responsabilidades

- **Node.js y Express** alojan la interfaz, validan las operaciones de usuarios,
  barrios, río y relevamientos, y acceden a MongoDB mediante Mongoose. MongoDB
  es la fuente de verdad de la página principal.
- **Django REST Framework** calcula indicadores de reportes. No recibe
  credenciales de los usuarios ni guarda una copia de las métricas del flujo
  integrado.
- **SQLite de Django** se conserva para el CRUD autónomo de demostración
  `/api/relevamientos/` y para los usuarios del panel Django. Esa API no es la
  fuente de datos de la página Node y no sincroniza sus registros con MongoDB.

## Flujo integrado del resumen

```text
Navegador
  └─ GET /api/relevamientos/resumen + JWT de administrador
       └─ Express valida rol y filtros
            └─ MongoDB agrupa métricas por barrio
                 └─ POST /api/internal/reportes/resumen/
                      + X-Internal-Token (solo servidor)
                      └─ Django valida, calcula porcentaje y prioridad
                           └─ Express devuelve el resumen al navegador
```

El frontend sigue hablando únicamente con Node. Node aplica los filtros y
envía a Django cantidades agregadas por barrio y el identificador de barrio y
fecha del último reporte. No envía nombres, correos, coordenadas ni
observaciones. Django devuelve:

- total de relevamientos;
- cantidad y porcentaje de críticos según el umbral del proyecto (7 m);
- personas afectadas;
- último relevamiento;
- hasta cinco barrios prioritarios ordenados por personas afectadas y cantidad
  de críticos.

El endpoint interno requiere `INTERNAL_API_TOKEN`, se compara en tiempo
constante y no se expone en el código del navegador. La configuración se carga
desde el `.env` de la raíz en ambos servicios. Si falta el token o Django no
está disponible, Node informa un error `503`/`502`; no inventa un resumen.

## Organización y patrones

- Node usa **rutas → controladores → modelos/servicios**. Los controladores
  orquestan la petición; `services/djangoReportService.js` encapsula la llamada
  HTTP a Django.
- Django usa **vistas → serializers → permisos** de Django REST Framework. El
  serializer valida las métricas recibidas antes de calcularlas.
- La integración es una API REST interna con contrato JSON. Los servicios
  conservan responsabilidades separadas y solo comparten el token de servicio.

## Rutas relevantes

| Servicio | Ruta | Acceso |
| --- | --- | --- |
| Node | `GET /web` | Página web |
| Node | `GET /api/relevamientos/resumen` | JWT de administrador; integra con Django |
| Node | `GET/POST /api/relevamientos` | JWT según rol |
| Node | `GET /api/usuarios`, `GET /api/usuarios/:id` | JWT de administrador |
| Node | `PATCH /api/usuarios/:id`, `DELETE /api/usuarios/:id` | JWT de administrador |
| Django | `GET /api/health/` | Pública; verificación de disponibilidad |
| Django | `POST /api/internal/reportes/resumen/` | Token interno Node→Django |
| Django | `/admin/` | Usuario superadministrador Django |
| Django | `/api/relevamientos/` | CRUD autónomo de demostración; SQLite |

Las cuentas de Node (JWT/MongoDB) y el superusuario de Django son identidades
separadas. Crear una cuenta en uno no crea una cuenta en el otro.
El registro de cuentas continúa disponible en `POST /api/auth/registrar`.
La gestión de usuarios permite actualizar nombre, correo, rol y contraseña; las
contraseñas nunca se devuelven en las respuestas. La eliminación es permanente
y no permite que un administrador borre su propia cuenta desde esta API. Los
registros nuevos tienen rol `encuestador`; el proyecto no crea un administrador
inicial por API, por lo que la primera cuenta administradora debe configurarse
directamente en MongoDB.

## Variables de entorno

Ver [`.env.example`](../.env.example). `INTERNAL_API_TOKEN` debe ser el mismo
valor para ambos procesos; el archivo `.env` real se mantiene local y no se
versiona. `DJANGO_REPORTS_URL` permite cambiar el destino del servicio sin
modificar código.

## Repositorio

`relevamiento_territorial` es un submódulo Git con URL declarada en
`.gitmodules`. Para descargarlo junto con el proyecto se usa
`git clone --recurse-submodules`. Al actualizar la referencia del submódulo,
se debe registrar el nuevo commit en el repositorio principal.
