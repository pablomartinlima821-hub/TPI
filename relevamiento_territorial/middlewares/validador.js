const { body, validationResult } = require('express-validator');

const validarRelevamiento = [
    body('barrio').trim().notEmpty().withMessage('El barrio es obligatorio'),
    body('nivelRioParana').isFloat({ min: 0 }).withMessage('El nivel del río debe ser un número positivo'),
    body('coordenadas.lat').isFloat({ min: -29.5, max: -29.0 }).withMessage('Latitud fuera del rango territorial (Goya)'),
    body('coordenadas.lng').isFloat({ min: -59.5, max: -59.0 }).withMessage('Longitud fuera del rango territorial (Goya)'),
    body('personasAfectadas').optional().isInt({ min: 0 }).withMessage('La cantidad de personas afectadas debe ser un entero no negativo'),
    body('necesidades').optional().isString().isLength({ max: 1000 }).withMessage('Las necesidades no pueden superar los 1000 caracteres'),
    body('observaciones').optional().isString().isLength({ max: 2000 }).withMessage('Las observaciones no pueden superar los 2000 caracteres'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errores: errors.array() });
        }
        next();
    }
];

module.exports = { validarRelevamiento };