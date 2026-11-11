const { parsearMedicionEstacion } = require('../services/riverDataService');
const MedicionRio = require('../models/MedicionRio');
const Relevamiento = require('../relevamiento_territorial/models/Relevamiento');
const Usuario = require('../relevamiento_territorial/models/Usuario');
const {
    consultarYGuardarMedicion,
    FUENTE_URL
} = require('../services/riverDataService');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

describe('Datos de altura de Prefectura Naval Argentina', () => {
    const paginaPrefectura = `
        <table>
            <tr>
                <th data-label="Puerto:">GOYA</th>
                <td data-label="Río:">PARANA</td>
                <td data-label="Ultimo Registro:" class="warning">5.95</td>
                <td data-label="Variacion">0.00</td>
                <td data-label="Periodo">2</td>
                <td data-label="Fecha Hora:"><b>10/NOV/26 - 1600</b></td>
                <td data-label="Estado:">EVACUACION ESTAC.</td>
                <td><img src="img/EvacuacionE.svg"></td>
                <td data-label="Registro Anterior:">5.95</td>
                <td data-label="Fecha Anterior:">10/NOV/26 - 1400</td>
                <td data-label="Alerta:">5.20</td>
                <td data-label="Evacuación:">5.70</td>
            </tr>
        </table>`;

    it('interpreta la medición de Goya, sus umbrales y el horario local', () => {
        const medicion = parsearMedicionEstacion(paginaPrefectura);

        expect(medicion).toMatchObject({
            estacion: 'GOYA',
            rio: 'PARANA',
            alturaMetros: 5.95,
            variacionMetros: 0,
            periodoHoras: 2,
            fechaMedicionOrigen: '10/NOV/26 - 1600',
            estado: 'EVACUACION ESTAC.',
            alturaAlerta: 5.2,
            alturaEvacuacion: 5.7
        });
        expect(medicion.fechaMedicion.toISOString()).toBe('2026-11-10T16:00:00.000Z');
    });

    it('falla explícitamente cuando Prefectura no publica la estación solicitada', () => {
        expect(() => parsearMedicionEstacion('<table></table>'))
            .toThrow('No se encontró la estación GOYA');
    });

    it('falla explícitamente cuando cambia el formato de fecha de la fuente', () => {
        const html = paginaPrefectura.replace('10/NOV/26 - 1600', 'fecha desconocida');

        expect(() => parsearMedicionEstacion(html))
            .toThrow('Prefectura publicó una fecha de medición con formato desconocido.');
    });

    it('consulta Prefectura y guarda la medición por estación y fecha para evitar duplicados', async () => {
        const fetchOriginal = global.fetch;
        const guardarMedicion = jest.spyOn(MedicionRio, 'findOneAndUpdate')
            .mockReturnValue({ lean: () => Promise.resolve({ estacion: 'GOYA', alturaMetros: 5.95 }) });
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(paginaPrefectura)
        });

        try {
            const resultado = await consultarYGuardarMedicion();

            expect(global.fetch).toHaveBeenCalledWith(FUENTE_URL, expect.objectContaining({
                headers: { Accept: 'text/html' }
            }));
            expect(guardarMedicion).toHaveBeenCalledWith(
                { estacion: 'GOYA', fechaMedicion: new Date('2026-11-10T16:00:00.000Z') },
                { $set: expect.objectContaining({ alturaMetros: 5.95, fuente: FUENTE_URL }) },
                expect.objectContaining({ upsert: true, runValidators: true })
            );
            expect(resultado.alturaMetros).toBe(5.95);
        } finally {
            global.fetch = fetchOriginal;
            guardarMedicion.mockRestore();
        }
    });

    it('permite consultar la altura pública del río sin cerrar la sesión', async () => {
        const medicion = {
            estacion: 'GOYA',
            alturaMetros: 5.95,
            fechaMedicionOrigen: '10/NOV/26 - 1600',
            fuente: FUENTE_URL
        };
        const buscarMedicion = jest.spyOn(MedicionRio, 'findOne')
            .mockReturnValue({
                sort: () => ({ lean: () => Promise.resolve(medicion) })
            });

        try {
            const respuesta = await request(app).get('/api/rio');

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.body.medicion).toMatchObject({
                estacion: 'GOYA',
                alturaMetros: 5.95
            });
        } finally {
            buscarMedicion.mockRestore();
        }
    });

    it('guarda en MongoDB un relevamiento ingresado con un barrio nuevo', async () => {
        const usuario = { nombre: 'Equipo de campo', email: 'equipo@example.com' };
        const buscarUsuario = jest.spyOn(Usuario, 'findById')
            .mockReturnValue({ select: () => Promise.resolve(usuario) });
        const guardarRelevamiento = jest.spyOn(Relevamiento.prototype, 'save')
            .mockResolvedValue();
        const token = jwt.sign(
            { id: '507f1f77bcf86cd799439011', email: usuario.email },
            process.env.JWT_SECRET || 'secreto_super_seguro'
        );

        try {
            const respuesta = await request(app)
                .post('/api/relevamientos')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    barrio: 'Barrio nuevo',
                    nivelRioParana: 5.3,
                    personasAfectadas: 3,
                    necesidades: 'Agua potable',
                    observaciones: '',
                    coordenadas: { lat: -29.14, lng: -59.27 }
                });

            expect(respuesta.statusCode).toBe(201);
            expect(guardarRelevamiento.mock.instances[0].barrio).toBe('Barrio nuevo');
            expect(guardarRelevamiento.mock.instances[0].coordenadas.lat).toBe(-29.14);
            expect(guardarRelevamiento.mock.instances[0].coordenadas.lng).toBe(-59.27);
        } finally {
            buscarUsuario.mockRestore();
            guardarRelevamiento.mockRestore();
        }
    });
});
