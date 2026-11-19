from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Relevamiento
from .permissions import IsNodeService
from .serializers import RelevamientoSerializer, ResumenInternoSerializer


class RelevamientoViewSet(ModelViewSet):
    queryset = Relevamiento.objects.all()
    serializer_class = RelevamientoSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        barrio = self.request.query_params.get('barrio')
        riesgo = self.request.query_params.get('riesgo')

        if barrio:
            queryset = queryset.filter(barrio__icontains=barrio)
        if riesgo == 'critico':
            queryset = queryset.filter(nivel_rio_parana__gte=7)
        elif riesgo == 'sin-alerta':
            queryset = queryset.filter(nivel_rio_parana__lt=7)

        return queryset[:500]


@api_view(['POST'])
@permission_classes([IsNodeService])
def generar_resumen_interno(request):
    serializer = ResumenInternoSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    barrios = serializer.validated_data['barrios']

    total = sum(barrio['total'] for barrio in barrios)
    criticos = sum(barrio['criticos'] for barrio in barrios)
    personas_afectadas = sum(barrio['personasAfectadas'] for barrio in barrios)
    porcentaje_criticos = round(criticos * 100 / total, 2) if total else 0

    prioritarios = sorted(
        barrios,
        key=lambda barrio: (
            -barrio['personasAfectadas'],
            -barrio['criticos'],
            barrio['barrio'].casefold(),
        ),
    )[:5]

    return Response({
        'total': total,
        'criticos': criticos,
        'personasAfectadas': personas_afectadas,
        'ultimo': serializer.validated_data['ultimo'],
        'porcentajeCriticos': porcentaje_criticos,
        'barriosPrioritarios': prioritarios,
        'procesadoPor': 'django',
        'fechaGeneracion': timezone.now(),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok', 'backend': 'django'})
