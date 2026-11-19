const { generarResumenTerritorial } = require('../services/djangoReportService');

describe('Servicio de reportes Django', () => {
    const originalFetch = global.fetch;
    const originalToken = process.env.INTERNAL_API_TOKEN;

    beforeEach(() => {
        process.env.INTERNAL_API_TOKEN = 'test-internal-token';
        global.fetch = jest.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        if (originalToken === undefined) {
            delete process.env.INTERNAL_API_TOKEN;
        } else {
            process.env.INTERNAL_API_TOKEN = originalToken;
        }
    });

    it('envía las métricas a Django con autenticación interna', async () => {
        const payload = { barrios: [], ultimo: null };
        const resumen = {
            total: 0,
            criticos: 0,
            personasAfectadas: 0,
            ultimo: null,
            porcentajeCriticos: 0,
            barriosPrioritarios: [],
            procesadoPor: 'django'
        };
        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(resumen)
        });

        await expect(generarResumenTerritorial(payload)).resolves.toEqual(resumen);
        expect(global.fetch).toHaveBeenCalledWith(
            'http://127.0.0.1:8000/api/internal/reportes/resumen/',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Token': 'test-internal-token'
                },
                body: JSON.stringify(payload)
            })
        );
    });

    it('falla explícitamente si falta el token interno', async () => {
        delete process.env.INTERNAL_API_TOKEN;

        await expect(generarResumenTerritorial({ barrios: [], ultimo: null }))
            .rejects.toMatchObject({ statusCode: 503 });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rechaza respuestas no exitosas del servicio Django', async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 500 });

        await expect(generarResumenTerritorial({ barrios: [], ultimo: null }))
            .rejects.toMatchObject({ statusCode: 502 });
    });

    it('traduce errores de conexión en un error de servicio explícito', async () => {
        global.fetch.mockRejectedValue(new Error('connection refused'));

        await expect(generarResumenTerritorial({ barrios: [], ultimo: null }))
            .rejects.toMatchObject({ statusCode: 503 });
    });

    it('rechaza una respuesta Django con formato inválido', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(null)
        });

        await expect(generarResumenTerritorial({ barrios: [], ultimo: null }))
            .rejects.toMatchObject({ statusCode: 502 });
    });
});
