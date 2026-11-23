const UMBRAL_EVACUACION_METROS = 7;

const evaluarRiesgoEvacuacion = (nivelRio) => {
    return nivelRio >= UMBRAL_EVACUACION_METROS;
};

module.exports = { evaluarRiesgoEvacuacion, UMBRAL_EVACUACION_METROS };