import { useState, useEffect, useRef } from 'react';
import api from '../api';
import EnrollmentModal from '../components/EnrollmentModal';
import LoadingSpinner from '../components/LoadingSpinner';

function Students() {
    const [students, setStudents] = useState([]);
    const [feeHeads, setFeeHeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [currentSession, setCurrentSession] = useState('2026-27');
    const [newStudent, setNewStudent] = useState({
        name: '',
        student_id: '',
        student_class: '',
        has_transport: false,
        is_new_admission: false,
        transport_fee_head: '',
        contact_number: '',
        status: 'Active'
    });
    const [showOnlyActive, setShowOnlyActive] = useState(true);
    const fileInputRef = useRef(null);

    const classOptions = ['Nursery', 'KG1', 'KG2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

    useEffect(() => {
        const loadInitial = async () => {
            setLoading(true);
            try {
                await Promise.all([fetchStudents(), fetchFeeHeads()]);
            } catch (err) {
                console.error("Initial load error:", err);
            } finally {
                setLoading(false);
            }
        };
        loadInitial();
    }, []);

    const fetchStudents = async () => {
        try {
            const response = await api.get('students/');
            setStudents(response.data);
        } catch (error) {
            console.error("Error fetching students:", error);
        }
    };

    const fetchFeeHeads = async () => {
        try {
            const response = await api.get('fees/heads/');
            setFeeHeads(response.data);
        } catch (error) {
            console.error("Error fetching fee heads:", error);
        }
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...newStudent,
                transport_fee_head: newStudent.transport_fee_head === '' ? null : newStudent.transport_fee_head
            };

            if (editingStudent) {
                await api.put(`students/${editingStudent}/`, payload);
            } else {
                await api.post('students/', payload);
            }
            setShowModal(false);
            setEditingStudent(null);
            resetForm();
            fetchStudents();
        } catch (error) {
            console.error("Error saving student:", error);
            alert("Failed to save student. Ensure ID is unique.");
        }
    };

    const handleEdit = (student) => {
        setEditingStudent(student.id);
        setNewStudent({
            name: student.name,
            student_id: student.student_id,
            student_class: student.student_class,
            has_transport: student.has_transport,
            is_new_admission: student.is_new_admission,
            transport_fee_head: student.transport_fee_head || '',
            contact_number: student.contact_number || '',
            status: student.status || 'Active'
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setNewStudent({
            name: '',
            student_id: '',
            student_class: '',
            has_transport: false,
            is_new_admission: false,
            transport_fee_head: '',
            contact_number: '',
            status: 'Active'
        });
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('students/bulk_import/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert(response.data.message);
            fetchStudents();
        } catch (error) {
            console.error("Import error:", error);
            alert("Failed to import students. Check console for details.");
        }
        event.target.value = ''; // Reset input
    };

    const transportHeads = feeHeads.filter(h => h.is_transport_fee);

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-semibold">Student Roster</h2>
                <div className="flex gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <label className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition shadow-sm">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-100"
                            checked={showOnlyActive}
                            onChange={(e) => setShowOnlyActive(e.target.checked)}
                        />
                        <span className="text-xs font-black text-gray-500 uppercase tracking-tighter">Show only Active</span>
                    </label>
                    <button
                        onClick={() => fileInputRef.current.click()}
                        className="bg-white text-gray-700 px-6 py-2 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 shadow-sm transition flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Import Excel
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition"
                    >
                        Add Student
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative min-h-[400px]">
                {loading && <LoadingSpinner message="Gathering student records..." />}
                <table className={`min-w-full divide-y divide-gray-100 transition-opacity duration-300 ${loading ? 'opacity-20' : 'opacity-100'}`}>
                    <thead className="bg-gray-50 bg-opacity-50">
                        <tr className="text-left text-[12px] font-black text-gray-600 uppercase tracking-widest">
                            <th className="px-6 py-5">S.No.</th>
                            <th className="px-6 py-5">UID</th>
                            <th className="px-6 py-5">Student Name</th>
                            <th className="px-6 py-5">Class</th>
                            <th className="px-6 py-5">Contact</th>
                            <th className="px-6 py-5">Transport</th>
                            <th className="px-6 py-5">Transport Head</th>
                            <th className="px-6 py-5">Status</th>
                            <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                        {students.filter(s => !showOnlyActive || s.status === 'Active').length === 0 ? (
                            <tr>
                                <td colSpan="9" className="px-6 py-12 text-center text-gray-400 font-medium italic">No matching students found.</td>
                            </tr>
                        ) : (
                            students
                                .filter(s => !showOnlyActive || s.status === 'Active')
                                .map((student, index) => (
                                    <tr key={student.id} className="hover:bg-gray-50 transition group">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-600">{(index + 1).toString().padStart(2, '0')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-600 uppercase tracking-tighter">#{student.student_id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm font-bold text-gray-800">{student.name}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-black bg-gray-100 text-gray-600 px-2 py-1 rounded-lg uppercase">{student.student_class}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                                            {student.contact_number || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${student.has_transport ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                                                {student.has_transport ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-medium text-gray-600 italic">
                                                {student.has_transport ? (feeHeads.find(h => h.id == student.transport_fee_head)?.name || 'None Assigned') : '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {student.status === 'TC' ? (
                                                <span className="px-2 py-1 text-[9px] uppercase font-black tracking-tighter bg-red-100 text-red-700 rounded-lg">Withdrawal (TC)</span>
                                            ) : student.is_new_admission ? (
                                                <span className="px-2 py-1 text-[9px] uppercase font-black tracking-tighter bg-orange-100 text-orange-700 rounded-lg">New Admission</span>
                                            ) : (
                                                <span className="px-2 py-1 text-[9px] uppercase font-black tracking-tighter bg-green-100 text-green-700 rounded-lg">Active</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm flex gap-2 justify-end">
                                            <button
                                                onClick={() => {
                                                    setSelectedStudent(student);
                                                    setShowEnrollmentModal(true);
                                                }}
                                                className="text-purple-600 hover:text-purple-900 font-black uppercase text-[10px] tracking-widest bg-purple-50 px-3 py-1 rounded-xl opacity-0 group-hover:opacity-100 transition"
                                            >
                                                Manage Fees
                                            </button>
                                            <button
                                                onClick={() => handleEdit(student)}
                                                className="text-blue-600 hover:text-blue-900 font-black uppercase text-[10px] tracking-widest bg-blue-50 px-3 py-1 rounded-xl opacity-0 group-hover:opacity-100 transition"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Student Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-2xl font-bold text-gray-800">{editingStudent ? 'Edit Student Profile' : 'New Student Registration'}</h3>
                            <button onClick={() => { setShowModal(false); setEditingStudent(null); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddStudent} className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Student Name</label>
                                <input
                                    type="text"
                                    className="w-full border-2 border-gray-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-lg font-medium transition"
                                    value={newStudent.name}
                                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                                    required
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Contact Number</label>
                                <input
                                    type="text"
                                    className="w-full border-2 border-gray-100 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold transition"
                                    value={newStudent.contact_number}
                                    onChange={(e) => setNewStudent({ ...newStudent, contact_number: e.target.value })}
                                    placeholder="Enter mobile number"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Student ID</label>
                                    <input
                                        type="text"
                                        className="w-full border-2 border-gray-100 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold transition"
                                        value={newStudent.student_id}
                                        onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })}
                                        required
                                        placeholder="UID-101"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Class</label>
                                    <select
                                        className="w-full border-2 border-gray-100 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none bg-white font-bold transition"
                                        value={newStudent.student_class}
                                        onChange={(e) => setNewStudent({ ...newStudent, student_class: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Class</option>
                                        {classOptions.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Current Status</label>
                                    <select
                                        className="w-full border-2 border-gray-100 rounded-2xl px-5 py-3 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none bg-white font-bold transition text-xs"
                                        value={newStudent.status}
                                        onChange={(e) => setNewStudent({ ...newStudent, status: e.target.value })}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="TC">Withdrawal (TC)</option>
                                    </select>
                                </div>
                                <div className="flex items-end pb-3">
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            className="w-6 h-6 rounded-lg text-orange-500 focus:ring-orange-100 border-gray-200 pointer-events-auto shadow-sm"
                                            checked={newStudent.is_new_admission}
                                            onChange={(e) => setNewStudent({ ...newStudent, is_new_admission: e.target.checked })}
                                        />
                                        <span className="text-xs font-black text-gray-500 group-hover:text-orange-600 transition uppercase tracking-tighter">New Admission?</span>
                                    </label>
                                </div>
                            </div>

                            <div className={`p-5 rounded-3xl border-2 transition ${newStudent.has_transport ? 'bg-blue-600 border-blue-600 shadow-xl shadow-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                                <label className="flex items-center space-x-3 cursor-pointer mb-4">
                                    <input
                                        type="checkbox"
                                        className="w-6 h-6 rounded-lg text-blue-500 focus:ring-blue-100 border-gray-200 pointer-events-auto"
                                        checked={newStudent.has_transport}
                                        onChange={(e) => setNewStudent({ ...newStudent, has_transport: e.target.checked })}
                                    />
                                    <span className={`text-sm font-black uppercase tracking-tight ${newStudent.has_transport ? 'text-white' : 'text-gray-700'}`}>Avails School Transport?</span>
                                </label>

                                {newStudent.has_transport && (
                                    <div className="space-y-2 animate-in fade-in zoom-in-95">
                                        <select
                                            className="w-full border-none rounded-xl px-4 py-3 focus:ring-0 outline-none bg-white text-blue-900 font-bold"
                                            value={newStudent.transport_fee_head}
                                            onChange={(e) => setNewStudent({ ...newStudent, transport_fee_head: e.target.value })}
                                            required
                                        >
                                            <option value="">Link Transport Route/Fee Head</option>
                                            {transportHeads.map(head => (
                                                <option key={head.id} value={head.id}>{head.name} ({head.session})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setEditingStudent(null); resetForm(); }}
                                    className="flex-1 bg-gray-100 text-gray-500 px-4 py-4 rounded-2xl font-bold hover:bg-gray-200 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-black text-white px-4 py-4 rounded-2xl font-bold hover:bg-gray-900 shadow-xl shadow-gray-200 transition"
                                >
                                    {editingStudent ? 'Update Profile' : 'Save Student'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Enrollment Management Modal */}
            {showEnrollmentModal && selectedStudent && (
                <EnrollmentModal
                    student={selectedStudent}
                    session={currentSession}
                    onClose={() => {
                        setShowEnrollmentModal(false);
                        setSelectedStudent(null);
                    }}
                    onSave={() => {
                        fetchStudents(); // Refresh student list
                    }}
                />
            )}
        </div>
    );
}

export default Students;
