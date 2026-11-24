const mongoose = require('mongoose');

const coordenadasSchema = new mongoose.Schema({
    lat: { type: Number, required: true, min: -29.5, max: -29 },
    lng: { type: Number, required: true, min: -59.5, max: -59 }
}, { _id: false });

const cambioSituacionSchema = new mongoose.Schema({
    situacionAnterior: { type: String, enum: ['critico', 'estable', 'sin_datos'], required: true },
    situacionNueva: { type: String, enum: ['critico', 'estable', 'sin_datos'], required: true },
    motivo: { type: String, trim: true, maxlength: 300, default: '' },
    actualizadoEn: { type: Date, default: Date.now },
    actualizadoPor: {
        id: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true }
    }
}, { _id: false });

const barrioSchema = new mongoose.Schema({
    clave: { type: String, required: true, unique: true },
    nombre: { type: String, required: true, trim: true, maxlength: 120 },
    ubicacion: { type: String, required: true, trim: true, maxlength: 300 },
    origenNombre: { type: String, trim: true, maxlength: 120 },
    coordenadas: { type: coordenadasSchema, default: null },
    personasAfectadas: {
        type: Number,
        min: 0,
        default: 0,
        validate: {
            validator: Number.isSafeInteger,
            message: 'La cantidad de personas afectadas debe ser un entero no negativo.'
        }
    },
    situacion: { type: String, enum: ['critico', 'estable', 'sin_datos'], default: 'sin_datos' },
    historialSituacion: { type: [cambioSituacionSchema], default: [] },
    orden: { type: Number, required: true },
    eliminado: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Barrio', barrioSchema);
