
import os
import django
import sys

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_erp.settings')
django.setup()

from students.models import Student
from fees.models import FeeHead, FeeAmount

def debug_fees():
    print("--- DEBUGGING FEES ---")
    
    # 1. Check Students
    students = Student.objects.all()
    print(f"Total Students: {students.count()}")
    for s in students:
        print(f"ID: {s.id}, Name: {s.name}, Class: {s.student_class}")

    # 2. Check Fee Heads
    heads = FeeHead.objects.all()
    print(f"\nTotal Fee Heads: {heads.count()}")
    for h in heads:
        print(f"Head: {h.name}, Session: {h.session}")
        amounts = FeeAmount.objects.filter(fee_head=h)
        for a in amounts:
            print(f"  - Class: {a.class_name}, Amount: {a.amount}")

if __name__ == "__main__":
    debug_fees()
