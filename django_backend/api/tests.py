import os
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import call_command, CommandError
from django.test import override_settings
from rest_framework.test import APITestCase


class RelevamientoApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='encuestador',
            password='clave-de-prueba',
        )

    def test_health_endpoint(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['backend'], 'django')

    def test_root_endpoint_reports_service_health(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['backend'], 'django')

    def test_ensure_admin_creates_the_configured_superuser_idempotently(self):
        variables = {
            'DJANGO_ADMIN_USERNAME': 'render-admin',
            'DJANGO_ADMIN_PASSWORD': 'temporary-test-password',
        }
        with patch.dict(os.environ, variables):
            call_command('ensure_admin')
            call_command('ensure_admin')

        user = User.objects.get(username='render-admin')
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.check_password('temporary-test-password'))
        self.assertEqual(User.objects.filter(username='render-admin').count(), 1)

    def test_ensure_admin_rejects_partial_configuration(self):
        variables = {
            'DJANGO_ADMIN_USERNAME': 'render-admin',
            'DJANGO_ADMIN_PASSWORD': '',
        }
        with patch.dict(os.environ, variables):
            with self.assertRaises(CommandError):
                call_command('ensure_admin')

    def test_relevamientos_require_authentication(self):
        response = self.client.get('/api/relevamientos/')
        self.assertEqual(response.status_code, 403)

    def test_create_relevamiento_calculates_evacuacion(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            '/api/relevamientos/',
            {
                'barrio': 'Centro',
                'nivel_rio_parana': 7.2,
                'latitud': -29.14,
                'longitud': -59.26,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()['estado_evacuacion'])

    @override_settings(INTERNAL_API_TOKEN='test-internal-token')
    def test_internal_summary_requires_service_token(self):
        response = self.client.post(
            '/api/internal/reportes/resumen/',
            {'barrios': [], 'ultimo': None},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    @override_settings(INTERNAL_API_TOKEN='test-internal-token')
    def test_internal_summary_rejects_wrong_service_token(self):
        response = self.client.post(
            '/api/internal/reportes/resumen/',
            {'barrios': [], 'ultimo': None},
            format='json',
            HTTP_X_INTERNAL_TOKEN='wrong-token',
        )
        self.assertEqual(response.status_code, 403)

    @override_settings(INTERNAL_API_TOKEN='test-internal-token')
    def test_internal_summary_aggregates_node_metrics(self):
        response = self.client.post(
            '/api/internal/reportes/resumen/',
            {
                'barrios': [
                    {'barrio': 'Centro', 'total': 4, 'criticos': 2, 'personasAfectadas': 7},
                    {'barrio': 'Puerto', 'total': 1, 'criticos': 1, 'personasAfectadas': 3},
                ],
                'ultimo': {'barrio': 'Puerto', 'fechaRegistro': '2026-11-19T12:00:00Z'},
            },
            format='json',
            HTTP_X_INTERNAL_TOKEN='test-internal-token',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['total'], 5)
        self.assertEqual(response.json()['criticos'], 3)
        self.assertEqual(response.json()['personasAfectadas'], 10)
        self.assertEqual(response.json()['porcentajeCriticos'], 60)
        self.assertEqual(response.json()['barriosPrioritarios'][0]['barrio'], 'Centro')
        self.assertEqual(response.json()['procesadoPor'], 'django')

    @override_settings(INTERNAL_API_TOKEN='test-internal-token')
    def test_internal_summary_rejects_invalid_borough_metrics(self):
        response = self.client.post(
            '/api/internal/reportes/resumen/',
            {
                'barrios': [
                    {'barrio': 'Centro', 'total': 1, 'criticos': 2, 'personasAfectadas': 0},
                ],
                'ultimo': None,
            },
            format='json',
            HTTP_X_INTERNAL_TOKEN='test-internal-token',
        )

        self.assertEqual(response.status_code, 400)
