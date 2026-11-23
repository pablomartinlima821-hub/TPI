jest.mock('../models/Usuario', () => ({
    findOne: jest.fn()
}));

const request = require('supertest');
const Usuario = require('../models/Usuario');
const app = require('../../app');

describe('Recuperación de contraseña por correo', () => {
    const fetchOriginal = global.fetch;
    const brevoApiKeyOriginal = process.env.BREVO_API_KEY;
    const emailFromOriginal = process.env.EMAIL_FROM;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.BREVO_API_KEY = 'test-brevo-key';
        process.env.EMAIL_FROM = 'no-reply@example.com';
    });

    afterEach(() => {
        global.fetch = fetchOriginal;
        jest.restoreAllMocks();
        if (brevoApiKeyOriginal === undefined) delete process.env.BREVO_API_KEY;
        else process.env.BREVO_API_KEY = brevoApiKeyOriginal;
        if (emailFromOriginal === undefined) delete process.env.EMAIL_FROM;
        else process.env.EMAIL_FROM = emailFromOriginal;
    });

    it('envía el código por HTTPS usando el remitente verificado', async () => {
        const usuario = {
            email: 'persona@example.com',
            save: jest.fn().mockResolvedValue(undefined)
        };
        Usuario.findOne.mockResolvedValue(usuario);
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201 });

        const respuesta = await request(app)
            .post('/api/auth/solicitar-codigo')
            .send({ email: ' Persona@Example.com ' });

        expect(respuesta.statusCode).toBe(200);
        expect(Usuario.findOne).toHaveBeenCalledWith({ email: 'persona@example.com' });
        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.brevo.com/v3/smtp/email',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'api-key': 'test-brevo-key' }),
                body: expect.stringContaining('"email":"no-reply@example.com"')
            })
        );
        expect(usuario.save).toHaveBeenCalledTimes(1);
        expect(usuario.tokenAcceso).toMatch(/^\d{6}$/);
    });

    it('informa si faltan las credenciales de correo y no consulta la cuenta', async () => {
        delete process.env.BREVO_API_KEY;

        const respuesta = await request(app)
            .post('/api/auth/solicitar-codigo')
            .send({ email: 'persona@example.com' });

        expect(respuesta.statusCode).toBe(503);
        expect(respuesta.body.mensaje).toMatch(/no está configurado/i);
        expect(Usuario.findOne).not.toHaveBeenCalled();
    });

    it('invalida el código si Brevo rechaza el envío', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const usuario = {
            email: 'persona@example.com',
            save: jest.fn().mockResolvedValue(undefined)
        };
        Usuario.findOne.mockResolvedValue(usuario);
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });

        const respuesta = await request(app)
            .post('/api/auth/solicitar-codigo')
            .send({ email: usuario.email });

        expect(respuesta.statusCode).toBe(502);
        expect(respuesta.body.mensaje).toMatch(/Brevo/);
        expect(usuario.tokenAcceso).toBeUndefined();
        expect(usuario.tokenExpiracion).toBeUndefined();
        expect(usuario.save).toHaveBeenCalledTimes(2);
    });
});
