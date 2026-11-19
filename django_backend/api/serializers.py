from rest_framework import serializers

from .models import Relevamiento


class RelevamientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Relevamiento
        fields = [
            'id',
            'barrio',
            'nivel_rio_parana',
            'nivel_rio_origen',
            'fecha_medicion_rio',
            'estado_evacuacion',
            'estado_seguimiento',
            'personas_afectadas',
            'necesidades',
            'observaciones',
            'latitud',
            'longitud',
            'registrado_por_nombre',
            'registrado_por_email',
            'fecha_registro',
        ]
        read_only_fields = ['estado_evacuacion', 'fecha_registro']
