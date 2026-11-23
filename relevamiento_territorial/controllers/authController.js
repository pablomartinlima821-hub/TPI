const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const obtenerJwtSecret = (res) => {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

    console.error('JWT_SECRET no está configurado.');
    res.status(500).json({ mensaje: 'El servicio de autenticación no está configurado.' });
    return null;
};

const registrarUsuario = async (req, res) => {
    try {
        const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const password = req.body?.password;

        if (!nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ mensaje: 'Ingresa un nombre, un correo válido y una contraseña de al menos 8 caracteres.' });
        }

        const usuarioExistente = await Usuario.findOne({ email });
        if (usuarioExistente) {
            return res.status(409).json({ mensaje: 'Ya existe una cuenta registrada con ese correo.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const usuario = new Usuario({ nombre, email, password: passwordHash });
        await usuario.save();

        return res.status(201).json({
            mensaje: 'Cuenta creada con éxito.',
            usuario: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ mensaje: 'Ya existe una cuenta registrada con ese correo.' });
        }
        return res.status(500).json({ mensaje: 'Error al registrar el usuario.', error: error.message });
    }
};

const iniciarSesion = async (req, res) => {
    try {
        const jwtSecret = obtenerJwtSecret(res);
        if (!jwtSecret) return;

        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const password = req.body?.password;

        if (!email || typeof password !== 'string' || !password) {
            return res.status(400).json({ mensaje: 'Ingresa tu correo electrónico y contraseña.' });
        }

        const usuario = await Usuario.findOne({ email }).select('+password');
        if (!usuario?.password || !(await bcrypt.compare(password, usuario.password))) {
            return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
        }

        const token = jwt.sign(
            { id: usuario._id, email: usuario.email, rol: usuario.rol },
            jwtSecret,
            { expiresIn: '8h' }
        );

        return res.status(200).json({
            mensaje: 'Inicio de sesión exitoso.',
            token,
            usuario: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
        });
    } catch (error) {
        return res.status(500).json({ mensaje: 'Error al iniciar sesión.', error: error.message });
    }
};

const solicitarCodigoRecuperacion = async (req, res) => {
    try {
        const email = typeof req.body?.email === 'string'
            ? req.body.email.trim().toLowerCase()
            : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ mensaje: 'Ingresa un correo electrónico válido.' });
        }
        if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) {
            return res.status(503).json({
                mensaje: 'El envío de códigos no está configurado. Contacta al administrador.'
            });
        }

        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Correo no registrado en el sistema de relevamiento.' });
        }

        const codigoToken = crypto.randomInt(100000, 1000000).toString();
        usuario.tokenAcceso = codigoToken;
        usuario.tokenExpiracion = Date.now() + 10 * 60 * 1000;
        await usuario.save();

        try {
            const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                signal: AbortSignal.timeout(15000),
                headers: {
                    accept: 'application/json',
                    'api-key': process.env.BREVO_API_KEY,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: { name: 'Monitoreo Territorial de Goya', email: process.env.EMAIL_FROM },
                    to: [{ email }],
                    subject: 'Código para recuperar tu contraseña',
                    textContent: `Tu código temporal es: ${codigoToken}. Este código expira en 10 minutos.`
                })
            });
            if (!respuesta.ok) {
                console.error(`Brevo rechazó el envío del código (HTTP ${respuesta.status}).`);
                throw new Error('Brevo rechazó el envío del correo.');
            }
        } catch (error) {
            usuario.tokenAcceso = undefined;
            usuario.tokenExpiracion = undefined;
            try {
                await usuario.save();
            } catch (errorLimpieza) {
                console.error(`No se pudo limpiar el código de recuperación: ${errorLimpieza.message}`);
            }

            const tiempoAgotado = error.name === 'TimeoutError' || error.name === 'AbortError';
            console.error(`No se pudo enviar el código de recuperación: ${error.message}`);
            return res.status(tiempoAgotado ? 504 : 502).json({
                mensaje: tiempoAgotado
                    ? 'El envío del correo tardó demasiado. Intenta nuevamente.'
                    : 'No se pudo enviar el correo. Verifica la configuración del remitente en Brevo.'
            });
        }

        return res.status(200).json({ mensaje: 'Código enviado. Revisa tu correo.' });
    } catch (error) {
        console.error(`Error al solicitar el código de recuperación: ${error.message}`);
        return res.status(500).json({ mensaje: 'No se pudo solicitar el código de recuperación.' });
    }
};

// 2. Verificar el código de Gmail y otorgar sesión JWT
const verificarTokenGmail = async (req, res) => {
    try {
        const jwtSecret = obtenerJwtSecret(res);
        if (!jwtSecret) return;

        const { email, codigo } = req.body;
        const usuario = await Usuario.findOne({ email });

        if (!usuario || usuario.tokenAcceso !== codigo || usuario.tokenExpiracion < Date.now()) {
            return res.status(400).json({ mensaje: 'Código inválido o expirado.' });
        }

        // Limpiar token usado
        usuario.tokenAcceso = undefined;
        usuario.tokenExpiracion = undefined;
        await usuario.save();

        // Crear Token JWT de sesión
        const tokenJwt = jwt.sign(
            { id: usuario._id, email: usuario.email, rol: usuario.rol },
            jwtSecret,
            { expiresIn: '8h' }
        );

        res.status(200).json({ 
            mensaje: 'Autenticación exitosa', 
            token: tokenJwt,
            usuario: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en la verificación', error: error.message });
    }
};

const restablecerPassword = async (req, res) => {
    try {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const codigo = req.body?.token;
        const newPassword = req.body?.newPassword;
        const usuario = await Usuario.findOne({ email });

        if (!usuario || usuario.tokenAcceso !== codigo || !usuario.tokenExpiracion || usuario.tokenExpiracion < Date.now()) {
            return res.status(400).json({ mensaje: 'Código inválido o expirado.' });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 8 caracteres.' });
        }

        usuario.password = await bcrypt.hash(newPassword, 10);
        usuario.tokenAcceso = undefined;
        usuario.tokenExpiracion = undefined;
        await usuario.save();

        return res.status(200).json({ mensaje: 'Contraseña actualizada con éxito.' });
    } catch (error) {
        return res.status(500).json({ mensaje: 'Error al restablecer la contraseña.', error: error.message });
    }
};

module.exports = {
    iniciarSesion,
    registrarUsuario,
    restablecerPassword,
    solicitarCodigoRecuperacion,
    verificarTokenGmail
};