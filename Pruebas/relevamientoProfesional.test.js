const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../relevamiento_territorial/models/Usuario', () => ({
    findById: jest.fn()
}));

jest.mock('../models/MedicionRio', () => ({
    findOne: jest.fn()
}));

jest.mock('../models/Barrio', () => ({
    find: jest.fn()
}));

jest.mock('../relevamiento_territorial/models/Relevamiento', () => {
    const Relevamiento = jest.fn(function (datos) {
        Object.assign(this, datos);
    });
    Relevamiento.prototype.save = jest.fn();
    Relevamiento.findByIdAndUpdate = jest.fn();
    Relevamiento.aggregate = jest.fn();
    Relevamiento.findOne = jest.fn();
    return Relevamiento;
});

jest.mock('../services/djangoReportService', () => ({
    generarResumenTerritorial: jest.fn()
}));

const Usuario = require('../relevamiento_territorial/models/Usuario');
const MedicionRio = require('../models/MedicionRio');
const Barrio = require('../models/Barrio');
const Relevamiento = require('../relevamiento_territorial/models/Relevamiento');
const { generarResumenTerritorial } = require('../services/djangoReportService');
const app = require('../app');
const { evaluarRiesgoEvacuacion } = require('../relevamiento_territorial/Servicios/relevamientoServicio');
const {
    crearRegistro,
    obtenerResumen,
    actualizarSeguimiento
} = require('../relevamiento_territorial/controllers/surveyController');

const respuesta = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
});

