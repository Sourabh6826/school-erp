from django.db import models
from students.models import Student

class FeeHead(models.Model):
    FREQUENCY_CHOICES = [
        ('ONCE', 'One Time'),
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('YEARLY', 'Yearly'),
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
        help_text="Comma-separated months (1-12). E.g., '4,7,10,1' for quarterly"
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

    def __str__(self):
        return self.name
    
    class Meta:
        unique_together = ['name', 'session']
    
class FeeStructure(models.Model):
    student_class = models.CharField(max_length=10, help_text="Class this fee applies to")
    fee_head = models.ForeignKey(FeeHead, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    frequency = models.CharField(max_length=20, default='MONTHLY', choices=[('MONTHLY', 'Monthly'), ('YEARLY', 'Yearly'), ('ONE_TIME', 'One Time')])

    class Meta:
        unique_together = ('student_class', 'fee_head')

    def __str__(self):
        return f"{self.student_class} - {self.fee_head.name} - {self.amount}"

class FeeAmount(models.Model):
    CLASS_CHOICES = [
        ('Nursery', 'Nursery'),
        ('KG1', 'KG1'),
        ('KG2', 'KG2'),
        ('Class 1', 'Class 1'),
        ('Class 2', 'Class 2'),
        ('Class 3', 'Class 3'),
        ('Class 4', 'Class 4'),
        ('Class 5', 'Class 5'),
        ('Class 6', 'Class 6'),
        ('Class 7', 'Class 7'),
        ('Class 8', 'Class 8'),
        ('Class 9', 'Class 9'),
        ('Class 10', 'Class 10'),
        ('Class 11', 'Class 11'),
        ('Class 12', 'Class 12'),
    ]
    
    fee_head = models.ForeignKey(FeeHead, on_delete=models.CASCADE, related_name='amounts')
    class_name = models.CharField(max_length=20, choices=CLASS_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    
    class Meta:
        unique_together = ['fee_head', 'class_name']
        
class StudentFee(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fees')
    fee_head = models.ForeignKey(FeeHead, on_delete=models.CASCADE)
    amount_due = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    is_paid = models.BooleanField(default=False)
    paid_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.student} - {self.fee_head.name} ({self.due_date})"

class FeeTransaction(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='transactions')
    fee_head = models.ForeignKey(FeeHead, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    remarks = models.TextField(blank=True)
    # Could link to specific StudentFee instances if doing partial payments against specific heads, 
    # but keeping simple for now.

    def __str__(self):
        return f"{self.student} - {self.amount_paid} on {self.payment_date}"
