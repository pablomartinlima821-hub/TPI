jest.mock('../models/Barrio', () => ({
    updateOne: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn()
}));

jest.mock('../relevamiento_territorial/models/Relevamiento', () => ({
    aggregate: jest.fn()
}));

const Barrio = require('../models/Barrio');
const Relevamiento = require('../relevamiento_territorial/models/Relevamiento');
const { obtenerBarrios } = require('../controllers/barrioController');

const consulta = (resultado) => ({
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resultado)
});

describe('Gestión de barrios', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Barrio.updateOne.mockResolvedValue({});
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
                    coordenadas: { lat: -29.14, lng: -59.27 }
                })
            }),
            { upsert: true }
        );
    });
});
