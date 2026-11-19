const express = require('express');
const { obtenerBarrios, actualizarBarrio, eliminarBarrio } = require('../controllers/barrioController');
const autenticar = require('../relevamiento_territorial/middlewares/autenticar');
const autorizarAdmin = require('../relevamiento_territorial/middlewares/autorizarAdmin');

const router = express.Router();

router.use(autenticar);
router.get('/', obtenerBarrios);
router.put('/:clave', autorizarAdmin, actualizarBarrio);
router.delete('/:clave', autorizarAdmin, eliminarBarrio);

module.exports = router;
