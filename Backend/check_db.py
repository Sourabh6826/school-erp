import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_erp.settings')
django.setup()

from django.db import connection

# Get cursor and execute showing tables
with connection.cursor() as cursor:
    print(f"Connected to: {connection.settings_dict['NAME']} on {connection.settings_dict['HOST']}:{connection.settings_dict['PORT']}")
    print("-" * 30)
    print("Tables in Database:")
    
    # Introspection is easier
    table_list = connection.introspection.table_names()
    for table in table_list:
        print(f" - {table}")
        
    if not table_list:
        print("No tables found! Did you run 'python manage.py migrate'?")
