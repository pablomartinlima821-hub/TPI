import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission


class IsNodeService(BasePermission):
    message = 'Se requiere una credencial de servicio válida.'

    def has_permission(self, request, view):
        expected_token = settings.INTERNAL_API_TOKEN
        provided_token = request.headers.get('X-Internal-Token', '')
        return bool(expected_token and provided_token) and hmac.compare_digest(
            expected_token.encode('utf-8'),
            provided_token.encode('utf-8'),
        )
