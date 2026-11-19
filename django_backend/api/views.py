from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Relevamiento
from .serializers import RelevamientoSerializer


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


@api_view(['GET'])
@AllowAny
def health(request):
    return Response({'status': 'ok', 'backend': 'django'})
