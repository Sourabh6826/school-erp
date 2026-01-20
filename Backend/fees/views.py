from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status
from .models import FeeHead, FeeStructure, StudentFee, FeeTransaction, FeeAmount
from .serializers import FeeHeadSerializer, FeeStructureSerializer, StudentFeeSerializer, FeeTransactionSerializer

class FeeHeadViewSet(viewsets.ModelViewSet):
    queryset = FeeHead.objects.all()
    serializer_class = FeeHeadSerializer
    
    def create(self, request, *args, **kwargs):
        # Extract amounts from request data
        amounts_data = request.data.pop('amounts', [])
        
        # Create the fee head
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fee_head = serializer.save()
        
        # Create fee amounts
        for amount_data in amounts_data:
            if amount_data.get('amount'):  # Only create if amount is provided
                FeeAmount.objects.create(
                    fee_head=fee_head,
                    class_name=amount_data['class_name'],
                    amount=amount_data['amount']
                )
        
        # Return the created fee head with amounts
        headers = self.get_success_headers(serializer.data)
        return Response(
            self.get_serializer(fee_head).data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Extract amounts from request data
        amounts_data = request.data.pop('amounts', [])
        
        # Update the fee head
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        fee_head = serializer.save()
        
        # Delete existing amounts and create new ones
        FeeAmount.objects.filter(fee_head=fee_head).delete()
        for amount_data in amounts_data:
            if amount_data.get('amount'):  # Only create if amount is provided
                FeeAmount.objects.create(
                    fee_head=fee_head,
                    class_name=amount_data['class_name'],
                    amount=amount_data['amount']
                )
        
        return Response(self.get_serializer(fee_head).data)

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
