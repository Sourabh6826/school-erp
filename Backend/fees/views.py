import csv
import io
from datetime import datetime, timedelta
from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import FeeHead, FeeStructure, StudentFee, FeeTransaction, FeeAmount, GlobalFeeSetting, Receipt, BankStatementEntry
from .serializers import (
    FeeHeadSerializer, FeeStructureSerializer, StudentFeeSerializer, 
    FeeTransactionSerializer, GlobalFeeSettingSerializer, ReceiptSerializer,
    BankStatementEntrySerializer
)
from django.db.models import Max, Sum
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
        payment_mode = data.get('payment_mode', 'CASH')
        payment_date = data.get('payment_date', None)  # Accept custom payment date
        
        # Get next receipt number
        max_no = Receipt.objects.aggregate(Max('receipt_no'))['receipt_no__max'] or 0
        receipt_no = max_no + 1
        
        total_amount = sum(float(item['amount_paid']) for item in payment_items)
        
        # Create receipt with custom date if provided
        receipt_data = {
            'receipt_no': receipt_no,
            'student_id': student_id,
            'total_amount': total_amount,
            'remarks': remarks,
            'payment_mode': payment_mode
        }
        
        if payment_date:
            # If custom date provided, create receipt and update payment_date
            receipt = Receipt.objects.create(**receipt_data)
            receipt.payment_date = payment_date
            receipt.save()
        else:
            receipt = Receipt.objects.create(**receipt_data)
        
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
    
    @action(detail=True, methods=['get'])
    def print_receipt(self, request, pk=None):
        """
        Returns formatted receipt data for printing
        """
        receipt = self.get_object()
        
        # Build detailed receipt data
        receipt_data = {
            'receipt_no': receipt.receipt_no,
            'payment_date': receipt.payment_date.strftime('%d-%b-%Y'),
            'student_name': receipt.student.name,
            'student_id': receipt.student.student_id,
            'student_class': receipt.student.student_class,
            'payment_mode': receipt.get_payment_mode_display(),
            'remarks': receipt.remarks,
            'total_amount': float(receipt.total_amount),
            'items': []
        }
        
        # Add transaction items with proper fee head display
        for transaction in receipt.transactions.all():
            fee_head_name = transaction.fee_head.name if transaction.fee_head else 'General'
            # Show "Transportation Fees" for transport fee heads
            if transaction.fee_head and transaction.fee_head.is_transport_fee:
                fee_head_name = "Transportation Fees"
            
            receipt_data['items'].append({
                'fee_head': fee_head_name,
                'installment_number': transaction.installment_number,
                'amount_paid': float(transaction.amount_paid)
            })
            
        # Sort items: Installment 1, 2, ... (or All/0 first)
        receipt_data['items'].sort(key=lambda x: int(x['installment_number']) if str(x['installment_number']).isdigit() else 0)
        
        return Response(receipt_data)

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

