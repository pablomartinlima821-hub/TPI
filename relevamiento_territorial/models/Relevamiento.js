const mongoose = require('mongoose');

const relevamientoSchema = new mongoose.Schema({
    barrio: { type: String, required: true },
    nivelRioParana: { type: Number, required: true },
    nivelRioOrigen: { type: String, enum: ['manual', 'prefectura'], default: 'manual' },
    fechaMedicionRio: { type: Date },
    estadoEvacuacion: { type: Boolean, default: false },
    estadoSeguimiento: {
        type: String,
        enum: ['pendiente', 'en-seguimiento', 'resuelto'],
        default: 'pendiente'
    },
    seguimientoActualizadoEn: { type: Date },
    seguimientoActualizadoPor: {
        id: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true }
    },
    personasAfectadas: { type: Number, min: 0, default: 0 },
    necesidades: { type: String, trim: true, maxlength: 1000, default: '' },
    observaciones: { type: String, trim: true, maxlength: 2000, default: '' },
    registradoPor: {
        nombre: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true }
    },
    coordenadas: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    fechaRegistro: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Relevamiento', relevamientoSchema);