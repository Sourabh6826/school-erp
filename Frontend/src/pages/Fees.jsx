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
        frequency: 'ONCE',
        due_day: 10,
        due_months: '',
        late_fee_amount: 0,
        grace_period_days: 0,
        is_transport_fee: false
    });

    const [students, setStudents] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [historySearch, setHistorySearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmounts, setPaymentAmounts] = useState({}); // { headId: amount }
    const [paymentRemarks, setPaymentRemarks] = useState('');

    useEffect(() => {
        fetchFeeHeads();
        fetchStudents();
        fetchTransactions();
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

    const fetchTransactions = async (search = '') => {
        try {
            const url = search ? `fees/transactions/?search=${search}` : 'fees/transactions/';
            const response = await api.get(url);
            setTransactions(response.data);
        } catch (error) {
            console.error("Error fetching transactions:", error);
        }
    };

    const handleHistorySearch = (val) => {
        setHistorySearch(val);
        fetchTransactions(val);
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!selectedStudent) return;

        try {
            const promises = Object.entries(paymentAmounts)
                .filter(([_, amount]) => amount && parseFloat(amount) > 0)
                .map(([headId, amount]) => {
                    return api.post('fees/transactions/', {
                        student: selectedStudent.id,
                        fee_head: headId,
                        amount_paid: amount,
                        remarks: paymentRemarks
                    });
                });

            if (promises.length === 0) {
                alert("Please enter at least one payment amount");
                return;
            }

            await Promise.all(promises);
            setShowPaymentModal(false);
            setSelectedStudent(null);
            setPaymentAmounts({});
            setPaymentRemarks('');
            setSearchTerm('');
            fetchTransactions(historySearch);
            alert('Payments recorded successfully!');
        } catch (error) {
            console.error("Error recording payment:", error);
            alert("Failed to record payment");
        }
    };

    const filteredStudents = searchTerm.length >= 2
        ? students.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.student_id.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : [];

    const handleAddHead = async (e) => {
        e.preventDefault();
        try {
            if (editingHead) {
                await api.put(`fees/heads/${editingHead}/`, newHead);
            } else {
                await api.post('fees/heads/', newHead);
            }
            setShowModal(false);
            setEditingHead(null);
            resetHeadForm();
            fetchFeeHeads();
        } catch (error) {
            console.error("Error saving fee head:", error);
            alert("Failed to save fee head");
        }
    };

    const resetHeadForm = () => {
        setNewHead({
            name: '',
            description: '',
            session: '',
            amounts: [],
            frequency: 'ONCE',
            due_day: 10,
            due_months: '',
            late_fee_amount: 0,
            grace_period_days: 0,
            is_transport_fee: false
        });
    };

    const handleDeleteHead = async (headId) => {
        if (!window.confirm('Are you sure you want to delete this fee head?')) return;
        try {
            await api.delete(`fees/heads/${headId}/`);
            fetchFeeHeads();
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
            frequency: head.frequency || 'ONCE',
            due_day: head.due_day || 10,
            due_months: head.due_months || '',
            late_fee_amount: head.late_fee_amount || 0,
            grace_period_days: head.grace_period_days || 0,
            is_transport_fee: head.is_transport_fee || false
        });
        setShowModal(true);
    };

    const selectStudentForPayment = (s) => {
        setSelectedStudent(s);
        const initialAmounts = {};
        feeHeads.forEach(h => {
            const amtObj = h.amounts?.find(a => a.class_name === s.student_class);
            if (amtObj) {
                let shouldApply = false;

                if (h.is_transport_fee) {
                    if (s.has_transport && s.transport_fee_head == h.id) {
                        shouldApply = true;
                    }
                } else if (s.is_new_admission && h.frequency === 'ONCE') {
                    shouldApply = true;
                }

                if (shouldApply) {
                    let finalAmt = amtObj.amount;
                    if (h.frequency === 'INSTALLMENTS') {
                        const count = h.due_months ? h.due_months.split(',').length : 1;
                        finalAmt = (parseFloat(amtObj.amount) / count).toFixed(2);
                    }
                    initialAmounts[h.id] = finalAmt;
                }
            }
        });
        setPaymentAmounts(initialAmounts);
    };

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-semibold">Fees Management</h2>
                <div className="flex gap-3">
                    <button onClick={() => setShowModal(true)} className="bg-white text-gray-700 px-6 py-2 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 shadow-sm transition">Configure Fees</button>
                    <button onClick={() => setShowPaymentModal(true)} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-100 transition">Record Payment</button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                    Fee Heads & Structures
                </h3>
                {feeHeads.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 border-2 border-dashed rounded-xl">No fee heads defined. Start by clicking "Configure Fees".</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {feeHeads.map((head) => (
                            <div key={head.id} className="p-5 bg-gray-50 border border-gray-100 rounded-2xl relative group hover:shadow-md transition">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={() => handleEditHead(head)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-blue-600 shadow-sm border border-gray-100 hover:bg-blue-50">✎</button>
                                    <button onClick={() => handleDeleteHead(head.id)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-red-600 shadow-sm border border-gray-100 hover:bg-red-50">✕</button>
                                </div>
                                <p className="font-bold text-lg text-gray-800">{head.name}</p>
                                <div className="flex items-center flex-wrap gap-2 mt-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{head.session}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                        {head.frequency === 'ONCE' ? 'One Time' : 'Installments'}
                                    </span>
                                    {head.is_transport_fee && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Transport</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-3 line-clamp-2">{head.description || "No description provided."}</p>
                                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">{head.amounts?.length || 0} Classes Configured</span>
                                    {head.frequency === 'INSTALLMENTS' && (
                                        <span className="text-[10px] text-blue-600 font-bold uppercase">{head.due_months?.split(',').length} Months</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Record Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-[550px] max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-gray-800">New Payment Entry</h3>
                            <button onClick={() => { setShowPaymentModal(false); setSelectedStudent(null); setSearchTerm(''); }} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        {!selectedStudent ? (
                            <div className="space-y-4">
                                <div className="relative">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Search Student</label>
                                    <input
                                        type="text"
                                        className="w-full border-2 border-gray-100 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-lg font-medium transition"
                                        placeholder="Enter name or registration number..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                    {filteredStudents.length > 0 && (
                                        <div className="mt-3 border border-gray-100 rounded-2xl divide-y bg-white shadow-xl max-h-60 overflow-y-auto absolute w-full z-10">
                                            {filteredStudents.map(s => (
                                                <button
                                                    key={s.id}
                                                    className="w-full text-left px-5 py-4 hover:bg-blue-50 transition flex justify-between items-center group"
                                                    onClick={() => selectStudentForPayment(s)}
                                                >
                                                    <div>
                                                        <p className="font-bold text-gray-800 group-hover:text-blue-700">{s.name}</p>
                                                        <p className="text-xs text-gray-500 font-medium">#{s.student_id} • {s.student_class}</p>
                                                    </div>
                                                    <span className="text-blue-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition mr-2 uppercase tracking-widest">Select</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="p-10 border-2 border-dashed border-gray-100 rounded-3xl text-center text-gray-400 italic">
                                    Start typing above to find a student and record their fee payment.
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handlePaymentSubmit} className="space-y-6">
                                <div className="p-5 bg-blue-600 rounded-2xl flex justify-between items-center text-white shadow-lg shadow-blue-200">
                                    <div>
                                        <p className="text-lg font-black tracking-tight">{selectedStudent.name}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[10px] font-bold bg-white bg-opacity-20 px-2 py-0.5 rounded-full">#{selectedStudent.student_id}</span>
                                            <span className="text-[10px] font-bold bg-white bg-opacity-20 px-2 py-0.5 rounded-full">{selectedStudent.student_class}</span>
                                            {selectedStudent.is_new_admission && <span className="text-[10px] font-bold bg-orange-400 px-2 py-0.5 rounded-full">New Adm.</span>}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedStudent(null); setPaymentAmounts({}); }}
                                        className="text-[10px] font-bold uppercase tracking-widest py-2 px-3 bg-white bg-opacity-10 rounded-xl hover:bg-opacity-20"
                                    >
                                        Change
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Select Fee Components</label>
                                    <div className="space-y-3">
                                        {feeHeads.filter(h => {
                                            const isApplicableClass = h.amounts?.some(a => a.class_name === selectedStudent.student_class);
                                            if (!isApplicableClass) return false;

                                            // Transport Logic
                                            if (h.is_transport_fee) {
                                                return selectedStudent.has_transport && selectedStudent.transport_fee_head == h.id;
                                            }

                                            return true;
                                        }).map(head => {
                                            const amtObj = head.amounts.find(a => a.class_name === selectedStudent.student_class);
                                            const installmentCount = head.frequency === 'INSTALLMENTS' ? (head.due_months?.split(',').length || 1) : 1;
                                            const instAmt = (parseFloat(amtObj.amount) / installmentCount).toFixed(2);

                                            return (
                                                <div key={head.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition ${paymentAmounts[head.id] ? 'border-blue-500 bg-blue-50' : 'border-gray-50 hover:border-gray-100'}`}>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-gray-800">{head.name}</p>
                                                        <div className="flex gap-2 mt-0.5">
                                                            <span className="text-[10px] text-gray-400">Total: ₹{amtObj.amount}</span>
                                                            {head.frequency === 'INSTALLMENTS' && (
                                                                <span className="text-[10px] text-blue-600 font-bold tracking-tight">/ {installmentCount} Inst. (₹{instAmt})</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-bold">₹</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            className="w-32 border border-gray-200 rounded-xl py-2.5 pl-7 pr-3 text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                            value={paymentAmounts[head.id] || ''}
                                                            onChange={(e) => setPaymentAmounts({ ...paymentAmounts, [head.id]: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Payment Remarks</label>
                                    <textarea
                                        className="w-full border border-gray-200 rounded-2xl px-5 py-3 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[80px]"
                                        value={paymentRemarks}
                                        onChange={(e) => setPaymentRemarks(e.target.value)}
                                        placeholder="Optional check number, bank details, or reference..."
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => { setShowPaymentModal(false); setSelectedStudent(null); setSearchTerm(''); }}
                                        className="flex-1 bg-gray-100 text-gray-600 px-4 py-4 rounded-2xl font-bold hover:bg-gray-200 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-green-600 text-white px-4 py-4 rounded-2xl font-bold hover:bg-green-700 shadow-xl shadow-green-100 transition"
                                    >
                                        Confirm Payment
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Payment History Section */}
            <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100 mt-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Recent Transactions</h3>
                    <div className="flex items-center gap-4">
                        <input
                            type="text"
                            placeholder="Find by Name or ID..."
                            className="border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                            value={historySearch}
                            onChange={(e) => handleHistorySearch(e.target.value)}
                        />
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{transactions.length} Records</div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                            <tr className="bg-gray-50 bg-opacity-50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <th className="px-6 py-4">Transaction Date</th>
                                <th className="px-6 py-4">Student Name</th>
                                <th className="px-6 py-4">Fee Description</th>
                                <th className="px-6 py-3 text-right">Amount Paid</th>
                                <th className="px-6 py-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-50">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">No payments found.</td>
                                </tr>
                            ) : (
                                transactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">{new Date(t.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm font-bold text-gray-800">{students.find(s => s.id === t.student)?.name || 'Unknown Student'}</p>
                                            <p className="text-[10px] text-gray-400">UID: {students.find(s => s.id === t.student)?.student_id}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-700 font-medium">{feeHeads.find(h => h.id === t.fee_head)?.name || 'Fee Payment'}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-black text-gray-900">₹{parseFloat(t.amount_paid).toLocaleString('en-IN')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className="px-2 py-1 text-[9px] font-black uppercase tracking-tighter bg-green-100 text-green-700 rounded-lg">Collected</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Config Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-[700px] max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-2xl font-bold text-gray-800">{editingHead ? 'Edit Fee Head' : 'Configure New Fee Head'}</h3>
                            <button onClick={() => { setShowModal(false); setEditingHead(null); resetHeadForm(); }} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddHead} className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Name</label>
                                    <input
                                        type="text"
                                        placeholder="Tuition Fee, Transport etc"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                        value={newHead.name}
                                        onChange={(e) => setNewHead({ ...newHead, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Session</label>
                                        <select
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                            value={newHead.session}
                                            onChange={(e) => setNewHead({ ...newHead, session: e.target.value })}
                                            required
                                        >
                                            <option value="">Select</option>
                                            <option value="2024-25">2024-25</option>
                                            <option value="2025-26">2025-26</option>
                                            <option value="2026-27">2026-27</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Frequency</label>
                                        <select
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                            value={newHead.frequency}
                                            onChange={(e) => setNewHead({ ...newHead, frequency: e.target.value })}
                                            required
                                        >
                                            <option value="ONCE">One Time</option>
                                            <option value="INSTALLMENTS">Installments</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 pointer-events-auto shadow-sm"
                                            checked={newHead.is_transport_fee}
                                            onChange={(e) => setNewHead({ ...newHead, is_transport_fee: e.target.checked })}
                                        />
                                        <div>
                                            <p className="text-sm font-bold text-gray-700">Is this a Transport Fee?</p>
                                            <p className="text-[10px] text-gray-500 uppercase font-medium">Will be shown in student transport settings</p>
                                        </div>
                                    </label>
                                </div>

                                {newHead.frequency === 'INSTALLMENTS' && (
                                    <div className="p-4 bg-gray-50 rounded-2xl space-y-4 border border-gray-100">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Due Day of Month</label>
                                            <input
                                                type="number"
                                                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={newHead.due_day}
                                                onChange={(e) => setNewHead({ ...newHead, due_day: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Installment Months</label>
                                            <div className="grid grid-cols-4 gap-1">
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                                                    const isSelected = newHead.due_months.split(',').includes(m.toString());
                                                    return (
                                                        <button
                                                            key={m}
                                                            type="button"
                                                            onClick={() => {
                                                                let months = newHead.due_months ? newHead.due_months.split(',') : [];
                                                                if (months.includes(m.toString())) months = months.filter(x => x !== m.toString());
                                                                else months.push(m.toString());
                                                                setNewHead({ ...newHead, due_months: months.sort((a, b) => a - b).join(',') });
                                                            }}
                                                            className={`py-1 rounded-lg text-[10px] font-black ${isSelected ? 'bg-blue-600 text-white' : 'bg-white border text-gray-400 hover:bg-gray-100'}`}
                                                        >
                                                            {new Date(2000, m - 1).toLocaleString('default', { month: 'short' })}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Description</label>
                                    <textarea
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm min-h-[60px]"
                                        value={newHead.description}
                                        onChange={(e) => setNewHead({ ...newHead, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Set Amount per Class</label>
                                <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white max-h-[380px] overflow-y-auto">
                                    <table className="w-full">
                                        <tbody className="divide-y divide-gray-50">
                                            {['Nursery', 'KG1', 'KG2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((className) => (
                                                <tr key={className} className="hover:bg-gray-50">
                                                    <td className="py-2 px-4 text-xs font-bold text-gray-600 uppercase">{className}</td>
                                                    <td className="py-2 px-4 text-right">
                                                        <div className="relative inline-block">
                                                            <span className="absolute left-2 top-1.5 text-[10px] font-bold text-gray-400">₹</span>
                                                            <input
                                                                type="number"
                                                                className="w-24 border border-gray-100 rounded-lg py-1.5 pl-5 pr-2 text-right text-xs font-black focus:border-blue-500 outline-none"
                                                                value={newHead.amounts.find(a => a.class_name === className)?.amount || ''}
                                                                onChange={(e) => handleAmountChange(className, e.target.value)}
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex gap-3 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => { setShowModal(false); setEditingHead(null); resetHeadForm(); }}
                                        className="flex-1 bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-bold hover:bg-gray-200 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-xl transition"
                                    >
                                        Save Plan
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Fees;
