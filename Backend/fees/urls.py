from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FeeHeadViewSet, FeeStructureViewSet, StudentFeeViewSet, FeeTransactionViewSet

router = DefaultRouter()
router.register(r'heads', FeeHeadViewSet)
router.register(r'structures', FeeStructureViewSet)
router.register(r'student-fees', StudentFeeViewSet)
router.register(r'transactions', FeeTransactionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
