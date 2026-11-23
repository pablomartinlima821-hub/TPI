const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const Relevamiento = require('../models/Relevamiento');
const MedicionRio = require('../../models/MedicionRio');
const {
    evaluarRiesgoEvacuacion,
    UMBRAL_EVACUACION_METROS
} = require('../Servicios/relevamientoServicio');
const { generarResumenTerritorial } = require('../../services/djangoReportService');

const ESTACION_RIO = 'GOYA';
const ESTADOS_SEGUIMIENTO = ['pendiente', 'en-seguimiento', 'resuelto'];

const crearFiltro = (query) => {
    const filtro = {};
    const barrio = typeof query.barrio === 'string' ? query.barrio.trim() : '';

    if (barrio) {
        const terminoSeguro = barrio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filtro.barrio = { $regex: terminoSeguro, $options: 'i' };
    }

    if (query.riesgo === 'critico') filtro.nivelRioParana = { $gte: UMBRAL_EVACUACION_METROS };
    if (query.riesgo === 'sin-alerta') filtro.nivelRioParana = { $lt: UMBRAL_EVACUACION_METROS };
    if (query.riesgo && !['critico', 'sin-alerta'].includes(query.riesgo)) {
        return { error: 'El filtro de riesgo no es válido.' };
    }

    const desde = query.desde ? new Date(query.desde) : null;
    const hasta = query.hasta ? new Date(query.hasta) : null;
    if ((desde && Number.isNaN(desde.getTime())) || (hasta && Number.isNaN(hasta.getTime()))) {
        return { error: 'Las fechas del filtro no son válidas.' };
    }
    if (desde || hasta) {
        filtro.fechaRegistro = {};
        if (desde) filtro.fechaRegistro.$gte = desde;
        if (hasta) {
            hasta.setDate(hasta.getDate() + 1);
            filtro.fechaRegistro.$lt = hasta;
        }
    }

    return { filtro };
};

const crearRegistro = async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.usuarioAutenticado.id).select('nombre email');
        if (!usuario) {
            return res.status(401).json({ mensaje: 'La cuenta asociada a esta sesión ya no existe.' });
        }

        const nivelRioOrigen = req.body.nivelRioOrigen || 'manual';
        if (!['manual', 'prefectura'].includes(nivelRioOrigen)) {
            return res.status(400).json({ mensaje: 'El origen del nivel del río no es válido.' });
        }

        let nivelRioParana = Number(req.body.nivelRioParana);
        let fechaMedicionRio;
        if (nivelRioOrigen === 'prefectura') {
            const medicion = await MedicionRio.findOne({ estacion: ESTACION_RIO })
                .sort({ fechaMedicion: -1 })
                .lean();
            if (!medicion) {
                return res.status(503).json({ mensaje: 'No hay una medición de Prefectura disponible para usar.' });
            }
            nivelRioParana = medicion.alturaMetros;
            fechaMedicionRio = medicion.fechaMedicion;
        }

        const nuevoRelevamiento = new Relevamiento({
            barrio: req.body.barrio.trim(),
            nivelRioParana,
            nivelRioOrigen,
            fechaMedicionRio,
            estadoEvacuacion: evaluarRiesgoEvacuacion(nivelRioParana),
            coordenadas: {
                lat: Number(req.body.coordenadas.lat),
                lng: Number(req.body.coordenadas.lng)
            },
            personasAfectadas: req.body.personasAfectadas === undefined ? 0 : Number(req.body.personasAfectadas),
            necesidades: typeof req.body.necesidades === 'string' ? req.body.necesidades.trim() : '',
            observaciones: typeof req.body.observaciones === 'string' ? req.body.observaciones.trim() : '',
            registradoPor: { nombre: usuario.nombre, email: usuario.email }
        });

        await nuevoRelevamiento.save();
        return res.status(201).json({ mensaje: 'Relevamiento guardado.', data: nuevoRelevamiento });
    } catch (error) {
        return res.status(500).json({ mensaje: 'Error al guardar el relevamiento.', error: error.message });
    }
};

const obtenerRegistros = async (req, res) => {
    try {
        const resultadoFiltro = crearFiltro(req.query);
        if (resultadoFiltro.error) return res.status(400).json({ mensaje: resultadoFiltro.error });

        const relevamientos = await Relevamiento.find(resultadoFiltro.filtro)
            .sort({ fechaRegistro: -1 })
            .limit(500)
            .lean();
        return res.status(200).json(relevamientos.map((registro) => ({
            ...registro,
            estadoEvacuacion: evaluarRiesgoEvacuacion(registro.nivelRioParana)
        })));
    } catch (error) {
        return res.status(500).json({ mensaje: 'Error al obtener los relevamientos.', error: error.message });
    }
};

const obtenerResumen = async (req, res) => {
    try {
        const resultadoFiltro = crearFiltro(req.query);
        if (resultadoFiltro.error) return res.status(400).json({ mensaje: resultadoFiltro.error });

        const [barrios, ultimo] = await Promise.all([
            Relevamiento.aggregate([
            { $match: resultadoFiltro.filtro },
            {
                $group: {
                    _id: '$barrio',
                    total: { $sum: 1 },
                    criticos: {
                        $sum: {
                            $cond: [
                                { $gte: ['$nivelRioParana', UMBRAL_EVACUACION_METROS] },
                                1,
                                0
                            ]
                        }
                    },
                    personasAfectadas: { $sum: { $ifNull: ['$personasAfectadas', 0] } }
                }
            }
            ]),
            Relevamiento.findOne(resultadoFiltro.filtro)
                .sort({ fechaRegistro: -1 })
                .select('fechaRegistro barrio')
                .lean()
        ]);

        const resumen = await generarResumenTerritorial({
            barrios: barrios.map(({ _id, ...metricas }) => ({ barrio: _id, ...metricas })),
            ultimo
        });
        return res.status(200).json(resumen);
    } catch (error) {
        if ([502, 503].includes(error.statusCode)) {
            console.error('Error al consultar el servicio de reportes Django:', error.message);
            return res.status(error.statusCode).json({
                mensaje: 'El servicio Django no pudo generar el resumen territorial.'
            });
        }
        return res.status(500).json({ mensaje: 'Error al calcular el resumen.', error: error.message });
    }
};

