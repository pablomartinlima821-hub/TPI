const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    nombre: { type: String, required: true },
    password: { type: String, select: false },
    rol: { type: String, enum: ['admin', 'encuestador'], default: 'encuestador' },
    tokenAcceso: { type: String }, // Token temporal de 6 dígitos para Gmail
    tokenExpiracion: { type: Date }
});

module.exports = mongoose.model('Usuario', usuarioSchema);