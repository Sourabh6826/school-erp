@echo off
echo Starting Backend Server...
cd Backend
call venv\Scripts\activate
python manage.py runserver
cmd /k
