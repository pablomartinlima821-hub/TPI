const express = require('express');
const router = express.Router();
const { iniciarSesion, registrarUsuario, restablecerPassword, solicitarTokenGmail, verificarTokenGmail } = require('../controllers/authController');

router.post('/login', iniciarSesion);
router.post('/registrar', registrarUsuario);
router.post('/solicitar-token', solicitarTokenGmail);
router.post('/verificar-token', verificarTokenGmail);
router.post('/solicitar-codigo', solicitarTokenGmail);
router.post('/verificar-codigo', restablecerPassword);

module.exports = router;