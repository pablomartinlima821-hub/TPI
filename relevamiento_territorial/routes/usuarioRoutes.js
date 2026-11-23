const express = require('express');
const {
    obtenerUsuarios,
    obtenerUsuario,
    actualizarUsuario,
    eliminarUsuario
} = require('../controllers/usuarioController');
const autenticar = require('../middlewares/autenticar');
const autorizarAdmin = require('../middlewares/autorizarAdmin');

const router = express.Router();

router.use(autenticar, autorizarAdmin);
router.get('/', obtenerUsuarios);
router.get('/:id', obtenerUsuario);
router.patch('/:id', actualizarUsuario);
router.delete('/:id', eliminarUsuario);

module.exports = router;
