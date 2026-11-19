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


class BarrioMetricasSerializer(serializers.Serializer):
    barrio = serializers.CharField(max_length=200)
    total = serializers.IntegerField(min_value=0)
    criticos = serializers.IntegerField(min_value=0)
    personasAfectadas = serializers.IntegerField(min_value=0)

    def validate(self, attrs):
        if attrs['criticos'] > attrs['total']:
            raise serializers.ValidationError(
                {'criticos': 'No puede superar el total de relevamientos del barrio.'}
            )
        return attrs


class ResumenInternoSerializer(serializers.Serializer):
    barrios = BarrioMetricasSerializer(many=True)
    ultimo = serializers.JSONField(allow_null=True)
