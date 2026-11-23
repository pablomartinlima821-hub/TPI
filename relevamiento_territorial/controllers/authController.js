const Usuario = require('../models/Usuario');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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

// Configuración del transporter de correo (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Tu correo configurado en el .env
        pass: process.env.EMAIL_PASS  // Tu contraseña de aplicación de Gmail
    }
});

// 1. Solicitar código de acceso por Gmail
const solicitarTokenGmail = async (req, res) => {
    try {
        const { email } = req.body;
        let usuario = await Usuario.findOne({ email });

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Correo no registrado en el sistema de relevamiento.' });
        }

        // Generar código aleatorio de 6 dígitos
        const codigoToken = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Expira en 10 minutos
        usuario.tokenAcceso = codigoToken;
        usuario.tokenExpiracion = Date.now() + 10 * 60 * 1000;
        await usuario.save();

        // Enviar correo
        await transporter.sendMail({
            from: '"Monitoreo Goya - El Niño" <noreply@goya.gov.ar>',
            to: email,
            subject: 'Código de Acceso - Relevamiento Territorial',
            text: `Tu código de acceso temporal es: ${codigoToken}. Este código expira en 10 minutos.`
        });

        res.status(200).json({ mensaje: 'Código de acceso enviado con éxito a tu correo.' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al enviar el correo', error: error.message });
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

module.exports = { iniciarSesion, registrarUsuario, restablecerPassword, solicitarTokenGmail, verificarTokenGmail };