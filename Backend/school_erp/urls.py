from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect

def home(request):
    return redirect('/admin/')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('students.urls')),
    path('api/fees/', include('fees.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('', home), # Redirect root to admin
]
