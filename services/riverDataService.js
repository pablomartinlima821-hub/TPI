const MedicionRio = require('../models/MedicionRio');

const FUENTE_URL = 'https://contenidosweb.prefecturanaval.gob.ar/alturas/';
const ESTACION = 'GOYA';
const INTERVALO_CONSULTA_MS = 15 * 60 * 1000;
const MESES = {
    ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5,
    JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11
};

const estadoSincronizacion = {
    ultimaConsulta: null,
    ultimaConsultaExitosa: null,
    ultimoError: null
};

let temporizador = null;
let sincronizacionEnCurso = null;

const normalizarTexto = (valor) => valor
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();

const leerNumero = (valor, etiqueta) => {
    const texto = String(valor || '').trim().replace(',', '.');
    if (!texto || /^S\/E$/i.test(texto)) return null;
    const numero = Number(texto);
    if (!Number.isFinite(numero)) {
        throw new Error(`El dato "${etiqueta}" de Prefectura no es numérico.`);
    }
    return numero;
};

const parsearFechaMedicion = (valor) => {
    const coincidencia = /^(\d{1,2})\/([A-ZÁÉÍÓÚ]{3})\/(\d{2,4})\s*-\s*(\d{2})(\d{2})$/i.exec(
        String(valor || '').trim()
    );
    if (!coincidencia) {
        throw new Error('Prefectura publicó una fecha de medición con formato desconocido.');
    }

    const [, diaTexto, mesTexto, anioTexto, horaTexto, minutoTexto] = coincidencia;
    const mes = MESES[mesTexto.toUpperCase()];
    if (mes === undefined) {
        throw new Error('Prefectura publicó un mes de medición desconocido.');
    }

    const anioNumero = Number(anioTexto);
    const anio = anioTexto.length === 2 ? 2000 + anioNumero : anioNumero;
    const fecha = new Date(Date.UTC(
        anio,
        mes,
        Number(diaTexto),
        Number(horaTexto),
        Number(minutoTexto)
    ));

    if (Number.isNaN(fecha.getTime()) || fecha.getUTCDate() !== Number(diaTexto) ||
        fecha.getUTCHours() !== Number(horaTexto) || fecha.getUTCMinutes() !== Number(minutoTexto)) {
        throw new Error('Prefectura publicó una fecha de medición inválida.');
    }
    return fecha;
};

function parsearMedicionEstacion(html, estacion = ESTACION) {
    const filas = String(html).match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    const filaEstacion = filas.find((fila) => {
        const celdaPuerto = /<th\b([^>]*)>([\s\S]*?)<\/th>/i.exec(fila);
        const etiqueta = celdaPuerto?.[1].match(/\bdata-label\s*=\s*["']Puerto:?[\"']/i);
        return etiqueta && normalizarTexto(celdaPuerto[2]).toLocaleUpperCase('es-AR') ===
            estacion.toLocaleUpperCase('es-AR');
    });

    if (!filaEstacion) {
        throw new Error(`No se encontró la estación ${estacion} en los datos de Prefectura.`);
    }

    const celdas = [...filaEstacion.matchAll(/<(?:th|td)\b([^>]*)>([\s\S]*?)<\/(?:th|td)>/gi)];
    const valorPorEtiqueta = (etiquetaEsperada) => {
        const celda = celdas.find(([, atributos]) => {
            const etiqueta = /\bdata-label\s*=\s*["']([^"']+)["']/i.exec(atributos)?.[1];
            return etiqueta?.replace(/:$/, '').trim().toLocaleUpperCase('es-AR') ===
                etiquetaEsperada.toLocaleUpperCase('es-AR');
        });
        return celda ? normalizarTexto(celda[2]) : '';
    };

    const fechaOrigen = valorPorEtiqueta('Fecha Hora');
    const altura = leerNumero(valorPorEtiqueta('Ultimo Registro'), 'altura');
    if (altura === null) {
        throw new Error(`La estación ${estacion} no tiene una altura numérica disponible.`);
    }

    return {
        estacion,
        rio: valorPorEtiqueta('Río'),
        alturaMetros: altura,
        variacionMetros: leerNumero(valorPorEtiqueta('Variacion'), 'variación'),
        periodoHoras: leerNumero(valorPorEtiqueta('Periodo'), 'período'),
        fechaMedicion: parsearFechaMedicion(fechaOrigen),
        fechaMedicionOrigen: fechaOrigen,
        estado: valorPorEtiqueta('Estado'),
        alturaAlerta: leerNumero(valorPorEtiqueta('Alerta'), 'altura de alerta'),
        alturaEvacuacion: leerNumero(valorPorEtiqueta('Evacuación'), 'altura de evacuación'),
        fuente: FUENTE_URL
    };
}

async function consultarYGuardarMedicion() {
    if (sincronizacionEnCurso) return sincronizacionEnCurso;

    sincronizacionEnCurso = (async () => {
        estadoSincronizacion.ultimaConsulta = new Date();
        try {
            const respuesta = await fetch(FUENTE_URL, {
                signal: AbortSignal.timeout(15000),
                headers: { Accept: 'text/html' }
            });
            if (!respuesta.ok) {
                throw new Error(`Prefectura respondió con estado HTTP ${respuesta.status}.`);
            }

            const medicion = parsearMedicionEstacion(await respuesta.text());
            const consultadoEn = new Date();
            const documento = await MedicionRio.findOneAndUpdate(
                { estacion: medicion.estacion, fechaMedicion: medicion.fechaMedicion },
                { $set: { ...medicion, consultadoEn } },
                { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
            ).lean();

            estadoSincronizacion.ultimaConsultaExitosa = consultadoEn;
            estadoSincronizacion.ultimoError = null;
            return documento;
        } catch (error) {
            estadoSincronizacion.ultimoError = error.message;
            throw error;
        } finally {
            sincronizacionEnCurso = null;
        }
    })();

    return sincronizacionEnCurso;
}

function iniciarSincronizacionRio() {
    if (temporizador) return;

    const ejecutarSincronizacion = () => {
        consultarYGuardarMedicion().catch((error) => {
            console.error(`No se pudo actualizar la medición del río desde Prefectura: ${error.message}`);
        });
    };

    ejecutarSincronizacion();
    temporizador = setInterval(ejecutarSincronizacion, INTERVALO_CONSULTA_MS);
    temporizador.unref?.();
}

function obtenerEstadoSincronizacion() {
    return {
        ...estadoSincronizacion,
        intervaloMinutos: INTERVALO_CONSULTA_MS / 60000,
        fuente: FUENTE_URL
    };
}

module.exports = {
    FUENTE_URL,
    INTERVALO_CONSULTA_MS,
    ESTACION,
    parsearMedicionEstacion,
    consultarYGuardarMedicion,
    iniciarSincronizacionRio,
    obtenerEstadoSincronizacion
};
