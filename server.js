const dotenv = require('dotenv');
const http = require('http');

// Cargar variables de entorno
dotenv.config();

const app = require('./app');
const connectDB = require('./relevamiento_territorial/config/db');
const { iniciarSincronizacionRio } = require('./services/riverDataService');
const { adjuntarWebSocket } = require('./services/realtimeService');

const PORT = process.env.PORT || 5000;
const servidor = http.createServer(app);
adjuntarWebSocket(servidor);

const iniciarServidor = async () => {
    await connectDB();
    console.log('🟢 Base de datos conectada correctamente');
    iniciarSincronizacionRio();
    
    servidor.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    });
};

iniciarServidor();