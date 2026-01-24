from rest_framework import viewsets, filters
from rest_framework.response import Response
from rest_framework import status
from .models import FeeHead, FeeStructure, StudentFee, FeeTransaction, FeeAmount, GlobalFeeSetting, Receipt
from .serializers import FeeHeadSerializer, FeeStructureSerializer, StudentFeeSerializer, FeeTransactionSerializer, GlobalFeeSettingSerializer, ReceiptSerializer
from django.db.models import Max
from django.db import transaction

class FeeHeadViewSet(viewsets.ModelViewSet):
    queryset = FeeHead.objects.all()
    serializer_class = FeeHeadSerializer
    
    def get_queryset(self):
        queryset = FeeHead.objects.all()
        session = self.request.query_params.get('session')
        if session:
            queryset = queryset.filter(session=session)
        return queryset
    
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
    queryset = FeeTransaction.objects.all().order_by('-payment_date', '-id')
    serializer_class = FeeTransactionSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['student__name', 'student__student_id']
    filterset_fields = ['student']

class ReceiptViewSet(viewsets.ModelViewSet):
    queryset = Receipt.objects.all().order_by('-receipt_no')
    serializer_class = ReceiptSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['student__name', 'student__student_id', 'receipt_no']
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        student_id = data.get('student')
        payment_items = data.get('items', [])
        remarks = data.get('remarks', '')
        
        # Get next receipt number
        max_no = Receipt.objects.aggregate(Max('receipt_no'))['receipt_no__max'] or 0
        receipt_no = max_no + 1
        
        total_amount = sum(float(item['amount_paid']) for item in payment_items)
        
        receipt = Receipt.objects.create(
            receipt_no=receipt_no,
            student_id=student_id,
            total_amount=total_amount,
            remarks=remarks
        )
        
        for item in payment_items:
            FeeTransaction.objects.create(
                student_id=student_id,
                fee_head_id=item['fee_head'],
                receipt=receipt,
                amount_paid=item['amount_paid'],
                installment_number=item['installment_number'],
                remarks=remarks
            )
            
        return Response(ReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        payment_items = request.data.get('items', [])
        remarks = request.data.get('remarks', instance.remarks)
        
        instance.remarks = remarks
        
        # Update specific transactions
        for item in payment_items:
            try:
                # We expect item to have an id if it's an existing transaction
                # OR we might be identifying by fee_head and installment if simplified
                # Ideally, the frontend sends the transaction ID.
                # Let's assume the frontend sends the relevant fee_transaction id in the item data
                trans_id = item.get('transaction_id')
                if trans_id:
                     trans = FeeTransaction.objects.get(id=trans_id, receipt=instance)
                     trans.amount_paid = float(item['amount_paid'])
                     trans.remarks = remarks
                     trans.save()
            except FeeTransaction.DoesNotExist:
                continue
                
        # Recalculate total for receipt
        total = instance.transactions.aggregate(Sum('amount_paid'))['amount_paid__sum'] or 0
        instance.total_amount = total
        instance.save()
        
        return Response(ReceiptSerializer(instance).data)

class GlobalFeeSettingViewSet(viewsets.ModelViewSet):
    queryset = GlobalFeeSetting.objects.all()
    serializer_class = GlobalFeeSettingSerializer
    lookup_field = 'session'

    def create(self, request, *args, **kwargs):
        session = request.data.get('session')
        instance = GlobalFeeSetting.objects.filter(session=session).first()
        
        if instance:
            # Switch to update mode for existing session
            serializer = self.get_serializer(instance, data=request.data, partial=True)
        else:
            # Standard create mode
            serializer = self.get_serializer(data=request.data)
            
        serializer.is_valid(raise_exception=True)
        serializer.save() # Use .save() instead of perform_create for updates
        
        return Response(serializer.data, status=status.HTTP_200_OK if instance else status.HTTP_201_CREATED)
