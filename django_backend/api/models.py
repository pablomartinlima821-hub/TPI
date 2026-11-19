from django.db import models


class Relevamiento(models.Model):
    ESTADOS_SEGUIMIENTO = [
        ('pendiente', 'Pendiente'),
        ('en-seguimiento', 'En seguimiento'),
        ('resuelto', 'Resuelto'),
    ]
    ORIGENES_NIVEL = [
        ('manual', 'Manual'),
        ('prefectura', 'Prefectura'),
    ]

    barrio = models.CharField(max_length=200)
    nivel_rio_parana = models.FloatField()
    nivel_rio_origen = models.CharField(
        max_length=20,
        choices=ORIGENES_NIVEL,
        default='manual',
    )
    fecha_medicion_rio = models.DateTimeField(null=True, blank=True)
    estado_evacuacion = models.BooleanField(default=False)
    estado_seguimiento = models.CharField(
        max_length=20,
        choices=ESTADOS_SEGUIMIENTO,
        default='pendiente',
    )
    personas_afectadas = models.PositiveIntegerField(default=0)
    necesidades = models.TextField(max_length=1000, blank=True, default='')
    observaciones = models.TextField(max_length=2000, blank=True, default='')
    latitud = models.FloatField()
    longitud = models.FloatField()
    registrado_por_nombre = models.CharField(max_length=200, blank=True, default='')
    registrado_por_email = models.EmailField(blank=True, default='')
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_registro']

    def save(self, *args, **kwargs):
        self.estado_evacuacion = self.nivel_rio_parana >= 7
        super().save(*args, **kwargs)
