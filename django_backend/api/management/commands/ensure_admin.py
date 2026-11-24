import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Create the configured Django superuser if it does not exist.'

    def handle(self, *args, **options):
        username = os.environ.get('DJANGO_ADMIN_USERNAME', '').strip()
        password = os.environ.get('DJANGO_ADMIN_PASSWORD', '')

        if not username and not password:
            self.stderr.write(self.style.WARNING(
                'Django admin bootstrap skipped; set DJANGO_ADMIN_USERNAME and DJANGO_ADMIN_PASSWORD.'
            ))
            return
        if not username or not password:
            raise CommandError(
                'DJANGO_ADMIN_USERNAME and DJANGO_ADMIN_PASSWORD must both be configured.'
            )

        user_model = get_user_model()
        try:
            user = user_model._default_manager.get_by_natural_key(username)
        except user_model.DoesNotExist:
            user_model._default_manager.create_superuser(
                username=username,
                email='',
                password=password
            )
            self.stdout.write(self.style.SUCCESS('Django superuser created.'))
            return

        if not user.is_superuser:
            raise CommandError(
                f'The configured Django admin username "{username}" already belongs to a non-superuser.'
            )

        self.stdout.write('Configured Django superuser already exists.')
