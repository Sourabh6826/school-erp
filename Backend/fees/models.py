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
        default='MONTHLY',
        help_text="How often this fee is collected"
    )
    
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
    month = models.IntegerField(default=1, help_text="Month number (1-12)")
    is_paid = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['student', 'fee_head', 'month']

class FeeTransaction(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    fee_head = models.ForeignKey(FeeHead, on_delete=models.SET_NULL, null=True)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    remarks = models.TextField(blank=True)
    
    def __str__(self):
        return f"{self.student.name} - {self.fee_head.name if self.fee_head else 'General'} - {self.amount_paid}"
