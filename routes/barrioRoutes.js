const express = require('express');
const { obtenerBarrios, actualizarBarrio } = require('../controllers/barrioController');
const autenticar = require('../relevamiento_territorial/middlewares/autenticar');
const autorizarAdmin = require('../relevamiento_territorial/middlewares/autorizarAdmin');

const router = express.Router();

router.use(autenticar);
router.get('/', obtenerBarrios);
router.put('/:clave', autorizarAdmin, actualizarBarrio);

module.exports = router;
