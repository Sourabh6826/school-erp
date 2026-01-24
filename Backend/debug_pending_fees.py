
import os
import django
from django.conf import settings

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'school_erp.settings')
django.setup()

from students.models import Student
from fees.models import FeeHead, GlobalFeeSetting
from rest_framework.test import APIRequestFactory
from students.views import StudentViewSet

def test_pending_fees(student_id, session):
    print(f"Testing for Student ID: {student_id}, Session: {session}")
    
    student = Student.objects.filter(id=student_id).first()
    if not student:
        print("Student not found!")
        return

    print(f"Student: {student.name}, Class: {student.student_class}")

    factory = APIRequestFactory()
    view = StudentViewSet.as_view({'get': 'pending_fees'})
    
    # Construct request
    url = f'/students/pending_fees/?student_id={student_id}&show_all=true&session={session}'
    request = factory.get(url)
    
    response = view(request)
    
    print("Response Status:", response.status_code)
    print("Response Data:", response.data)

    # Check fee heads
    heads = FeeHead.objects.filter(session=session)
    print(f"Fee Heads for session {session}: {[h.name for h in heads]}")
    
    applicable = heads.filter(amounts__class_name=student.student_class)
    print(f"Applicable Heads for {student.student_class}: {[h.name for h in applicable]}")

# Run test
if __name__ == "__main__":
    # From screenshots, baba yaga has ID 2, session is 2026-27
    test_pending_fees(2, '2026-27')
