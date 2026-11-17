const mongoose = require('mongoose');

const coordenadasSchema = new mongoose.Schema({
    lat: { type: Number, required: true, min: -29.5, max: -29 },
    lng: { type: Number, required: true, min: -59.5, max: -59 }
}, { _id: false });

const barrioSchema = new mongoose.Schema({
    clave: { type: String, required: true, unique: true },
    nombre: { type: String, required: true, trim: true, maxlength: 120 },
    ubicacion: { type: String, required: true, trim: true, maxlength: 300 },
    origenNombre: { type: String, trim: true, maxlength: 120 },
    coordenadas: { type: coordenadasSchema, default: null },
    orden: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Barrio', barrioSchema);
