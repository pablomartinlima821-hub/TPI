const REPORTS_URL = () => process.env.DJANGO_REPORTS_URL
    || 'http://127.0.0.1:8000/api/internal/reportes/resumen/';

const generarResumenTerritorial = async (datos) => {
    const token = process.env.INTERNAL_API_TOKEN;
    if (!token) {
        const error = new Error('Falta configurar INTERNAL_API_TOKEN.');
        error.statusCode = 503;
        throw error;
    }

    let response;
    try {
        response = await fetch(REPORTS_URL(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Token': token
            },
            body: JSON.stringify(datos),
            signal: AbortSignal.timeout(5000)
        });
    } catch (cause) {
        const error = new Error('El servicio de reportes Django no está disponible.', { cause });
        error.statusCode = 503;
        throw error;
    }

    if (!response.ok) {
        const error = new Error(`El servicio de reportes Django respondió HTTP ${response.status}.`);
        error.statusCode = 502;
        throw error;
    }

    const resumen = await response.json();
    if (
        !resumen
        || !Number.isInteger(resumen.total)
        || !Number.isInteger(resumen.criticos)
        || !Number.isInteger(resumen.personasAfectadas)
        || !Array.isArray(resumen.barriosPrioritarios)
        || resumen.procesadoPor !== 'django'
    ) {
        const error = new Error('El servicio de reportes Django devolvió una respuesta inválida.');
        error.statusCode = 502;
        throw error;
    }

    return resumen;
};

module.exports = { generarResumenTerritorial };
