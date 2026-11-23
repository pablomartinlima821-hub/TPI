const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app'); // Importamos la app directamente

describe('Pruebas de la API de Relevamiento', () => {
    
    it('El endpoint raíz debe devolver el estado de la API', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('API de Relevamiento Territorial funcionando');
    });

    it('La web se sirve por HTTP desde el mismo index', async () => {
        const res = await request(app).get('/web');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('id="map"');
        expect(res.text).toContain('tile.openstreetmap.org');
        expect(res.text).toContain('<link rel="stylesheet" href="/frontend.css">');
    });

    it('La hoja de estilos visuales se sirve por HTTP', async () => {
        const res = await request(app).get('/frontend.css');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('#dashboard-container');
    });

    it('CORS permite la preflight del login desde el navegador', async () => {
        const res = await request(app)
            .options('/api/auth/login')
            .set('Origin', 'null')
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'content-type');

        expect(res.statusCode).toEqual(204);
        expect(res.headers['access-control-allow-origin']).toBe('*');
        expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('El GET de relevamientos requiere una sesión válida', async () => {
        const res = await request(app).get('/api/relevamientos');
        expect(res.statusCode).toEqual(401);
        expect(res.body.mensaje).toMatch(/iniciar sesión/);
    });

    it('El resumen de relevamientos requiere sesión', async () => {
        const res = await request(app).get('/api/relevamientos/resumen');
        expect(res.statusCode).toEqual(401);
    });

    it('La consulta de usuarios requiere una sesión válida', async () => {
        const res = await request(app).get('/api/usuarios');
        expect(res.statusCode).toEqual(401);
    });

    it('La gestión de usuarios requiere rol de administrador', async () => {
        const token = jwt.sign(
            { id: '507f1f77bcf86cd799439011', email: 'usuario@example.com', rol: 'encuestador' },
            process.env.JWT_SECRET
        );
        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toEqual(403);
    });

    it('La actualización de usuarios rechaza datos inválidos antes de consultar la base', async () => {
        const token = jwt.sign(
            { id: '507f1f77bcf86cd799439011', email: 'admin@example.com', rol: 'admin' },
            process.env.JWT_SECRET
        );
        const res = await request(app)
            .patch('/api/usuarios/507f1f77bcf86cd799439012')
            .set('Authorization', `Bearer ${token}`)
            .send({ rol: 'superadmin' });
        expect(res.statusCode).toEqual(400);
        expect(res.body.mensaje).toMatch(/rol debe ser admin o encuestador/);
    });

    it('La eliminación de usuarios no permite borrar la propia cuenta', async () => {
        const id = '507f1f77bcf86cd799439011';
        const token = jwt.sign(
            { id, email: 'admin@example.com', rol: 'admin' },
            process.env.JWT_SECRET
        );
        const res = await request(app)
            .delete(`/api/usuarios/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toEqual(400);
        expect(res.body.mensaje).toMatch(/No puedes eliminar/);
    });

    it('La consulta de relevamientos requiere rol de administrador', async () => {
        const token = jwt.sign(
            { id: '507f1f77bcf86cd799439011', email: 'usuario@example.com', rol: 'encuestador' },
            process.env.JWT_SECRET
        );
        const res = await request(app)
            .get('/api/relevamientos')
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toEqual(403);
    });

    it('La consulta de barrios requiere una sesión válida', async () => {
        const res = await request(app).get('/api/barrios');
        expect(res.statusCode).toEqual(401);
    });

    it('La edición de barrios requiere rol de administrador', async () => {
        const token = jwt.sign(
            { id: '507f1f77bcf86cd799439011', email: 'usuario@example.com', rol: 'encuestador' },
            process.env.JWT_SECRET
        );
        const res = await request(app)
            .put('/api/barrios/puerto-costanera')
            .set('Authorization', 'Bearer ' + token)
            .send({
                nombre: 'Zona Puerto',
                ubicacion: 'Costanera',
                coordenadas: { lat: -29.14, lng: -59.27 }
            });
        expect(res.statusCode).toEqual(403);
    });

    it('La edición de barrios valida los datos antes de guardar', async () => {
        const token = jwt.sign(
            { id: '507f1f77bcf86cd799439011', email: 'admin@example.com', rol: 'admin' },
            process.env.JWT_SECRET
        );
        const res = await request(app)
            .put('/api/barrios/puerto-costanera')
            .set('Authorization', 'Bearer ' + token)
            .send({
                nombre: '',
                ubicacion: '',
                coordenadas: { lat: 0, lng: 0 }
            });
        expect(res.statusCode).toEqual(400);
        expect(res.body.mensaje).toMatch(/coordenadas válidas/);
    });

    it('El registro de relevamiento valida sus datos antes de guardar', async () => {
        const token = jwt.sign(
            { id: '507f1f77bcf86cd799439011', email: 'usuario@example.com' },
            process.env.JWT_SECRET
        );
        const res = await request(app)
            .post('/api/relevamientos')
            .set('Authorization', `Bearer ${token}`)
            .send({
                barrio: '',
                nivelRioParana: -1,
                coordenadas: { lat: 0, lng: 0 }
            });
        expect(res.statusCode).toEqual(400);
        expect(res.body.errores.length).toBeGreaterThan(0);
    });

    it('El login debe validar los datos antes de consultar usuarios', async () => {
        const res = await request(app).post('/api/auth/login').send({});
        expect(res.statusCode).toEqual(400);
        expect(res.body.mensaje).toBe('Ingresa tu correo electrónico y contraseña.');
    });

    it('El registro debe exigir una contraseña segura', async () => {
        const res = await request(app).post('/api/auth/registrar').send({
            nombre: 'Usuario',
            email: 'usuario@example.com',
            password: 'corta'
        });
        expect(res.statusCode).toEqual(400);
        expect(res.body.mensaje).toMatch(/al menos 8 caracteres/);
    });

});