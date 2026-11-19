# Guía de uso

## Iniciar la aplicación

La aplicación principal requiere MongoDB, Node y Django para que los resúmenes
integrados funcionen.

1. En la raíz del proyecto, crear `.env` desde `.env.example` y configurar
   `MONGO_URI`, `JWT_SECRET`, `DJANGO_SECRET_KEY` e `INTERNAL_API_TOKEN`.
2. Instalar dependencias de Node con `npm ci`.
3. En `django_backend`, crear un entorno virtual, instalar
   `requirements.txt` y ejecutar `python manage.py migrate`.
4. Crear el superusuario de Django una sola vez con
   `python manage.py createsuperuser`.
5. Iniciar MongoDB.
6. Abrir dos terminales:

   Terminal A, en la raíz:

   ```powershell
   npm run dev
   ```

   Terminal B, en `django_backend`:

   ```powershell
   .venv\Scripts\Activate.ps1
   python manage.py runserver 127.0.0.1:8000
   ```

7. Abrir http://localhost:5000/web.

## Recorrido de demostración

1. Iniciar sesión en la página con una cuenta de la aplicación Node.
2. Registrar un relevamiento o abrir el panel de relevamientos con una cuenta
   administradora.
3. Consultar el resumen o generar el informe. La página muestra la proporción
   de reportes críticos y el barrio prioritario, calculados por Django con las
   métricas recibidas de Node.
4. Detener Django y repetir la consulta: Node responde `503` para el resumen
   integrado, pero la página y otras rutas Node siguen disponibles. Reiniciar
   Django para restaurar el resumen.
5. Como recorrido separado, abrir http://127.0.0.1:8000/admin/ e iniciar sesión
   con el superusuario Django.

El umbral de 7 m es una regla del proyecto para clasificar registros; no es una
alerta oficial ni una instrucción de evacuación.

## Ayuda ante errores comunes

- **`npm` no encuentra `package.json`:** ejecutar comandos de Node desde la
  raíz `TPI`, no desde `django_backend`.
- **El resumen devuelve `503`:** comprobar que Django esté escuchando en el
  puerto 8000 y que ambos procesos lean el mismo `INTERNAL_API_TOKEN`.
- **MongoDB no conecta:** comprobar `MONGO_URI` y que MongoDB esté iniciado.
- **No se puede entrar a `/admin/`:** comprobar que se ejecutó
  `createsuperuser` en `django_backend`; ese usuario es distinto del de Node.

## Pruebas

Desde la raíz, `npm test` y `npm run test:coverage`. Desde `django_backend`,
con el entorno virtual activo, ejecutar:

```powershell
python -m coverage run --branch --source=api manage.py test
python -m coverage report --fail-under=85
```
