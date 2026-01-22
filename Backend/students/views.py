from rest_framework import viewsets, filters, status
from rest_framework.parsers import MultiPartParser
import openpyxl
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Q
from .models import Student
from .serializers import StudentSerializer
from fees.models import FeeHead, FeeTransaction, FeeAmount
from datetime import datetime

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'student_id']
    filterset_fields = ['student_class']

    @action(detail=False, methods=['get'])
    def stats(self, request):
        session = request.query_params.get('session')
        student_class = request.query_params.get('student_class')
        date_at = request.query_params.get('date', datetime.now().strftime('%Y-%m-%d'))

        students = Student.objects.all()
        if student_class:
            students = students.filter(student_class=student_class)
        
        total_students = students.count()
        active_count = students.filter(status='Active').count()
        tc_count = students.filter(status='TC').count()

        # Fee collection logic
        transactions = FeeTransaction.objects.all()
        if session:
            transactions = transactions.filter(fee_head__session=session)
        if student_class:
            transactions = transactions.filter(student__student_class=student_class)
        if date_at:
            transactions = transactions.filter(payment_date__lte=date_at)

        total_collected = transactions.aggregate(Sum('amount_paid'))['amount_paid__sum'] or 0

        # Pending logic
        heads = FeeHead.objects.all()
        if session:
            heads = heads.filter(session=session)
        
        total_expected = 0
        for student in students:
            # For each student, find applicable fee heads
            applicable_heads = heads.filter(amounts__class_name=student.student_class)
            for head in applicable_heads:
                # Filter out transport heads if student doesn't have transport
                if head.is_transport_fee and not student.has_transport:
                    continue
                # If student has transport, only count their specific transport head
                if head.is_transport_fee and student.transport_fee_head_id != head.id:
                    continue

                try:
                    amt = FeeAmount.objects.get(fee_head=head, class_name=student.student_class).amount
                    total_expected += amt
                except FeeAmount.DoesNotExist:
                    continue
        
        total_pending = total_expected - total_collected

        return Response({
            'total_students': total_students,
            'active_students': active_count,
            'tc_students': tc_count,
            'total_collected': total_collected,
            'total_pending': total_pending,
        })

    @action(detail=False, methods=['get'])
    def pending_fees(self, request):
        session = request.query_params.get('session')
        student_class = request.query_params.get('student_class')
        show_all = request.query_params.get('show_all') == 'true'

        students = Student.objects.all()
        if student_class:
            students = students.filter(student_class=student_class)
        
        heads = FeeHead.objects.all()
        if session:
            heads = heads.filter(session=session)

        fee_detail_list = []
        for student in students:
            # Calc total expected for this student
            applicable_heads = heads.filter(amounts__class_name=student.student_class)
            total_expected = 0
            head_breakdown = {}
            
            for head in applicable_heads:
                # Filter out transport heads if student doesn't have transport
                if head.is_transport_fee and not student.has_transport:
                    continue
                # If student has transport, only count their specific transport head
                if head.is_transport_fee and student.transport_fee_head_id != head.id:
                    continue

                try:
                    amt = FeeAmount.objects.get(fee_head=head, class_name=student.student_class).amount
                    total_expected += amt
                    
                    paid_for_head = FeeTransaction.objects.filter(student=student, fee_head=head).aggregate(Sum('amount_paid'))['amount_paid__sum'] or 0
                    head_breakdown[head.name] = {
                        'due': float(amt),
                        'paid': float(paid_for_head),
                        'pending': float(amt - paid_for_head)
                    }
                except FeeAmount.DoesNotExist:
                    continue
            
            # Calc total paid
            total_paid = FeeTransaction.objects.filter(student=student, fee_head__in=applicable_heads).aggregate(Sum('amount_paid'))['amount_paid__sum'] or 0
            
            balance = total_expected - total_paid
            if show_all or balance > 0:
                fee_detail_list.append({
                    'id': student.id,
                    'student_id': student.student_id,
                    'name': student.name,
                    'student_class': student.student_class,
                    'total_due': total_expected,
                    'total_paid': total_paid,
                    'pending_amount': balance,
                    'head_breakdown': head_breakdown
                })
        
        # Sort highest to lowest
        fee_detail_list.sort(key=lambda x: x['pending_amount'], reverse=True)

        return Response(fee_detail_list)

    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        student = self.get_object()
        session = request.query_params.get('session')

        heads = FeeHead.objects.all()
        if session:
            heads = heads.filter(session=session)
        
        applicable_heads = heads.filter(amounts__class_name=student.student_class)
        
        entries = []
        # Debits: Fee assignments
        for head in applicable_heads:
            amt = FeeAmount.objects.get(fee_head=head, class_name=student.student_class).amount
            # When was this fee assigned? Usually start of session or month. 
            # For simplicity using a placeholder date or head session info
            entries.append({
                'date': datetime.now().strftime('%Y-%m-%d'), # In a real app, this would be the due date or assignment date
                'description': f"Fee Assigned: {head.name}",
                'debit': float(amt),
                'credit': 0,
            })
        
        # Credits: Payments
        transactions = FeeTransaction.objects.filter(student=student, fee_head__in=applicable_heads).order_by('payment_date')
        for t in transactions:
            entries.append({
                'date': t.payment_date.strftime('%Y-%m-%d'),
                'description': f"Payment: {t.fee_head.name if t.fee_head else 'General'}",
                'debit': 0,
                'credit': float(t.amount_paid),
            })
        
        # Sort by date
        entries.sort(key=lambda x: x['date'])
        
        # Calculate running sum
        running_sum = 0
        for entry in entries:
            running_sum += (entry['debit'] - entry['credit'])
            entry['balance'] = running_sum

        return Response(entries)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def bulk_import(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            wb = openpyxl.load_workbook(file_obj)
            sheet = wb.active
            
            # Use list(sheet.iter_rows(min_row=2)) to skip header
            created_count = 0
            updated_count = 0
            errors = []
            
            for row in sheet.iter_rows(min_row=2):
                if not row[0].value: continue
                
                try:
                    s_id = str(row[0].value).strip()
                    name = str(row[1].value).strip()
                    s_class = str(row[2].value).strip()
                    contact = str(row[3].value).strip() if row[3].value else ""
                    has_trans_str = str(row[4].value).strip().lower() if row[4].value else ""
                    trans_head_name = str(row[5].value).strip() if row[5].value else None
                    
                    has_transport = has_trans_str in ['yes', 'true', '1', 'y']
                    
                    trans_head = None
                    if trans_head_name:
                        trans_head = FeeHead.objects.filter(name__iexact=trans_head_name, is_transport_fee=True).first()
                    
                    student, created = Student.objects.update_or_create(
                        student_id=s_id,
                        defaults={
                            'name': name,
                            'student_class': s_class,
                            'contact_number': contact,
                            'has_transport': has_transport,
                            'transport_fee_head': trans_head
                        }
                    )
                    
                    if created: created_count += 1
                    else: updated_count += 1
                except Exception as row_error:
                    errors.append(f"Row {row[0].row}: {str(row_error)}")
                
            return Response({
                'message': f'Import completed. Created: {created_count}, Updated: {updated_count}',
                'created': created_count,
                'updated': updated_count,
                'errors': errors
            })
        except Exception as e:
            return Response({'error': f"Failed to parse Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Check if status is being changed to TC
        new_status = request.data.get('status')
        if new_status == 'TC' and instance.status != 'TC':
            # Check for dues
            heads = FeeHead.objects.all()
            applicable_heads = heads.filter(amounts__class_name=instance.student_class)
            total_expected = 0
            for head in applicable_heads:
                if head.is_transport_fee and not instance.has_transport: continue
                if head.is_transport_fee and instance.transport_fee_head_id != head.id: continue
                
                try:
                    amt = FeeAmount.objects.get(fee_head=head, class_name=instance.student_class).amount
                    total_expected += amt
                except FeeAmount.DoesNotExist:
                    continue
            
            total_paid = FeeTransaction.objects.filter(student=instance).aggregate(Sum('amount_paid'))['amount_paid__sum'] or 0
            balance = total_expected - total_paid
            
            if balance > 0:
                return Response({'error': f'Cannot mark as TC. Student has pending dues: {balance}'}, status=status.HTTP_400_BAD_REQUEST)

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