const escaparCsv = (valor) => {
    let texto = String(valor ?? '');
    if (/^[\s]*[=+\-@]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
};

const exportarCsv = async (req, res) => {
    try {
        const resultadoFiltro = crearFiltro(req.query);
        if (resultadoFiltro.error) return res.status(400).json({ mensaje: resultadoFiltro.error });

        const relevamientos = await Relevamiento.find(resultadoFiltro.filtro)
            .sort({ fechaRegistro: -1 })
            .lean();
        const encabezados = [
            'Fecha', 'Barrio', 'Nivel del río (m)', 'Origen del nivel', 'Fecha de medición del río',
            'Riesgo estimado', 'Estado de seguimiento',
            'Personas afectadas', 'Necesidades', 'Observaciones',
            'Latitud', 'Longitud', 'Registrado por', 'Correo del responsable'
        ];
        const filas = relevamientos.map((registro) => [
            registro.fechaRegistro?.toISOString(),
            registro.barrio,
            registro.nivelRioParana,
            registro.nivelRioOrigen === 'prefectura' ? 'Prefectura' : 'Manual',
            registro.fechaMedicionRio?.toISOString(),
            evaluarRiesgoEvacuacion(registro.nivelRioParana)
                ? `Evacuación según umbral del proyecto (≥ ${UMBRAL_EVACUACION_METROS} m)`
                : 'Por debajo del umbral de evacuación',
            registro.estadoSeguimiento || 'pendiente',
            registro.personasAfectadas || 0,
            registro.necesidades,
            registro.observaciones,
            registro.coordenadas?.lat,
            registro.coordenadas?.lng,
            registro.registradoPor?.nombre,
            registro.registradoPor?.email
        ]);
        const csv = [encabezados, ...filas].map((fila) => fila.map(escaparCsv).join(',')).join('\r\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="relevamientos.csv"');
        return res.status(200).send(`\uFEFF${csv}`);
    } catch (error) {
        return res.status(500).json({ mensaje: 'Error al exportar los relevamientos.', error: error.message });
    }
};

// NUEVA FUNCIÓN PARA ACTUALIZAR REGISTROS
const actualizarRegistro = async (req, res) => {
    try {
        const { id } = req.params;
        const nivelRioParana = req.body.nivelRioParana !== undefined ? Number(req.body.nivelRioParana) : undefined;

        const datosActualizados = {
            ...(req.body.barrio && { barrio: req.body.barrio.trim() }),
            ...(nivelRioParana !== undefined && {
                nivelRioParana,
                estadoEvacuacion: evaluarRiesgoEvacuacion(nivelRioParana),
                nivelRioOrigen: 'manual',
                fechaMedicionRio: null
            }),
            ...(req.body.coordenadas && {
                coordenadas: {
                    lat: Number(req.body.coordenadas.lat),
                    lng: Number(req.body.coordenadas.lng)
                }
            }),
            ...(req.body.personasAfectadas !== undefined && { personasAfectadas: Number(req.body.personasAfectadas) }),
            ...(typeof req.body.necesidades === 'string' && { necesidades: req.body.necesidades.trim() }),
            ...(typeof req.body.observaciones === 'string' && { observaciones: req.body.observaciones.trim() })
        };

        const registroActualizado = await Relevamiento.findByIdAndUpdate(
            id,
            datosActualizados,
            { new: true, runValidators: true }
        );

        if (!registroActualizado) {
            return res.status(404).json({ mensaje: 'Registro de relevamiento no encontrado.' });
        }

        return res.status(200).json({ mensaje: 'Relevamiento actualizado exitosamente.', data: registroActualizado });
    } catch (error) {
        return res.status(500).json({ mensaje: 'Error al actualizar el relevamiento.', error: error.message });
    }
};

const actualizarSeguimiento = async (req, res) => {
    const { id } = req.params;
    const estadoSeguimiento = req.body?.estadoSeguimiento;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ mensaje: 'El identificador del relevamiento no es válido.' });
    }
    if (!ESTADOS_SEGUIMIENTO.includes(estadoSeguimiento)) {
        return res.status(400).json({ mensaje: 'El estado de seguimiento no es válido.' });
    }

    try {
        const relevamiento = await Relevamiento.findByIdAndUpdate(
            id,
            {
                $set: {
                    estadoSeguimiento,
                    seguimientoActualizadoEn: new Date(),
                    seguimientoActualizadoPor: {
                        id: req.usuarioAutenticado.id,
                        email: req.usuarioAutenticado.email
                    }
                }
            },
            { new: true, runValidators: true }
        ).lean();

        if (!relevamiento) {
            return res.status(404).json({ mensaje: 'No se encontró el relevamiento.' });
        }

        return res.status(200).json({ mensaje: 'Seguimiento actualizado.', data: relevamiento });
    } catch (error) {
        return res.status(500).json({ mensaje: 'No se pudo actualizar el seguimiento.', error: error.message });
    }
};

module.exports = { 
    crearRegistro, 
    exportarCsv, 
    obtenerRegistros, 
    obtenerResumen, 
    actualizarRegistro,
    actualizarSeguimiento
};