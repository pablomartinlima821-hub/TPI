from django.contrib.auth.models import User
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
