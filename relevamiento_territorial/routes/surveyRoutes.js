const express = require('express');
const router = express.Router();
const {
    crearRegistro,
    exportarCsv,
    obtenerRegistros,
    obtenerResumen,
    actualizarRegistro,
    actualizarSeguimiento
} = require('../controllers/surveyController');
const { validarRelevamiento } = require('../middlewares/validador');
const autenticar = require('../middlewares/autenticar');
const autorizarAdmin = require('../middlewares/autorizarAdmin');

router.use(autenticar);
router.get('/resumen', autorizarAdmin, obtenerResumen);
router.get('/exportar.csv', autorizarAdmin, exportarCsv);
router.post('/', validarRelevamiento, crearRegistro);
router.get('/', autorizarAdmin, obtenerRegistros);
router.patch('/:id/seguimiento', autorizarAdmin, actualizarSeguimiento);

// Nueva ruta para actualizar un relevamiento por su ID
router.put('/:id', validarRelevamiento, actualizarRegistro);

module.exports = router;