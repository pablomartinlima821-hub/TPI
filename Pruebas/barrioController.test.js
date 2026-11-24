jest.mock('../models/Barrio', () => ({
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn()
}));

jest.mock('../relevamiento_territorial/models/Relevamiento', () => ({
    aggregate: jest.fn()
}));

const Barrio = require('../models/Barrio');
const Relevamiento = require('../relevamiento_territorial/models/Relevamiento');
const {
    obtenerBarrios,
    actualizarBarrio,
    eliminarBarrio
} = require('../controllers/barrioController');

const consulta = (resultado) => ({
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resultado)
});

describe('Gestión de barrios', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Barrio.updateOne.mockResolvedValue({});
        Barrio.updateMany.mockResolvedValue({});
        Barrio.findOne.mockReturnValue(consulta({ orden: 3 }));
        Barrio.find.mockImplementation((filtro) => {
            const iniciales = [
                { _id: '1', nombre: 'Zona Puerto / Costanera', origenNombre: 'Zona Puerto / Costanera' },
                { _id: '2', nombre: 'B° Matadero / Riacho Goya', origenNombre: 'B° Matadero / Riacho Goya' },
                { _id: '3', nombre: 'Zona Paraje El Bajo', origenNombre: 'Zona Paraje El Bajo' }
            ];
            return consulta(filtro?.$or ? iniciales : [
                ...iniciales,
                { clave: 'relevamiento-nuevo', nombre: 'Barrio nuevo', ubicacion: 'Ubicación registrada en relevamientos' }
            ]);
        });
        Relevamiento.aggregate.mockResolvedValue([
            { _id: 'Barrio nuevo', coordenadas: { lat: -29.14, lng: -59.27 } }
        ]);
    });

    it('agrega a la lista los barrios cargados en relevamientos para poder editarlos', async () => {
        const respuesta = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await obtenerBarrios({}, respuesta);

        expect(respuesta.status).toHaveBeenCalledWith(200);
        expect(respuesta.json.mock.calls[0][0]).toEqual(expect.arrayContaining([
            expect.objectContaining({ nombre: 'Barrio nuevo' })
        ]));
        expect(Barrio.updateOne).toHaveBeenCalledWith(
            { clave: expect.stringMatching(/^relevamiento-/) },
            expect.objectContaining({
                $setOnInsert: expect.objectContaining({
                    nombre: 'Barrio nuevo',
                    coordenadas: { lat: -29.14, lng: -59.27 },
                    situacion: 'sin_datos'
                })
            }),
            { upsert: true }
        );
        expect(Barrio.find).toHaveBeenLastCalledWith({ eliminado: { $ne: true } });
        expect(Barrio.updateMany).toHaveBeenCalledWith(
            { situacion: { $exists: false } },
            { $set: { situacion: 'estable' } }
        );
        expect(Barrio.updateMany).toHaveBeenCalledWith(
            { clave: /^relevamiento-/, situacion: { $exists: false } },
            { $set: { situacion: 'sin_datos' } }
        );
    });

    it('actualiza la situación del barrio si el administrador envía un valor permitido', async () => {
        const barrioActualizado = {
            clave: 'puerto-costanera',
            nombre: 'Zona Puerto / Costanera',
            situacion: 'critico'
        };
        Barrio.findOne.mockReturnValueOnce({
            lean: () => Promise.resolve({ situacion: 'estable' })
        });
        Barrio.findOneAndUpdate.mockReturnValue({
            lean: () => Promise.resolve(barrioActualizado)
        });
        const respuesta = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await actualizarBarrio({
            params: { clave: 'puerto-costanera' },
            body: {
                nombre: 'Zona Puerto / Costanera',
                ubicacion: 'Puerto y Costanera de Goya',
                situacion: 'critico',
                motivoSituacion: 'Reporte confirmado en el barrio'
            },
            usuarioAutenticado: { id: 'admin-id', email: 'admin@example.com' }
        }, respuesta);

        expect(Barrio.findOne).toHaveBeenCalledWith({
            clave: 'puerto-costanera',
            eliminado: { $ne: true }
        });
        expect(Barrio.findOneAndUpdate).toHaveBeenCalledWith(
            { clave: 'puerto-costanera', eliminado: { $ne: true } },
            {
                $set: {
                    nombre: 'Zona Puerto / Costanera',
                    ubicacion: 'Puerto y Costanera de Goya',
                    situacion: 'critico'
                },
                $push: {
                    historialSituacion: expect.objectContaining({
                        situacionAnterior: 'estable',
                        situacionNueva: 'critico',
                        motivo: 'Reporte confirmado en el barrio',
                        actualizadoPor: { id: 'admin-id', email: 'admin@example.com' }
                    })
                }
            },
            { new: true, runValidators: true }
        );
        expect(respuesta.status).toHaveBeenCalledWith(200);
    });

    it('guarda la cantidad de personas afectadas del barrio', async () => {
        const barrioActualizado = {
            clave: 'puerto-costanera',
            personasAfectadas: 12
        };
        Barrio.findOneAndUpdate.mockReturnValue({
            lean: () => Promise.resolve(barrioActualizado)
        });
        const respuesta = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await actualizarBarrio({
            params: { clave: 'puerto-costanera' },
            body: {
                nombre: 'Zona Puerto / Costanera',
                ubicacion: 'Puerto y Costanera de Goya',
                personasAfectadas: '12'
            }
        }, respuesta);

        expect(Barrio.findOneAndUpdate).toHaveBeenCalledWith(
            { clave: 'puerto-costanera', eliminado: { $ne: true } },
            { $set: expect.objectContaining({ personasAfectadas: 12 }) },
            { new: true, runValidators: true }
        );
        expect(respuesta.status).toHaveBeenCalledWith(200);
    });

    it.each([-1, 1.5])('rechaza una cantidad inválida de personas afectadas: %s', async (cantidad) => {
        const respuesta = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await actualizarBarrio({
            params: { clave: 'puerto-costanera' },
            body: {
                nombre: 'Zona Puerto / Costanera',
                ubicacion: 'Puerto y Costanera de Goya',
                personasAfectadas: cantidad
            }
        }, respuesta);

        expect(respuesta.status).toHaveBeenCalledWith(400);
        expect(Barrio.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rechaza una situación de barrio distinta de crítica o estable', async () => {
        const respuesta = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await actualizarBarrio({
            params: { clave: 'puerto-costanera' },
            body: {
                nombre: 'Zona Puerto / Costanera',
                ubicacion: 'Puerto y Costanera de Goya',
                situacion: 'alerta',
                coordenadas: { lat: -29.14, lng: -59.27 }
            }
        }, respuesta);

        expect(respuesta.status).toHaveBeenCalledWith(400);
        expect(Barrio.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('oculta un barrio eliminado sin borrar los relevamientos históricos', async () => {
        Barrio.findOneAndUpdate.mockReturnValue({
            lean: () => Promise.resolve({ clave: 'relevamiento-mal-cargado', eliminado: true })
        });
        const respuesta = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await eliminarBarrio({ params: { clave: 'relevamiento-mal-cargado' } }, respuesta);

        expect(Barrio.findOneAndUpdate).toHaveBeenCalledWith(
            { clave: 'relevamiento-mal-cargado', eliminado: { $ne: true } },
            { $set: { eliminado: true } },
            { new: true }
        );
        expect(respuesta.status).toHaveBeenCalledWith(200);
        expect(respuesta.json).toHaveBeenCalledWith({ mensaje: 'Barrio eliminado de la lista.' });
    });

    it('devuelve 404 si el barrio ya no está disponible para eliminar', async () => {
        Barrio.findOneAndUpdate.mockReturnValue({
            lean: () => Promise.resolve(null)
        });
        const respuesta = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await eliminarBarrio({ params: { clave: 'no-existe' } }, respuesta);

        expect(respuesta.status).toHaveBeenCalledWith(404);
    });
});
