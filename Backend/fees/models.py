from django.db import models
from students.models import Student

class FeeHead(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="e.g. Tuition Fee, Transport Fee")
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class FeeStructure(models.Model):
    student_class = models.CharField(max_length=10, help_text="Class this fee applies to")
    fee_head = models.ForeignKey(FeeHead, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    frequency = models.CharField(max_length=20, default='MONTHLY', choices=[('MONTHLY', 'Monthly'), ('YEARLY', 'Yearly'), ('ONE_TIME', 'One Time')])

    class Meta:
        unique_together = ('student_class', 'fee_head')

    def __str__(self):
        return f"{self.student_class} - {self.fee_head.name} - {self.amount}"

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
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    remarks = models.TextField(blank=True)
    # Could link to specific StudentFee instances if doing partial payments against specific heads, 
    # but keeping simple for now.

    def __str__(self):
        return f"{self.student} - {self.amount_paid} on {self.payment_date}"
