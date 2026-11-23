const express = require('express');
const router = express.Router();
const {
    iniciarSesion,
    registrarUsuario,
    restablecerPassword,
    solicitarCodigoRecuperacion,
    verificarTokenGmail
} = require('../controllers/authController');

router.post('/login', iniciarSesion);
router.post('/registrar', registrarUsuario);
router.post('/solicitar-token', solicitarCodigoRecuperacion);
router.post('/verificar-token', verificarTokenGmail);
router.post('/solicitar-codigo', solicitarCodigoRecuperacion);
router.post('/verificar-codigo', restablecerPassword);

module.exports = router;