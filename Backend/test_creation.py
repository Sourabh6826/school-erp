from students.models import Student
from students.serializers import StudentSerializer
from rest_framework import serializers

data = {
    "name": "John Wicks",
    "student_id": "1", # This exists as John Wick (ID 3)
    "student_class": "Class 4",
    "status": "Active"
}

serializer = StudentSerializer(data=data)
try:
    serializer.is_valid(raise_exception=True)
    serializer.save()
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}")
