from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentViewSet, login_view, logout_view, check_auth

router = DefaultRouter()
router.register(r'students', StudentViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', login_view, name='login'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/check/', check_auth, name='check_auth'),
]
