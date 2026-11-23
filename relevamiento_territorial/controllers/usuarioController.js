const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');

const CAMPOS_PUBLICOS = 'nombre email rol';
const ROLES = ['admin', 'encuestador'];
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validarId = (id, res) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ mensaje: 'El identificador del usuario no es válido.' });
        return false;
    }

    return true;
};

const esErrorDeValidacion = (error) => error.name === 'ValidationError';

const manejarError = (error, res, mensaje) => {
    if (error.code === 11000) {
        return res.status(409).json({ mensaje: 'Ya existe una cuenta registrada con ese correo.' });
    }
    if (esErrorDeValidacion(error)) {
        return res.status(400).json({ mensaje: 'Los datos del usuario no son válidos.' });
    }

    console.error(`${mensaje}:`, error);
    return res.status(500).json({ mensaje });
};

const obtenerUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario.find()
            .select(CAMPOS_PUBLICOS)
            .sort({ nombre: 1 })
            .lean();
        return res.status(200).json(usuarios);
    } catch (error) {
        return manejarError(error, res, 'Error al obtener los usuarios.');
    }
};

const obtenerUsuario = async (req, res) => {
    if (!validarId(req.params.id, res)) return;

    try {
        const usuario = await Usuario.findById(req.params.id)
            .select(CAMPOS_PUBLICOS)
            .lean();
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }
        return res.status(200).json(usuario);
    } catch (error) {
        return manejarError(error, res, 'Error al obtener el usuario.');
    }
};

const actualizarUsuario = async (req, res) => {
    if (!validarId(req.params.id, res)) return;

    const datos = req.body;
    const camposPermitidos = ['nombre', 'email', 'rol', 'password'];
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
        return res.status(400).json({ mensaje: 'Envía los datos del usuario en un objeto.' });
    }

    const camposEnviados = Object.keys(datos);
    if (camposEnviados.length === 0 || camposEnviados.some((campo) => !camposPermitidos.includes(campo))) {
        return res.status(400).json({ mensaje: 'Envía al menos un campo permitido: nombre, email, rol o password.' });
    }
    if (Object.prototype.hasOwnProperty.call(datos, 'nombre')
        && (typeof datos.nombre !== 'string' || !datos.nombre.trim())) {
        return res.status(400).json({ mensaje: 'El nombre no puede estar vacío.' });
    }
    if (Object.prototype.hasOwnProperty.call(datos, 'email')
        && (typeof datos.email !== 'string' || !EMAIL_VALIDO.test(datos.email.trim()))) {
        return res.status(400).json({ mensaje: 'Ingresa un correo electrónico válido.' });
    }
    if (Object.prototype.hasOwnProperty.call(datos, 'rol') && !ROLES.includes(datos.rol)) {
        return res.status(400).json({ mensaje: 'El rol debe ser admin o encuestador.' });
    }
    if (Object.prototype.hasOwnProperty.call(datos, 'password')
        && (typeof datos.password !== 'string' || datos.password.length < 8)) {
        return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    try {
        const usuario = await Usuario.findById(req.params.id);
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }

        if (datos.nombre !== undefined) usuario.nombre = datos.nombre.trim();
        if (datos.email !== undefined) usuario.email = datos.email.trim().toLowerCase();
        if (datos.rol !== undefined) usuario.rol = datos.rol;
        if (datos.password !== undefined) usuario.password = await bcrypt.hash(datos.password, 10);

        await usuario.save();
        return res.status(200).json({
            mensaje: 'Usuario actualizado correctamente.',
            usuario: {
                _id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            }
        });
    } catch (error) {
        return manejarError(error, res, 'Error al actualizar el usuario.');
    }
};

const eliminarUsuario = async (req, res) => {
    if (!validarId(req.params.id, res)) return;
    if (req.params.id === req.usuarioAutenticado.id) {
        return res.status(400).json({ mensaje: 'No puedes eliminar la cuenta con la que iniciaste sesión.' });
    }

    try {
        const usuario = await Usuario.findByIdAndDelete(req.params.id)
            .select(CAMPOS_PUBLICOS)
            .lean();
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        }
        return res.status(200).json({ mensaje: 'Usuario eliminado permanentemente.', usuario });
    } catch (error) {
        return manejarError(error, res, 'Error al eliminar el usuario.');
    }
};

module.exports = { obtenerUsuarios, obtenerUsuario, actualizarUsuario, eliminarUsuario };
