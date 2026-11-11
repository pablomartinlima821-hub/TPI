const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const app = require('./app');
const connectDB = require('./relevamiento_territorial/config/db');
const { iniciarSincronizacionRio } = require('./services/riverDataService');

const PORT = process.env.PORT || 5000;

const iniciarServidor = async () => {
    await connectDB();
    console.log('🟢 Base de datos conectada correctamente');
    iniciarSincronizacionRio();
    
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    });
};

iniciarServidor();