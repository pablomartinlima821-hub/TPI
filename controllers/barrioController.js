const crypto = require('crypto');
const Barrio = require('../models/Barrio');
const Relevamiento = require('../relevamiento_territorial/models/Relevamiento');

const BARRIOS_INICIALES = [
    {
        clave: 'puerto-costanera',
        nombre: 'Zona Puerto / Costanera',
        ubicacion: 'Puerto y Costanera de Goya',
        situacion: 'estable',
        orden: 1
    },
    {
        clave: 'matadero-riacho-goya',
        nombre: 'B° Matadero / Riacho Goya',
        ubicacion: 'Barrio Matadero, zona del Riacho Goya',
        situacion: 'critico',
        orden: 2
    },
    {
        clave: 'paraje-el-bajo',
        nombre: 'Zona Paraje El Bajo',
        ubicacion: 'Paraje El Bajo',
        situacion: 'estable',
        orden: 3
    }
];

const inicializarBarrios = async () => {
    await Promise.all(BARRIOS_INICIALES.map(async (barrio) => {
        try {
            await Barrio.updateOne(
                { clave: barrio.clave },
                {
                    $setOnInsert: {
                        nombre: barrio.nombre,
                        ubicacion: barrio.ubicacion,
                        origenNombre: barrio.nombre,
                        situacion: barrio.situacion,
                        orden: barrio.orden
                    }
                },
                { upsert: true }
            );
            await Barrio.updateOne(
                { clave: barrio.clave, origenNombre: { $exists: false } },
                { $set: { origenNombre: barrio.nombre } }
            );
            await Barrio.updateOne(
                { clave: barrio.clave, situacion: { $exists: false } },
                { $set: { situacion: barrio.situacion } }
            );
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
    }));
};

const importarBarriosRelevados = async () => {
    const relevamientos = await Relevamiento.aggregate([
        { $match: { barrio: { $type: 'string', $ne: '' } } },
        { $sort: { fechaRegistro: -1 } },
        {
            $group: {
                _id: { $trim: { input: '$barrio' } },
                coordenadas: { $first: '$coordenadas' }
            }
        },
        { $match: { _id: { $ne: '' } } }
    ]);
    const nombres = relevamientos.map(({ _id }) => _id);
    if (!nombres.length) return;

    const existentes = await Barrio.find({
        $or: [
            { origenNombre: { $in: nombres } },
            { nombre: { $in: nombres } }
        ]
    }).select('nombre origenNombre coordenadas').lean();
    const nombresExistentes = new Set();
    const barrioPorNombreOrigen = new Map();
    existentes.forEach((barrio) => {
        if (barrio.origenNombre) nombresExistentes.add(barrio.origenNombre);
        nombresExistentes.add(barrio.nombre);
        barrioPorNombreOrigen.set(barrio.origenNombre || barrio.nombre, barrio);
    });

    const ultimoBarrio = await Barrio.findOne().sort({ orden: -1 }).select('orden').lean();
    let orden = Number(ultimoBarrio?.orden || 0) + 1;
    for (const relevamiento of relevamientos) {
        const nombre = relevamiento._id;
        if (nombresExistentes.has(nombre)) {
            const existente = barrioPorNombreOrigen.get(nombre);
            if (existente && (!existente.origenNombre || !existente.coordenadas) && relevamiento.coordenadas) {
                const cambios = {};
                if (!existente.origenNombre) cambios.origenNombre = nombre;
                if (!existente.coordenadas) cambios.coordenadas = relevamiento.coordenadas;
                await Barrio.updateOne({ _id: existente._id }, { $set: cambios });
            }
            continue;
        }

        const clave = `relevamiento-${crypto.createHash('sha256').update(nombre).digest('hex').slice(0, 24)}`;
        try {
            await Barrio.updateOne(
                { clave },
                {
                    $setOnInsert: {
                        clave,
                        nombre,
                        ubicacion: 'Ubicación registrada en relevamientos',
                        origenNombre: nombre,
                        coordenadas: relevamiento.coordenadas || null,
                        situacion: 'sin_datos',
                        orden
                    }
                },
                { upsert: true }
            );
            nombresExistentes.add(nombre);
            orden += 1;
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
    }
};

const obtenerBarrios = async (req, res) => {
    try {
        await inicializarBarrios();
        await importarBarriosRelevados();
        await Barrio.updateMany(
            { clave: /^relevamiento-/, situacion: { $exists: false } },
            { $set: { situacion: 'sin_datos' } }
        );
        await Barrio.updateMany(
            { situacion: { $exists: false } },
            { $set: { situacion: 'estable' } }
        );
        const barrios = await Barrio.find({ eliminado: { $ne: true } }).sort({ orden: 1 }).lean();
        return res.status(200).json(barrios);
    } catch (error) {
        console.error(`No se pudieron consultar los barrios: ${error.message}`);
        return res.status(500).json({ mensaje: 'No se pudieron consultar los barrios.' });
    }
};

const actualizarBarrio = async (req, res) => {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const ubicacion = typeof req.body?.ubicacion === 'string' ? req.body.ubicacion.trim() : '';
    const latTexto = req.body?.coordenadas?.lat;
    const lngTexto = req.body?.coordenadas?.lng;
    const lat = typeof latTexto === 'number' || typeof latTexto === 'string' ? Number(latTexto) : NaN;
    const lng = typeof lngTexto === 'number' || typeof lngTexto === 'string' ? Number(lngTexto) : NaN;
    const situacion = req.body?.situacion;
    const personasAfectadasIncluidas = req.body?.personasAfectadas !== undefined;
    const personasAfectadasTexto = req.body?.personasAfectadas;
    const personasAfectadas = typeof personasAfectadasTexto === 'number'
        ? personasAfectadasTexto
        : typeof personasAfectadasTexto === 'string' && personasAfectadasTexto.trim()
            ? Number(personasAfectadasTexto)
            : NaN;
    const motivoSituacion = typeof req.body?.motivoSituacion === 'string'
        ? req.body.motivoSituacion.trim()
        : '';
    const coordenadasIncluidas = latTexto !== undefined || lngTexto !== undefined;
    const coordenadasInvalidas = coordenadasIncluidas &&
        (!Number.isFinite(lat) || lat < -29.5 || lat > -29 ||
            !Number.isFinite(lng) || lng < -59.5 || lng > -59);

    if (!nombre || nombre.length > 120 || !ubicacion || ubicacion.length > 300 ||
        coordenadasInvalidas ||
        (situacion !== undefined && !['critico', 'estable', 'sin_datos'].includes(situacion)) ||
        motivoSituacion.length > 300) {
        return res.status(400).json({
            mensaje: 'Ingresa un nombre, una ubicación, coordenadas válidas dentro del área de Goya (si las modificas, completa latitud y longitud) y una situación válida.'
        });
    }
    if (personasAfectadasIncluidas &&
        (!Number.isSafeInteger(personasAfectadas) || personasAfectadas < 0)) {
        return res.status(400).json({
            mensaje: 'La cantidad de personas afectadas debe ser un entero no negativo.'
        });
    }

    try {
        const filtro = { clave: req.params.clave, eliminado: { $ne: true } };
        const barrioExistente = await Barrio.findOne(filtro).lean();
        if (!barrioExistente) {
            return res.status(404).json({ mensaje: 'No se encontró el barrio que quieres editar.' });
        }

        const actualizaciones = {
            $set: {
                nombre,
                ubicacion,
                ...(coordenadasIncluidas ? { coordenadas: { lat, lng } } : {}),
                ...(situacion ? { situacion } : {}),
                ...(personasAfectadasIncluidas ? { personasAfectadas } : {})
            }
        };
        if (situacion && situacion !== (barrioExistente.situacion || 'sin_datos')) {
            actualizaciones.$push = {
                historialSituacion: {
                    situacionAnterior: barrioExistente.situacion || 'sin_datos',
                    situacionNueva: situacion,
                    motivo: motivoSituacion || 'Cambio manual de situación',
                    actualizadoEn: new Date(),
                    actualizadoPor: {
                        id: req.usuarioAutenticado.id,
                        email: req.usuarioAutenticado.email
                    }
                }
            };
        }

        const barrio = await Barrio.findOneAndUpdate(
            filtro,
            actualizaciones,
            { new: true, runValidators: true }
        ).lean();

        if (!barrio) {
            return res.status(404).json({ mensaje: 'No se encontró el barrio que quieres editar.' });
        }

        return res.status(200).json({ mensaje: 'Barrio actualizado.', data: barrio });
    } catch (error) {
        console.error(`No se pudo actualizar el barrio: ${error.message}`);
        return res.status(500).json({ mensaje: 'No se pudo actualizar el barrio.' });
    }
};

const eliminarBarrio = async (req, res) => {
    try {
        const barrio = await Barrio.findOneAndUpdate(
            { clave: req.params.clave, eliminado: { $ne: true } },
            { $set: { eliminado: true } },
            { new: true }
        ).lean();

        if (!barrio) {
            return res.status(404).json({ mensaje: 'No se encontró el barrio que quieres eliminar.' });
        }

        return res.status(200).json({ mensaje: 'Barrio eliminado de la lista.' });
    } catch (error) {
        console.error(`No se pudo eliminar el barrio: ${error.message}`);
        return res.status(500).json({ mensaje: 'No se pudo eliminar el barrio.' });
    }
};

module.exports = { obtenerBarrios, actualizarBarrio, eliminarBarrio };
