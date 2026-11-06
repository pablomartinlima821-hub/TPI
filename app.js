const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Rutas de la API
app.use('/api/auth', require('./relevamiento_territorial/routes/authRoutes'));
app.use('/api/relevamientos', require('./relevamiento_territorial/routes/surveyRoutes'));

app.get('/web', async (req, res) => {
    const html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf8');
    const enhancedHtml = html.replace(
        '</head>',
        '    <link rel="stylesheet" href="/frontend.css">\n</head>'
    );

    res.type('html').send(enhancedHtml);
});

app.get('/frontend.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend.css'));
});

// Ruta de comprobación general
app.get('/', (req, res) => {
    res.send('API de Relevamiento Territorial funcionando');
});

module.exports = app;