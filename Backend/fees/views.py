from rest_framework import viewsets
from .models import FeeHead, FeeStructure, StudentFee, FeeTransaction
from .serializers import FeeHeadSerializer, FeeStructureSerializer, StudentFeeSerializer, FeeTransactionSerializer

class FeeHeadViewSet(viewsets.ModelViewSet):
    queryset = FeeHead.objects.all()
    serializer_class = FeeHeadSerializer

class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.all()
    serializer_class = FeeStructureSerializer
    filterset_fields = ['student_class']

class StudentFeeViewSet(viewsets.ModelViewSet):
    queryset = StudentFee.objects.all()
    serializer_class = StudentFeeSerializer
    filterset_fields = ['student', 'is_paid']

class FeeTransactionViewSet(viewsets.ModelViewSet):
    queryset = FeeTransaction.objects.all()
    serializer_class = FeeTransactionSerializer
    filterset_fields = ['student']
