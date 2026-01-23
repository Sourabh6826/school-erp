from students.models import Student
try:
    students = Student.objects.all()
    print(f"TOTAL_COUNT: {students.count()}")
    for s in students:
        print(f"ID:{s.id} | SID:{s.student_id} | NAME:{s.name}")
except Exception as e:
    print(f"ERROR: {e}")
