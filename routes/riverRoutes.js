const express = require('express');
const { obtenerEstadoRio } = require('../controllers/riverController');

const router = express.Router();

router.get('/', obtenerEstadoRio);

module.exports = router;
