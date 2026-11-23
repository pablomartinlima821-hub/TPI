jest.mock('../models/Usuario', () => ({
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn()
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const app = require('../../app');

const adminToken = jwt.sign(
    { id: '507f1f77bcf86cd799439011', email: 'admin@example.com', rol: 'admin' },
    process.env.JWT_SECRET
);

const crearConsulta = (resultado) => ({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resultado)
});

describe('API de gestión de usuarios', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('lista usuarios sin exponer campos privados', async () => {
        const usuarios = [{ _id: '507f1f77bcf86cd799439012', nombre: 'Ana', email: 'ana@example.com', rol: 'encuestador' }];
        const consulta = crearConsulta(usuarios);
        Usuario.find.mockReturnValue(consulta);

        const res = await request(app)
            .get('/api/usuarios')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(usuarios);
        expect(consulta.select).toHaveBeenCalledWith('nombre email rol');
    });

    it('consulta un usuario por id sin exponer campos privados', async () => {
        const usuario = { _id: '507f1f77bcf86cd799439012', nombre: 'Ana', email: 'ana@example.com', rol: 'encuestador' };
        const consulta = crearConsulta(usuario);
        Usuario.findById.mockReturnValue(consulta);

        const res = await request(app)
            .get(`/api/usuarios/${usuario._id}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(usuario);
        expect(consulta.select).toHaveBeenCalledWith('nombre email rol');
    });

    it('actualiza datos y guarda la contraseña como hash', async () => {
        const usuario = {
            _id: '507f1f77bcf86cd799439012',
            nombre: 'Ana',
            email: 'ana@example.com',
            rol: 'encuestador',
            save: jest.fn().mockResolvedValue(undefined)
        };
        Usuario.findById.mockResolvedValue(usuario);

        const res = await request(app)
            .patch(`/api/usuarios/${usuario._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'ANA.NUEVA@example.com', password: 'password-segura' });

        expect(res.statusCode).toBe(200);
        expect(usuario.email).toBe('ana.nueva@example.com');
        expect(await bcrypt.compare('password-segura', usuario.password)).toBe(true);
        expect(res.body.usuario).not.toHaveProperty('password');
        expect(usuario.save).toHaveBeenCalled();
    });

    it('elimina otro usuario y devuelve solo sus datos públicos', async () => {
        const usuario = { _id: '507f1f77bcf86cd799439012', nombre: 'Ana', email: 'ana@example.com', rol: 'encuestador' };
        const consulta = crearConsulta(usuario);
        Usuario.findByIdAndDelete.mockReturnValue(consulta);

        const res = await request(app)
            .delete(`/api/usuarios/${usuario._id}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.usuario).toEqual(usuario);
        expect(consulta.select).toHaveBeenCalledWith('nombre email rol');
    });
});
