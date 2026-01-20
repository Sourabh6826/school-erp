from django.db import models

class Student(models.Model):
    name = models.CharField(max_length=200)
    student_id = models.CharField(max_length=20, unique=True, help_text="Unique Registration/Roll Number")
    student_class = models.CharField(max_length=20, choices=[
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
    ])
    has_transport = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.student_class})"
