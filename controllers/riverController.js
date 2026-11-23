const MedicionRio = require('../models/MedicionRio');
const { ESTACION, obtenerEstadoSincronizacion } = require('../services/riverDataService');

const sincronizacionParaMedicion = (sincronizacion, medicion) => {
    const consultadoEn = new Date(medicion?.consultadoEn).getTime();
    const medicionReciente = Number.isFinite(consultadoEn) &&
        Date.now() - consultadoEn <= sincronizacion.intervaloMinutos * 2 * 60 * 1000;

    return {
        ...sincronizacion,
        ultimoError: medicionReciente ? null : sincronizacion.ultimoError
    };
};

const obtenerEstadoRio = async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        const medicion = await MedicionRio.findOne({ estacion: ESTACION })
            .sort({ fechaMedicion: -1 })
            .lean();
        const sincronizacion = obtenerEstadoSincronizacion();

        if (!medicion) {
            return res.status(503).json({
                mensaje: sincronizacion.ultimoError ||
                    'Todavía no hay una medición de Prefectura disponible.',
                sincronizacion
            });
        }

        return res.status(200).json({
            medicion,
            sincronizacion: sincronizacionParaMedicion(sincronizacion, medicion)
        });
    } catch (error) {
        console.error(`No se pudo consultar la medición del río en MongoDB: ${error.message}`);
        return res.status(500).json({ mensaje: 'No se pudo consultar la medición del río.' });
    }
};

module.exports = { obtenerEstadoRio, sincronizacionParaMedicion };
