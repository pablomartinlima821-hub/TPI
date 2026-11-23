jest.mock('nodemailer', () => ({
    createTransport: jest.fn(() => ({ sendMail: jest.fn() }))
}));

jest.mock('../models/Usuario', () => ({
    findOne: jest.fn()
}));

const request = require('supertest');
const nodemailer = require('nodemailer');
const Usuario = require('../models/Usuario');
const app = require('../../app');

describe('Recuperación de contraseña por Gmail', () => {
    const emailUserOriginal = process.env.EMAIL_USER;
    const emailPassOriginal = process.env.EMAIL_PASS;
    const sendMail = nodemailer.createTransport.mock.results[0].value.sendMail;

    beforeEach(() => {
        jest.clearAllMocks();
        sendMail.mockReset();
        process.env.EMAIL_USER = 'sender@gmail.com';
        process.env.EMAIL_PASS = 'test-app-password';
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (emailUserOriginal === undefined) delete process.env.EMAIL_USER;
        else process.env.EMAIL_USER = emailUserOriginal;
        if (emailPassOriginal === undefined) delete process.env.EMAIL_PASS;
        else process.env.EMAIL_PASS = emailPassOriginal;
    });

    it('envía el código con Nodemailer usando la cuenta Gmail configurada', async () => {
        const usuario = {
            email: 'persona@example.com',
            save: jest.fn().mockResolvedValue(undefined)
        };
        Usuario.findOne.mockResolvedValue(usuario);
        sendMail.mockResolvedValue({ messageId: 'message-id' });

        const respuesta = await request(app)
            .post('/api/auth/solicitar-codigo')
            .send({ email: ' Persona@Example.com ' });

        expect(respuesta.statusCode).toBe(200);
        expect(Usuario.findOne).toHaveBeenCalledWith({ email: 'persona@example.com' });
        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
            from: '"Monitoreo Goya - El Niño" <sender@gmail.com>',
            to: 'persona@example.com',
            subject: 'Código para recuperar tu contraseña'
        }));
        expect(usuario.save).toHaveBeenCalledTimes(1);
        expect(usuario.tokenAcceso).toMatch(/^\d{6}$/);
    });

    it('informa si faltan las credenciales de Gmail y no consulta la cuenta', async () => {
        delete process.env.EMAIL_PASS;

        const respuesta = await request(app)
            .post('/api/auth/solicitar-codigo')
            .send({ email: 'persona@example.com' });

        expect(respuesta.statusCode).toBe(503);
        expect(respuesta.body.mensaje).toMatch(/no está configurado/i);
        expect(Usuario.findOne).not.toHaveBeenCalled();
    });

    it('invalida el código e informa si la conexión SMTP expira', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const usuario = {
            email: 'persona@example.com',
            save: jest.fn().mockResolvedValue(undefined)
        };
        Usuario.findOne.mockResolvedValue(usuario);
        sendMail.mockRejectedValue(Object.assign(new Error('SMTP connection timed out'), {
            code: 'ETIMEDOUT'
        }));

        const respuesta = await request(app)
            .post('/api/auth/solicitar-codigo')
            .send({ email: usuario.email });

        expect(respuesta.statusCode).toBe(504);
        expect(respuesta.body.mensaje).toMatch(/SMTP/);
        expect(usuario.tokenAcceso).toBeUndefined();
        expect(usuario.tokenExpiracion).toBeUndefined();
        expect(usuario.save).toHaveBeenCalledTimes(2);
    });
});