describe('Mejoras profesionales de relevamientos', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        generarResumenTerritorial.mockReset();
        Usuario.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({ nombre: 'Encuestador', email: 'campo@example.com' })
        });
        Barrio.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([])
        });
        Relevamiento.prototype.save.mockResolvedValue();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('guarda el nivel de río actual de Prefectura en el nuevo relevamiento', async () => {
        const fechaMedicion = new Date('2026-11-19T03:00:00.000Z');
        MedicionRio.findOne.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({
                estacion: 'GOYA',
                alturaMetros: 5.72,
                fechaMedicion
            })
        });
        const res = respuesta();

        await crearRegistro({
            usuarioAutenticado: { id: 'usuario-id' },
            body: {
                barrio: 'Zona Puerto',
                nivelRioParana: 4.9,
                nivelRioOrigen: 'prefectura',
                coordenadas: { lat: -29.14, lng: -59.27 }
            }
        }, res);

        expect(MedicionRio.findOne).toHaveBeenCalledWith({ estacion: 'GOYA' });
        expect(Relevamiento.mock.instances[0].nivelRioParana).toBe(5.72);
        expect(Relevamiento.mock.instances[0].nivelRioOrigen).toBe('prefectura');
        expect(Relevamiento.mock.instances[0].fechaMedicionRio).toBe(fechaMedicion);
        expect(Relevamiento.mock.instances[0].estadoEvacuacion).toBe(false);
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('aplica el umbral de evacuación de 7 metros, incluido el límite', () => {
        expect(evaluarRiesgoEvacuacion(6.99)).toBe(false);
        expect(evaluarRiesgoEvacuacion(7)).toBe(true);
    });

    it('rechaza un estado de seguimiento fuera de las opciones permitidas', async () => {
        const res = respuesta();

        await actualizarSeguimiento({
            params: { id: '507f1f77bcf86cd799439011' },
            body: { estadoSeguimiento: 'desconocido' }
        }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(Relevamiento.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('registra el cambio de seguimiento y el administrador que lo hizo', async () => {
        Relevamiento.findByIdAndUpdate.mockReturnValue({
            lean: () => Promise.resolve({ estadoSeguimiento: 'en-seguimiento' })
        });
        const res = respuesta();

        await actualizarSeguimiento({
            params: { id: '507f1f77bcf86cd799439011' },
            body: { estadoSeguimiento: 'en-seguimiento' },
            usuarioAutenticado: { id: 'admin-id', email: 'admin@example.com' }
        }, res);

        expect(Relevamiento.findByIdAndUpdate).toHaveBeenCalledWith(
            '507f1f77bcf86cd799439011',
            {
                $set: expect.objectContaining({
                    estadoSeguimiento: 'en-seguimiento',
                    seguimientoActualizadoPor: { id: 'admin-id', email: 'admin@example.com' }
                })
            },
            { new: true, runValidators: true }
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('solo permite a administradores cambiar el seguimiento', async () => {
        const token = jwt.sign(
            { id: 'usuario-id', email: 'campo@example.com', rol: 'encuestador' },
            process.env.JWT_SECRET
        );

        const response = await request(app)
            .patch('/api/relevamientos/507f1f77bcf86cd799439011/seguimiento')
            .set('Authorization', `Bearer ${token}`)
            .send({ estadoSeguimiento: 'resuelto' });

        expect(response.statusCode).toBe(403);
        expect(Relevamiento.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('solo permite a administradores consultar el resumen', async () => {
        const token = jwt.sign(
            { id: 'usuario-id', email: 'campo@example.com', rol: 'encuestador' },
            process.env.JWT_SECRET
        );

        const response = await request(app)
            .get('/api/relevamientos/resumen')
            .set('Authorization', `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
        expect(generarResumenTerritorial).not.toHaveBeenCalled();
    });

    it('no autentica tokens si falta la clave del servidor', async () => {
        const token = jwt.sign(
            { id: 'usuario-id', email: 'campo@example.com', rol: 'admin' },
            process.env.JWT_SECRET
        );
        const jwtSecret = process.env.JWT_SECRET;
        delete process.env.JWT_SECRET;
        const logError = jest.spyOn(console, 'error').mockImplementation();

        try {
            const response = await request(app)
                .get('/api/relevamientos/resumen')
                .set('Authorization', `Bearer ${token}`);

            expect(response.statusCode).toBe(500);
            expect(response.body.mensaje).toBe('El servicio de autenticación no está configurado.');
        } finally {
            process.env.JWT_SECRET = jwtSecret;
            logError.mockRestore();
        }
    });

    it('envía a Django los totales actuales por barrio sin cambiar las métricas de los reportes', async () => {
        const ultimo = {
            barrio: 'Centro',
            fechaRegistro: new Date('2026-11-19T12:00:00.000Z')
        };
        Relevamiento.aggregate.mockResolvedValue([
            { _id: 'Centro', total: 2, criticos: 1 },
            { _id: 'Centro Histórico', total: 1, criticos: 0 }
        ]);
        Barrio.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([
                {
                    clave: 'centro',
                    nombre: 'Centro',
                    origenNombre: 'Centro Histórico',
                    personasAfectadas: 12
                },
                { clave: 'puerto', nombre: 'Puerto', personasAfectadas: 4 }
            ])
        });
        Relevamiento.findOne.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(ultimo)
        });
        const resumen = {
            total: 3,
            criticos: 1,
            personasAfectadas: 16,
            ultimo,
            porcentajeCriticos: 50,
            barriosPrioritarios: [],
            procesadoPor: 'django'
        };
        generarResumenTerritorial.mockResolvedValue(resumen);
        const res = respuesta();

        await obtenerResumen({ query: {} }, res);

        expect(Barrio.find).toHaveBeenCalledWith({ eliminado: { $ne: true } });
        expect(generarResumenTerritorial).toHaveBeenCalledWith({
            barrios: [
                { barrio: 'Centro', total: 3, criticos: 1, personasAfectadas: 12 },
                { barrio: 'Puerto', total: 0, criticos: 0, personasAfectadas: 4 }
            ],
            ultimo
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(resumen);
    });

    it('incluye el total actual al filtrar por el nombre original del barrio', async () => {
        Relevamiento.aggregate.mockResolvedValue([
            { _id: 'Centro Histórico', total: 1, criticos: 0 }
        ]);
        Barrio.find.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([
                {
                    clave: 'centro',
                    nombre: 'Centro',
                    origenNombre: 'Centro Histórico',
                    personasAfectadas: 12
                },
                { clave: 'puerto', nombre: 'Puerto', personasAfectadas: 4 }
            ])
        });
        Relevamiento.findOne.mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(null)
        });
        generarResumenTerritorial.mockResolvedValue({
            total: 1,
            criticos: 0,
            personasAfectadas: 12,
            ultimo: null,
            porcentajeCriticos: 0,
            barriosPrioritarios: [],
            procesadoPor: 'django'
        });
        const res = respuesta();

        await obtenerResumen({ query: { barrio: 'historico' } }, res);

        expect(generarResumenTerritorial).toHaveBeenCalledWith({
            barrios: [{ barrio: 'Centro', total: 1, criticos: 0, personasAfectadas: 12 }],
            ultimo: null
        });
    });

    it('devuelve 503 explícito si el servicio de reportes Django no está disponible', async () => {
        const error = new Error('Django no responde');
        error.statusCode = 503;
        generarResumenTerritorial.mockRejectedValue(error);
        const logError = jest.spyOn(console, 'error').mockImplementation();
        const res = respuesta();

        await obtenerResumen({ query: {} }, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({
            mensaje: 'El servicio Django no pudo generar el resumen territorial.'
        });
    });
});
