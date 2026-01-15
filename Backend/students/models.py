from django.db import models

class Student(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('ALUMNI', 'Alumni'),
        ('TC_ISSUED', 'TC Issued'),
    ]

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    dob = models.DateField(null=True, blank=True)
    enrollment_date = models.DateField()
    student_class = models.CharField(max_length=10, help_text="e.g. 1, 2, 10, 12-A")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    contact_number = models.CharField(max_length=15, blank=True)
    address = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.student_class})"
