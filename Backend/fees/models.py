from django.db import models
from students.models import Student

class FeeHead(models.Model):
    FREQUENCY_CHOICES = [
        ('ONCE', 'One Time'),
        ('INSTALLMENTS', 'Installments'),
    ]
    
    name = models.CharField(max_length=100, help_text="e.g. Tuition Fee, Transport Fee")
    description = models.TextField(blank=True)
    session = models.CharField(max_length=10)
    
    # Payment frequency settings
    frequency = models.CharField(
        max_length=20, 
        choices=FREQUENCY_CHOICES, 
        default='INSTALLMENTS',
        help_text="How often this fee is collected"
    )
    
    installment_count = models.IntegerField(default=1, help_text="Number of installments")
    
    # Due date settings
    due_day = models.IntegerField(
        default=10,
        help_text="Day of month for due date (1-31). For quarterly/yearly, first installment day."
    )
    
    # For quarterly/yearly - which months to collect
    due_months = models.CharField(
        max_length=50,
        blank=True,
        help_text="Comma-separated months (1-12) for installments. E.g., '4,7,10,1' for 4 installments"
    )
    
    # Late fee settings
    late_fee_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Late fee charged after due date"
    )
    
    grace_period_days = models.IntegerField(
        default=0,
        help_text="Days after due date before late fee applies"
    )
    is_transport_fee = models.BooleanField(default=False)

    def __str__(self):
        return self.name
    
    class Meta:
        unique_together = ['name', 'session']
    
class FeeStructure(models.Model):
    student_class = models.CharField(max_length=10, help_text="Class this fee applies to")
    fee_head = models.ForeignKey(FeeHead, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    frequency = models.CharField(max_length=20, default='INSTALLMENTS', choices=[('INSTALLMENTS', 'Installments'), ('ONE_TIME', 'One Time')])

    class Meta:
        unique_together = ['student_class', 'fee_head']

class FeeAmount(models.Model):
    fee_head = models.ForeignKey(FeeHead, related_name='amounts', on_delete=models.CASCADE)
    class_name = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ['fee_head', 'class_name']

class StudentFee(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    fee_head = models.ForeignKey(FeeHead, on_delete=models.CASCADE)
    amount_due = models.DecimalField(max_digits=10, decimal_places=2)
    installment_number = models.IntegerField(default=1, help_text="Installment number (1, 2, 3...)")
    is_paid = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['student', 'fee_head', 'installment_number']

class GlobalFeeSetting(models.Model):
    session = models.CharField(max_length=10, unique=True)
    installment_count = models.IntegerField(default=1)
    due_months = models.CharField(max_length=100, help_text="Comma-separated months (1-12)")
    due_day = models.IntegerField(default=10)
    
    # Late Fee Settings
    late_fee_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    late_fee_start_day = models.IntegerField(default=15, help_text="Day of month after which late fee is applied")
    late_fee_frequency = models.CharField(
        max_length=20, 
        default='ONCE', 
        choices=[('ONCE', 'Once'), ('PER_DAY', 'Per Day')],
        help_text="Apply once or daily after due date"
    )

    def __str__(self):
        return f"Settings for {self.session}"

class Receipt(models.Model):
    receipt_no = models.PositiveIntegerField(unique=True)
    payment_date = models.DateField(auto_now_add=True)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    remarks = models.TextField(blank=True)
    payment_mode = models.CharField(max_length=10, choices=[('CASH', 'Cash'), ('ONLINE', 'Online')], default='CASH')
    
    def __str__(self):
        return f"Receipt #{self.receipt_no} - {self.student.name}"

class FeeTransaction(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    fee_head = models.ForeignKey(FeeHead, on_delete=models.SET_NULL, null=True)
    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE, related_name='transactions', null=True, blank=True)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    installment_number = models.IntegerField(default=1)
    payment_date = models.DateField(auto_now_add=True)
    remarks = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.student.name} - {self.fee_head.name if self.fee_head else 'General'} - {self.amount_paid}"

class StudentFeeEnrollment(models.Model):
    """
    Tracks per-installment enrollment for any fee head.
    Uses OPT-OUT approach: If no record exists, student IS enrolled (default).
    Only create records when student opts OUT of a fee for specific installment.
    """
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fee_enrollments')
    fee_head = models.ForeignKey(FeeHead, on_delete=models.CASCADE, related_name='enrollments')
    session = models.CharField(max_length=10, help_text="Academic session (e.g., 2026-27)")
    installment_number = models.IntegerField(help_text="Installment number (1, 2, 3, ...)")
    is_enrolled = models.BooleanField(
        default=True,
        help_text="True = enrolled, False = opted out"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['student', 'fee_head', 'session', 'installment_number']
        indexes = [
            models.Index(fields=['student', 'session']),
            models.Index(fields=['fee_head', 'session']),
        ]
    
    def __str__(self):
        status = "Enrolled" if self.is_enrolled else "Opted Out"
        return f"{self.student.name} - {self.fee_head.name} - Inst {self.installment_number} - {status}"
class BankStatementEntry(models.Model):
    date = models.DateField()
    description = models.TextField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    ref_number = models.CharField(max_length=100, blank=True, null=True)
    is_reconciled = models.BooleanField(default=False)
    matched_transaction = models.ForeignKey(FeeTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='bank_matches')
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.date} - {self.amount} - {self.description[:30]}"
