const mongoose = require('mongoose');

const medicionRioSchema = new mongoose.Schema({
    estacion: { type: String, required: true },
    rio: { type: String, required: true },
    alturaMetros: { type: Number, required: true },
    variacionMetros: { type: Number },
    periodoHoras: { type: Number },
    fechaMedicion: { type: Date, required: true },
    fechaMedicionOrigen: { type: String, required: true },
    estado: { type: String, default: '' },
    alturaAlerta: { type: Number },
    alturaEvacuacion: { type: Number },
    fuente: { type: String, required: true },
    consultadoEn: { type: Date, required: true }
}, { timestamps: true });

medicionRioSchema.index({ estacion: 1, fechaMedicion: 1 }, { unique: true });

module.exports = mongoose.model('MedicionRio', medicionRioSchema);
