import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_erp.settings')
django.setup()

from django.contrib.auth.models import User

# Create admin user if it doesn't exist
username = 'admin'
email = 'admin@school.com'
password = 'admin123'

try:
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username=username, email=email, password=password)
        print(f'✅ Superuser "{username}" created successfully!')
        print(f'   Username: {username}')
        print(f'   Password: {password}')
        print(f'   ⚠️  Please change this password after first login!')
    else:
        print(f'ℹ️  Superuser "{username}" already exists.')
except Exception as e:
    print(f'❌ Error creating superuser: {e}')
    # Don't fail the build if admin already exists
    pass
