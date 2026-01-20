import { useState, useEffect } from 'react';
import api from '../api';

function Fees() {
    const [feeHeads, setFeeHeads] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingHead, setEditingHead] = useState(null);
    const [newHead, setNewHead] = useState({
        name: '',
        description: '',
        session: '',
        amounts: [],
        frequency: 'QUARTERLY',
        due_day: 10,
        due_months: '',
        late_fee_amount: 0,
        grace_period_days: 0
    });

    const [students, setStudents] = useState([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentData, setPaymentData] = useState({
        student: '',
        fee_head: '',
        amount_paid: '',
        remarks: ''
    });

    useEffect(() => {
        fetchFeeHeads();
        fetchStudents();
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

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('fees/transactions/', paymentData);
            setShowPaymentModal(false);
            setPaymentData({ student: '', fee_head: '', amount_paid: '', remarks: '' });
            alert('Payment recorded successfully!');
        } catch (error) {
            console.error("Error recording payment:", error);
            alert("Failed to record payment");
        }
    };

    // Auto-populate amount when student and fee head are selected
    useEffect(() => {
        if (paymentData.student && paymentData.fee_head) {
            const student = students.find(s => s.id === parseInt(paymentData.student));
            const head = feeHeads.find(h => h.id === parseInt(paymentData.fee_head));

            if (student && head && head.amounts) {
                const amountObj = head.amounts.find(a => a.class_name === student.student_class);
                if (amountObj) {
                    setPaymentData(prev => ({ ...prev, amount_paid: amountObj.amount }));
                }
            }
        }
    }, [paymentData.student, paymentData.fee_head, students, feeHeads]);

    const handleAddHead = async (e) => {
        e.preventDefault();
        try {
            if (editingHead) {
                // Update existing fee head
                await api.put(`fees/heads/${editingHead}/`, newHead);
            } else {
                // Create new fee head
                await api.post('fees/heads/', newHead);
            }
            setShowModal(false);
            setEditingHead(null);
            setNewHead({
                name: '',
                description: '',
                session: '',
                amounts: [],
                frequency: 'QUARTERLY',
                due_day: 10,
                due_months: '',
                late_fee_amount: 0,
                grace_period_days: 0
            });
            fetchFeeHeads();
        } catch (error) {
            console.error("Error saving fee head:", error);
            alert("Failed to save fee head");
        }
    };
    const handleDeleteHead = async (headId) => {
        if (!window.confirm('Are you sure you want to delete this fee head?')) {
            return;
        }

        try {
            await api.delete(`fees/heads/${headId}/`);
            fetchFeeHeads(); // Refresh the list
        } catch (error) {
            console.error("Error deleting fee head:", error);
            alert("Failed to delete fee head");
        }
    };
    const handleAmountChange = (className, amount) => {
        const updatedAmounts = [...newHead.amounts];
        const existingIndex = updatedAmounts.findIndex(a => a.class_name === className);

        if (existingIndex >= 0) {
            updatedAmounts[existingIndex] = { class_name: className, amount };
        } else {
            updatedAmounts.push({ class_name: className, amount });
        }

        setNewHead({ ...newHead, amounts: updatedAmounts });
    };
    const handleEditHead = (head) => {
        setEditingHead(head.id);
        setNewHead({
            name: head.name,
            description: head.description,
            session: head.session || '',
            amounts: head.amounts || [],
            frequency: head.frequency || 'QUARTERLY',
            due_day: head.due_day || 10,
            due_months: head.due_months || '',
            late_fee_amount: head.late_fee_amount || 0,
            grace_period_days: head.grace_period_days || 0
        });
        setShowModal(true);
    };
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-semibold">Fees Management</h2>
                <div className="space-x-2">
                    <button onClick={() => setShowModal(true)} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Add Fee Head</button>
                    <button onClick={() => setShowPaymentModal(true)} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Record Payment</button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h3 className="text-xl font-bold mb-4">
                    {editingHead ? 'Edit Fee Head' : 'Add Fee Head'}
                </h3>
                {feeHeads.length === 0 ? (
                    <p className="text-gray-500">No fee heads defined.</p>
                ) : (
                    <div className="flex gap-4 flex-wrap">
                        {feeHeads.map((head) => (
                            <div key={head.id} className="p-4 bg-gray-50 border rounded w-1/4 min-w-[200px] relative">
                                <div className="absolute top-2 right-2 flex gap-2">
                                    <button
                                        onClick={() => handleEditHead(head)}
                                        className="text-blue-600 hover:text-blue-800 font-bold"
                                        title="Edit"
                                    >
                                        ✎
                                    </button>
                                    <button
                                        onClick={() => handleDeleteHead(head.id)}
                                        className="text-red-600 hover:text-red-800 font-bold"
                                        title="Delete"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <p className="font-bold text-lg">{head.name}</p>
                                <p className="text-sm text-gray-500">{head.session}</p>
                                <p className="text-sm text-blue-600">
                                    {head.frequency === 'ONCE' && 'One Time Payment'}
                                    {head.frequency === 'QUARTERLY' && `Quarterly (Due: ${head.due_day}th)`}
                                </p>
                                {head.late_fee_amount > 0 && (
                                    <p className="text-xs text-red-600">
                                        Late Fee: ₹{head.late_fee_amount} (after {head.grace_period_days} days)
                                    </p>
                                )}
                                <p className="text-sm text-gray-500">{head.description || "No description"}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                    {head.amounts?.length || 0} class amounts defined
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Add Fee Head Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-[600px] max-w-2xl max-h-[90vh] overflow-y-auto relative">
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => {
                                setShowModal(false);
                                setEditingHead(null);
                                setNewHead({
                                    name: '',
                                    description: '',
                                    session: '',
                                    amounts: [],
                                    frequency: 'QUARTERLY',
                                    due_day: 10,
                                    due_months: '',
                                    late_fee_amount: 0,
                                    grace_period_days: 0
                                });
                            }}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold"
                            aria-label="Close"
                        >
                            ×
                        </button>
                        <h3 className="text-xl font-bold mb-4 pr-8">{editingHead ? 'Edit Fee Head' : 'Add Fee Head'}</h3>
                        <form onSubmit={handleAddHead}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Tuition Fee"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={newHead.name}
                                    onChange={(e) => setNewHead({ ...newHead, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Session</label>
                                <select
                                    className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={newHead.session}
                                    onChange={(e) => setNewHead({ ...newHead, session: e.target.value })}
                                    required
                                >
                                    <option value="">Select Session</option>
                                    <option value="2024-25">2024-25</option>
                                    <option value="2025-26">2025-26</option>
                                    <option value="2026-27">2026-27</option>
                                    <option value="2027-28">2027-28</option>
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Payment Frequency</label>
                                <select
                                    className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={newHead.frequency}
                                    onChange={(e) => setNewHead({ ...newHead, frequency: e.target.value })}
                                    required
                                >
                                    <option value="ONCE">One Time</option>
                                    <option value="QUARTERLY">Quarterly</option>
                                </select>
                            </div>

                            {/* Conditional Fields for Quarterly Payment */}
                            {newHead.frequency !== 'ONCE' && (
                                <>
                                    {/* Due Day */}
                                    <div className="mb-4">
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Due Day of Month</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            placeholder="e.g., 10"
                                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                            value={newHead.due_day}
                                            onChange={(e) => setNewHead({ ...newHead, due_day: e.target.value })}
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Day of the month when payment is due (1-31)</p>
                                    </div>

                                    {/* Due Months */}
                                    <div className="mb-4">
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Quarterly Months</label>
                                        <input
                                            type="text"
                                            placeholder="e.g., 4,7,10,1"
                                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                            value={newHead.due_months}
                                            onChange={(e) => setNewHead({ ...newHead, due_months: e.target.value })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Enter 4 months (1-12) separated by commas. (1=Jan, 2=Feb, ..., 12=Dec)<br />
                                            Example: "4,7,10,1" for April, July, October, January
                                        </p>
                                    </div>

                                    {/* Late Fee Amount */}
                                    <div className="mb-4">
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Late Fee Amount</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="e.g., 100"
                                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                            value={newHead.late_fee_amount}
                                            onChange={(e) => setNewHead({ ...newHead, late_fee_amount: e.target.value })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Amount charged after the grace period</p>
                                    </div>

                                    {/* Grace Period */}
                                    <div className="mb-4">
                                        <label className="block text-gray-700 text-sm font-bold mb-2">Grace Period (Days)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="e.g., 5"
                                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                            value={newHead.grace_period_days}
                                            onChange={(e) => setNewHead({ ...newHead, grace_period_days: e.target.value })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Days after due date before late fee applies</p>
                                    </div>
                                </>
                            )}
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Description (Optional)</label>
                                <textarea
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={newHead.description}
                                    onChange={(e) => setNewHead({ ...newHead, description: e.target.value })}
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Amount per Class</label>
                                <div className="max-h-60 overflow-y-auto border rounded p-3 bg-gray-50">
                                    {['Nursery', 'KG1', 'KG2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((className) => (
                                        <div key={className} className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-medium">{className}</span>
                                            <input
                                                type="number"
                                                placeholder="Amount"
                                                className="border rounded py-1 px-2 w-32 text-right"
                                                value={newHead.amounts.find(a => a.class_name === className)?.amount || ''}
                                                onChange={(e) => handleAmountChange(className, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingHead(null);
                                        setNewHead({
                                            name: '',
                                            description: '',
                                            session: '',
                                            amounts: [],
                                            frequency: 'QUARTERLY',
                                            due_day: 10,
                                            due_months: '',
                                            late_fee_amount: 0,
                                            grace_period_days: 0
                                        });
                                    }}
                                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Record Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">Record Payment</h3>
                        <form onSubmit={handlePaymentSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Student</label>
                                <select
                                    className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={paymentData.student}
                                    onChange={(e) => setPaymentData({ ...paymentData, student: e.target.value })}
                                    required
                                >
                                    <option value="">Select Student</option>
                                    {students.map(student => (
                                        <option key={student.id} value={student.id}>
                                            {student.name} ({student.student_class})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Fee Head</label>
                                <select
                                    className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={paymentData.fee_head}
                                    onChange={(e) => setPaymentData({ ...paymentData, fee_head: e.target.value })}
                                    required
                                >
                                    <option value="">Select Fee Head</option>
                                    {feeHeads.map(head => (
                                        <option key={head.id} value={head.id}>
                                            {head.name} - {head.session}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={paymentData.amount_paid}
                                    onChange={(e) => setPaymentData({ ...paymentData, amount_paid: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Remarks</label>
                                <textarea
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={paymentData.remarks}
                                    onChange={(e) => setPaymentData({ ...paymentData, remarks: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                >
                                    Record
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Fees;
