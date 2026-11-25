const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

const RUTA_ACTUALIZACIONES = '/api/updates';
const TIEMPO_AUTENTICACION_MS = 5000;
const INTERVALO_LATIDO_MS = 30000;
const EVENTOS_PERMITIDOS = new Set([
    'river.updated',
    'reports.changed',
    'neighborhoods.changed'
]);

let webSocketServer = null;
let temporizadorLatido = null;

const adjuntarWebSocket = (servidorHttp) => {
    if (webSocketServer) {
        throw new Error('El servidor de actualizaciones WebSocket ya está iniciado.');
    }

    const servidorWs = new WebSocket.Server({ noServer: true, maxPayload: 4096 });
    const manejarUpgrade = (solicitud, socket, cabecera) => {
        let ruta;
        try {
            ruta = new URL(solicitud.url, 'http://localhost').pathname;
        } catch (error) {
            socket.destroy();
            return;
        }

        if (ruta !== RUTA_ACTUALIZACIONES) {
            socket.destroy();
            return;
        }

        servidorWs.handleUpgrade(solicitud, socket, cabecera, (conexion) => {
            servidorWs.emit('connection', conexion, solicitud);
        });
    };

    servidorHttp.on('upgrade', manejarUpgrade);
    servidorWs.on('connection', (conexion) => {
        conexion.isAlive = true;
        conexion.isAuthenticated = false;
        const temporizadorAutenticacion = setTimeout(() => {
            conexion.close(1008, 'Authentication required');
        }, TIEMPO_AUTENTICACION_MS);
        temporizadorAutenticacion.unref?.();

        conexion.on('pong', () => {
            conexion.isAlive = true;
        });
        conexion.on('message', (mensaje) => {
            if (conexion.isAuthenticated) {
                conexion.close(1008, 'Unexpected message');
                return;
            }

            let autenticacion;
            try {
                autenticacion = JSON.parse(mensaje.toString());
            } catch (error) {
                conexion.close(1008, 'Invalid authentication message');
                return;
            }

            if (autenticacion.type !== 'authenticate' ||
                typeof autenticacion.token !== 'string' ||
                !process.env.JWT_SECRET) {
                conexion.close(1008, 'Invalid authentication');
                return;
            }

            try {
                const usuario = jwt.verify(autenticacion.token, process.env.JWT_SECRET);
                if (!usuario.id || !['admin', 'encuestador'].includes(usuario.rol)) {
                    conexion.close(1008, 'Invalid authentication');
                    return;
                }

                conexion.isAuthenticated = true;
                clearTimeout(temporizadorAutenticacion);
                conexion.send(JSON.stringify({ type: 'authenticated' }));
            } catch (error) {
                conexion.close(1008, 'Invalid authentication');
            }
        });
        conexion.on('close', () => clearTimeout(temporizadorAutenticacion));
        conexion.on('error', (error) => {
            console.error(`Error en la conexión WebSocket: ${error.message}`);
        });
    });

    temporizadorLatido = setInterval(() => {
        servidorWs.clients.forEach((conexion) => {
            if (!conexion.isAlive) {
                conexion.terminate();
                return;
            }
            conexion.isAlive = false;
            conexion.ping();
        });
    }, INTERVALO_LATIDO_MS);
    temporizadorLatido.unref?.();
    webSocketServer = servidorWs;

    return () => {
        clearInterval(temporizadorLatido);
        temporizadorLatido = null;
        servidorHttp.removeListener('upgrade', manejarUpgrade);
        servidorWs.clients.forEach((conexion) => conexion.terminate());
        servidorWs.close();
        webSocketServer = null;
    };
};

const emitirActualizacion = (tipo) => {
    if (!EVENTOS_PERMITIDOS.has(tipo)) {
        throw new TypeError(`El evento WebSocket "${tipo}" no está permitido.`);
    }
    if (!webSocketServer) return 0;

    const mensaje = JSON.stringify({ type: tipo });
    let conexionesNotificadas = 0;
    webSocketServer.clients.forEach((conexion) => {
        if (conexion.readyState !== WebSocket.OPEN || !conexion.isAuthenticated) return;
        conexion.send(mensaje, (error) => {
            if (error) console.error(`No se pudo enviar actualización WebSocket: ${error.message}`);
        });
        conexionesNotificadas += 1;
    });
    return conexionesNotificadas;
};

module.exports = { adjuntarWebSocket, emitirActualizacion };
