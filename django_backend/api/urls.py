from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import RelevamientoViewSet, generar_resumen_interno, health

router = DefaultRouter()
router.register('relevamientos', RelevamientoViewSet, basename='relevamiento')

urlpatterns = [
    path('health/', health),
    path('internal/reportes/resumen/', generar_resumen_interno),
    path('auth/', include('rest_framework.urls', namespace='rest_framework')),
    path('', include(router.urls)),
]
