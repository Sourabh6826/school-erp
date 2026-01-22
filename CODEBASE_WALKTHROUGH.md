# School ERP - Codebase Walkthrough for Beginners

Welcome to the School ERP project! This guide explains how the system works, broken down effectively for a beginner.

## 1. The Big Picture
This web application is built using two main parts that talk to each other:
*   **Backend (The Brain)**: Built with **Python** & **Django**. It stores data (Database), handles security, and processes logic.
*   **Frontend (The Face)**: Built with **JavaScript** & **React**. It's what you see in the browser. It sends requests to the Backend to get or save data.

---

## 2. The Backend (Folder: `/Backend`)
This is a standard Django project. Think of it as a collection of "Apps" plug-ins, each doing one job.

### Key Files in `Backend/`:
*   **`manage.py`**: The command center. We use this to run the server (`python manage.py runserver`) or update the database (`makemigrations`).
*   **`school_erp/`**: The main configuration folder.
    *   **`settings.py`**: Controls everything—database settings, installed apps, security keys.
    *   **`urls.py`**: The "Receptionist". It looks at the incoming URL (e.g., `/api/students/`) and points it to the correct App.

### App 1: `students/` (Manages Student Data)
*   **`models.py` (The Blueprint)**:
    *   Defines what a "Student" is. We defined fields like `name`, `student_id`, `student_class`, and `has_transport`.
    *   *Analogy*: This creates the columns in an Excel sheet.
*   **`serializers.py` (The Translator)**:
    *   Converts complex Python Objects (from the database) into simple JSON text that the Frontend can understand, and vice versa.
*   **`views.py` (The Logic)**:
    *   Handles requests. When the Frontend asks for "All Students", the View asks the Model for data, gives it to the Serializer, and sends the response.
    *   We use `ModelViewSet`, which automatically handles Create, Read, Update, Delete (CRUD) logic for us!

### App 2: `fees/` (Manages Money)
*   **`models.py`**:
    *   **`FeeHead`**: A category of fee (e.g., "Tuition Fee"). We added logic for Frequency (Monthly/Quarterly), Due Days, and Late Fees here.
    *   **`FeeAmount`**: Links a Fee Head to a specific Class with an Amount (e.g., Class 10 pays 5000). 
    *   **`FeeTransaction`**: A record of a payment made by a student.
*   **`views.py`**:
    *   Has custom logic to handle saving multiple `FeeAmount`s when you create a `FeeHead`.

---

## 3. The Frontend (Folder: `/Frontend`)
This is a React application built with **Vite** (a tool that makes it run fast).

### Key Files in `Frontend/`:
*   **`package.json`**: The ID card of the project. Lists all libraries we installed (like `react`, `axios`, `tailwindcss`).
*   **`src/main.jsx`**: The entry point. It finds the `div` with `id="root"` in your HTML and puts the React app inside it.
*   **`src/api.js`**:
    *   A helper file we created. instead of typing `http://127.0.0.1:8000/api/` everywhere, we use this configuration to talk to the Backend.

### The Logic (`src/pages/`)
*   **`App.jsx`**: The Router. It acts like a traffic cop for the browser.
    *   If you visit `/students`, it shows the `<Students />` component.
    *   It also contains the **Sidebar** navigation.
    
*   **`Students.jsx` (Student Management Page)**:
    *   **State (`useState`)**: Variables that change over time (e.g., `students` list, `newStudent` form data). When these change, React updates the screen instantly.
    *   **`useEffect`**: logic that runs when the page loads. We use it to `fetchStudents()` immediately.
    *   **Logic**: Contains the form to add students and the table to list them.

*   **`Fees.jsx` (Fee Management Page)**:
    *   This is the most complex page.
    *   **Logic**: It fetches `FeeHeads` and `Students`.
    *   **Record Payment**: We implemented custom logic here. When you select a Student and a Fee Head, it automatically hunts through the data to find the correct Amount for that student's class and fills the box.

## Summary of Data Flow
1.  **User** clicks "Save" on the React Frontend.
2.  **React** gathers the data (State) and sends a POST request via `api.js`.
3.  **Django (`urls.py`)** receives the request and sends it to `fees/views.py`.
4.  **Serializer** checks if the data is valid.
5.  **Model** saves the data into the **PostgreSQL/SQLite Database**.
6.  **Django** sends back a "Success" message.
7.  **React** sees the success and refreshes the list!
