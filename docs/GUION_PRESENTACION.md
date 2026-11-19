# Guía breve para exponer

Duración sugerida: 2 o 3 minutos. No mostrar contraseñas ni el contenido de
`.env`.

## Integrante 1: problema y aplicación

> “Este proyecto permite consultar mediciones del río y relevamientos de los
> barrios. La página se comunica con un backend hecho con Node y Express.
> MongoDB guarda los datos principales, y las rutas protegidas requieren iniciar
> sesión.”

**Demostración:** mostrar la página en `http://localhost:5000/web` y ubicar
brevemente el panel de relevamientos.

## Integrante 2: Django, seguridad y pruebas

> “Integramos Django como servicio de reportes. Node le envía conteos agrupados
> por barrio, y Django calcula el porcentaje de casos críticos y los barrios
> prioritarios. La comunicación entre ambos está protegida con un token; además,
> las personas usuarias acceden con JWT y roles.”
>
> “Probamos los dos backends y medimos la cobertura para comprobar que las
> funciones principales respondan correctamente.”

**Demostración:** mostrar `http://127.0.0.1:8000/api/health/`, luego el resumen
calculado en el panel y, si alcanza el tiempo, ejecutar las pruebas.

## Cierre

> “Así combinamos Node, MongoDB y Django: Node gestiona la aplicación y sus
> datos; Django se ocupa de los reportes. En el README está el paso a paso para
> instalar y ejecutar el proyecto.”