class BankReconciliationViewSet(viewsets.ModelViewSet):
    queryset = BankStatementEntry.objects.all().order_by('-date')
    serializer_class = BankStatementEntrySerializer

    def get_queryset(self):
        queryset = BankStatementEntry.objects.all().order_by('-date')
        is_reconciled = self.request.query_params.get('is_reconciled')
        if is_reconciled is not None:
            is_reconciled = is_reconciled.lower() == 'true'
            queryset = queryset.filter(is_reconciled=is_reconciled)
        return queryset

    @action(detail=False, methods=['post'])
    def upload_statement(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded'}, status=400)
        
        try:
            decoded_file = file_obj.read().decode('utf-8')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
            
            entries_created = 0
            for row in reader:
                try:
                    # Generic mapping: detect common bank statement column names
                    date_val = row.get('Date') or row.get('date') or row.get('Transaction Date')
                    desc = row.get('Description') or row.get('description') or row.get('Narration') or ''
                    amt = row.get('Amount') or row.get('amount') or row.get('Credit') or row.get('Transaction Amount')
                    ref = row.get('Reference') or row.get('Ref No') or row.get('Cheque/Ref No') or ''
                    
                    if not (date_val and amt):
                        continue
                    
                    # Ensure amount is absolute (we usually look for credits in bank reco)
                    # but for now we store raw value
                    try:
                        clean_amt = float(str(amt).replace(',', ''))
                    except:
                        continue
                        
                    # Parse date
                    parsed_date = None
                    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%b-%Y'):
                        try:
                            parsed_date = datetime.strptime(date_val.strip(), fmt).date()
                            break
                        except:
                            continue
                            
                    if not parsed_date:
                        continue
                        
                    BankStatementEntry.objects.create(
                        date=parsed_date,
                        description=desc,
                        amount=clean_amt,
                        ref_number=ref
                    )
                    entries_created += 1
                except Exception as row_e:
                    print(f"Row skip error: {row_e}")
                    continue
            
            return Response({'message': f'Successfully imported {entries_created} entries'})
        except Exception as e:
            return Response({'error': f'Failed to parse file: {str(e)}'}, status=500)

    @action(detail=False, methods=['post'])
    def auto_match(self, request):
        unreconciled = BankStatementEntry.objects.filter(is_reconciled=False)
        matched_count = 0
        
        for entry in unreconciled:
            # Range: +/- 3 days
            start_date = entry.date - timedelta(days=3)
            end_date = entry.date + timedelta(days=3)
            
            # Match by total_amount in FeeTransaction
            # Note: FeeTransaction.amount_paid is Decimal
            # Only match if the linked Receipt is marked as 'ONLINE'
            candidates = FeeTransaction.objects.filter(
                receipt__payment_mode='ONLINE',
                amount_paid=entry.amount,
                payment_date__range=[start_date, end_date],
                bank_matches__isnull=True
            )
            
            if candidates.count() == 1:
                match = candidates.first()
                entry.matched_transaction = match
                entry.is_reconciled = True
                entry.save()
                matched_count += 1
            elif candidates.count() > 1:
                # Try exact date
                exact = candidates.filter(payment_date=entry.date)
                if exact.count() == 1:
                    match = exact.first()
                    entry.matched_transaction = match
                    entry.is_reconciled = True
                    entry.save()
                    matched_count += 1
                    
        return Response({'message': f'Successfully auto-matched {matched_count} entries'})

    @action(detail=True, methods=['post'])
    def reconcile_manual(self, request, pk=None):
        entry = self.get_object()
        transaction_id = request.data.get('transaction_id')
        
        reconciliation_date = request.data.get('reconciliation_date')
        
        if transaction_id:
            try:
                fee_tx = FeeTransaction.objects.get(id=transaction_id)
                entry.matched_transaction = fee_tx
            except FeeTransaction.DoesNotExist:
                return Response({'error': 'Transaction not found'}, status=status.HTTP_404_NOT_FOUND)
        
        entry.is_reconciled = True
        if reconciliation_date:
            entry.reconciliation_date = reconciliation_date
        elif not entry.reconciliation_date:
            entry.reconciliation_date = entry.date # Default to statement date if none provided
            
        entry.save()
        match_msg = "linked to transaction" if transaction_id else "without linkage"
        return Response({'message': f'Manual reconciliation successful ({match_msg})'})
    
    @action(detail=True, methods=['post'])
    def unreconcile(self, request, pk=None):
        """
        Remove reconciliation from a bank statement entry
        """
        entry = self.get_object()
        
        if not entry.is_reconciled:
            return Response({'error': 'Entry is not reconciled'}, status=status.HTTP_400_BAD_REQUEST)
        
        entry.matched_transaction = None
        entry.is_reconciled = False
        entry.save()
        
        return Response({'message': 'Successfully unreconciled entry'})

    @action(detail=False, methods=['get'])
    def pending_erp_transactions(self, request):
        """
        Online transactions not linked to any bank matching
        """
        transactions = FeeTransaction.objects.filter(
            receipt__payment_mode='ONLINE',
            bank_matches__isnull=True
        ).order_by('-payment_date')
        
        serializer = FeeTransactionSerializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def reconcile_erp_transaction(self, request):
        """
        Manually reconcile an ERP transaction by creating a manual bank entry
        """
        transaction_id = request.data.get('transaction_id')
        reconciliation_date = request.data.get('reconciliation_date')
        
        if not reconciliation_date:
            reconciliation_date = datetime.now().date()
        
        try:
            fee_tx = FeeTransaction.objects.get(id=transaction_id)
        except FeeTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found'}, status=status.HTTP_404_NOT_FOUND)
            
        # Create a manual BankStatementEntry for this transaction
        BankStatementEntry.objects.create(
            date=fee_tx.payment_date,
            description=f"Manual reconciliation for {fee_tx.student.name} - Receipt {fee_tx.receipt.receipt_no if fee_tx.receipt else 'N/A'}",
            amount=fee_tx.amount_paid,
            is_reconciled=True,
            reconciliation_date=reconciliation_date,
            matched_transaction=fee_tx
        )
        
        return Response({'message': 'ERP Transaction reconciled successfully'})

