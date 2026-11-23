const autorizarAdmin = (req, res, next) => {
    if (req.usuarioAutenticado?.rol !== 'admin') {
        return res.status(403).json({ mensaje: 'Solo administradores pueden consultar los relevamientos.' });
    }

    return next();
};

module.exports = autorizarAdmin;
