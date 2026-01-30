from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FeeHeadViewSet, FeeStructureViewSet, StudentFeeViewSet, 
    FeeTransactionViewSet, GlobalFeeSettingViewSet, ReceiptViewSet,
    BankReconciliationViewSet
)

router = DefaultRouter()
router.register(r'heads', FeeHeadViewSet)
router.register(r'structures', FeeStructureViewSet)
router.register(r'student-fees', StudentFeeViewSet)
router.register(r'transactions', FeeTransactionViewSet)
router.register(r'receipts', ReceiptViewSet)
router.register(r'settings', GlobalFeeSettingViewSet)
router.register(r'reconciliation', BankReconciliationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
