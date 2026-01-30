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
    user = User.objects.filter(username=username).first()
    if not user:
        User.objects.create_superuser(username=username, email=email, password=password)
        print(f'✅ Superuser "{username}" created successfully!')
    else:
        # Update password for existing user to ensure it matches admin123
        user.set_password(password)
        user.email = email # ensure email is correct too
        user.save()
        print(f'ℹ️  Superuser "{username}" password reset to "{password}".')
    
    print(f'   Username: {username}')
    print(f'   Password: {password}')
    print(f'   ⚠️  Please change this password after first login!')
except Exception as e:
    print(f'❌ Error creating/updating superuser: {e}')
    # Don't fail the build if admin update fails
    pass
