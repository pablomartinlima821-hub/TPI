const http = require('http');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const {
    adjuntarWebSocket,
    emitirActualizacion
} = require('../services/realtimeService');

describe('Actualizaciones WebSocket', () => {
    let servidor;
    let cerrarWebSocket;
    let conexion;

    beforeEach(async () => {
        servidor = http.createServer();
        cerrarWebSocket = adjuntarWebSocket(servidor);
        await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    });

    afterEach(async () => {
        if (conexion && conexion.readyState !== WebSocket.CLOSED) {
            await new Promise((resolve) => {
                conexion.once('close', resolve);
                conexion.terminate();
            });
        }
        cerrarWebSocket();
        await new Promise((resolve) => servidor.close(resolve));
    });

    const conectar = () => {
        const { port } = servidor.address();
        conexion = new WebSocket(`ws://127.0.0.1:${port}/api/updates`);
        return conexion;
    };

    it('solo envía señales de cambio a clientes autenticados', async () => {
        process.env.JWT_SECRET = 'test-only-secret-never-use-in-production';
        const socket = conectar();
        await new Promise((resolve) => socket.once('open', resolve));

        const confirmacion = new Promise((resolve) => {
            socket.once('message', (mensaje) => resolve(JSON.parse(mensaje.toString())));
        });
        socket.send(JSON.stringify({
            type: 'authenticate',
            token: jwt.sign(
                { id: '507f1f77bcf86cd799439011', rol: 'admin' },
                process.env.JWT_SECRET
            )
        }));
        await expect(confirmacion).resolves.toEqual({ type: 'authenticated' });

        const actualizacion = new Promise((resolve) => {
            socket.once('message', (mensaje) => resolve(JSON.parse(mensaje.toString())));
        });
        expect(emitirActualizacion('reports.changed')).toBe(1);
        await expect(actualizacion).resolves.toEqual({ type: 'reports.changed' });
    });

    it('cierra la conexión si el token no es válido', async () => {
        const socket = conectar();
        await new Promise((resolve) => socket.once('open', resolve));

        const cierre = new Promise((resolve) => socket.once('close', resolve));
        socket.send(JSON.stringify({ type: 'authenticate', token: 'token-invalido' }));
        const codigo = await cierre;

        expect(codigo).toBe(1008);
        expect(emitirActualizacion('river.updated')).toBe(0);
    });
});
