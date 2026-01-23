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
        frequency: 'INSTALLMENTS',
        installment_count: 1,
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

    const [globalSettings, setGlobalSettings] = useState({
        session: '2026-27',
        installment_count: 4,
        due_months: '4,7,10,1',
        due_day: 10
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [payAll, setPayAll] = useState(false);

    useEffect(() => {
        fetchGlobalSettings();
        fetchFeeHeads();
        fetchStudents();
        fetchTransactions();
    }, [globalSettings.session]);

    const fetchGlobalSettings = async () => {
        try {
            const response = await api.get(`fees/settings/${globalSettings.session}/`);
            setGlobalSettings(response.data);
        } catch (error) {
            console.log("No settings found for session, using defaults");
            setGlobalSettings({
                session: globalSettings.session,
                installment_count: 4,
                due_months: '4,7,10,1',
                due_day: 10
            });
        }
    };

    const saveGlobalSettings = async () => {
        setIsSavingSettings(true);
        try {
            try {
                await api.put(`fees/settings/${globalSettings.session}/`, globalSettings);
            } catch (err) {
                await api.post('fees/settings/', globalSettings);
            }
            alert("Settings saved successfully!");
            fetchFeeHeads(); // Refresh to see if frequency matching changed anything
        } catch (error) {
            console.error("Error saving global settings:", error);
            alert("Failed to save settings");
        } finally {
            setIsSavingSettings(false);
        }
    };

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
            const response = await api.get(`fees/heads/?session=${globalSettings.session}`);
            setFeeHeads(response.data);
        } catch (error) {
            console.error("Error fetching fee heads:", error);
        }
    };

    const handleHistorySearch = (val) => {
        setHistorySearch(val);
        fetchTransactions(val);
    };

    const fetchTransactions = async (search = '') => {
        try {
            const url = search ? `fees/receipts/?search=${search}` : 'fees/receipts/';
            const response = await api.get(url);
            setTransactions(response.data);
        } catch (error) {
            console.error("Error fetching receipts:", error);
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!selectedStudent) return;

        try {
            let items = [];
            if (payAll && studentFeeSummary?.installment_data) {
                // Collect all pending amounts across all installments
                Object.entries(studentFeeSummary.installment_data).forEach(([instNum, data]) => {
                    Object.entries(data.heads).forEach(([hName, details]) => {
                        if (details.pending > 0) {
                            let head = feeHeads.find(h => h.name === hName);
                            if (!head && hName === "Transportation Fees" && selectedStudent?.transport_fee_head) {
                                head = feeHeads.find(h => h.id === selectedStudent.transport_fee_head);
                            }

                            if (head) {
                                items.push({
                                    fee_head: head.id,
                                    amount_paid: details.pending,
                                    installment_number: instNum
                                });
                            }
                        }
                    });
                });
            } else {
                // Validation: Check sequential installments
                const selectedInsts = [...new Set(Object.keys(paymentAmounts).map(key => parseInt(key.split('-')[0])))].sort((a, b) => a - b);

                if (selectedInsts.length > 0) {
                    const maxInst = Math.max(...selectedInsts);
                    for (let i = 1; i < maxInst; i++) {
                        const instData = studentFeeSummary.installment_data[i];
                        if (instData) {
                            const unpaidInPrior = Object.entries(instData.heads).some(([hName, details]) => {
                                let head = feeHeads.find(h => h.name === hName);
                                if (!head && hName === "Transportation Fees" && selectedStudent?.transport_fee_head) {
                                    head = feeHeads.find(h => h.id === selectedStudent.transport_fee_head);
                                }
                                const beingPaid = paymentAmounts[`${i}-${head?.id}`];
                                const remaining = details.pending - (beingPaid ? parseFloat(beingPaid) : 0);
                                return remaining > 0.01; // Using small threshold for float comparison
                            });

                            if (unpaidInPrior) {
                                alert(`Please pay all dues for Installment ${i} before paying for Installment ${maxInst}.`);
                                return;
                            }
                        }
                    }
                }

                items = Object.entries(paymentAmounts)
                    .filter(([key, amount]) => amount && parseFloat(amount) > 0)
                    .map(([key, amount]) => {
                        const [instNum, headId] = key.split('-');
                        return {
                            fee_head: headId,
                            amount_paid: amount,
                            installment_number: instNum
                        };
                    });
            }

            if (items.length === 0) {
                alert("Please enter at least one payment amount");
                return;
            }

            await api.post('fees/receipts/', {
                student: selectedStudent.id,
                items: items,
                remarks: paymentRemarks
            });

            setShowPaymentModal(false);
            setSelectedStudent(null);
            setPaymentAmounts({});
            setPaymentRemarks('');
            setPayAll(false);
            setSearchTerm('');
            fetchTransactions(historySearch);
            alert('Payment recorded successfully!');
        } catch (error) {
            console.error("Error recording payment:", error);
            alert("Failed to record payment");
        }
    };

    const handleDeleteTransaction = async (receipt) => {
        if (!window.confirm(`Are you sure you want to delete Receipt #${receipt.receipt_no}? This will revert student balances.`)) return;
        try {
            await api.delete(`fees/receipts/${receipt.id}/`);
            fetchTransactions(historySearch);
            alert('Receipt deleted.');
        } catch (error) {
            console.error("Error deleting receipt:", error);
            alert("Failed to delete record");
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
            const headData = {
                ...newHead,
                session: globalSettings.session,
                // These are now global, but backend might still expect them in model
                // We'll pass them from global settings to keep backend happy for now
                installment_count: newHead.frequency === 'ONCE' ? 1 : globalSettings.installment_count,
                due_day: globalSettings.due_day,
                due_months: globalSettings.due_months
            };

            if (editingHead) {
                await api.put(`fees/heads/${editingHead}/`, headData);
            } else {
                await api.post('fees/heads/', headData);
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
            session: globalSettings.session,
            amounts: [],
            frequency: 'INSTALLMENTS',
            installment_count: globalSettings.installment_count,
            due_day: globalSettings.due_day,
            due_months: globalSettings.due_months,
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
            frequency: head.frequency || 'INSTALLMENTS',
            installment_count: head.installment_count || 1,
            due_day: head.due_day || 10,
            due_months: head.due_months || '',
            late_fee_amount: head.late_fee_amount || 0,
            grace_period_days: head.grace_period_days || 0,
            is_transport_fee: head.is_transport_fee || false
        });
        setShowModal(true);
    };

    const [studentFeeSummary, setStudentFeeSummary] = useState(null);
    const [selectedInsts, setSelectedInsts] = useState([]); // Array of strings

    const selectStudentForPayment = async (s) => {
        setSelectedStudent(s);
        setPayAll(false);
        try {
            const response = await api.get(`students/pending_fees/?student_id=${s.id}&show_all=true&session=${globalSettings.session}`);
            const summary = response.data.find(item => item.id === s.id);
            setStudentFeeSummary(summary);

            const initialAmounts = {};
            if (summary && summary.installment_data) {
                // Find first installment that has pending dues
                const firstPendingEntry = Object.entries(summary.installment_data).sort((a, b) => parseInt(a) - parseInt(b)).find(([_, data]) => {
                    return Object.values(data.heads).some(h => h.pending > 0);
                });

                if (firstPendingEntry) {
                    const instNum = firstPendingEntry[0];
                    setSelectedInsts([instNum]);
                    Object.entries(firstPendingEntry[1].heads).forEach(([headName, details]) => {
                        if (details.pending > 0) {
                            let head = feeHeads.find(h => h.name === headName);
                            if (!head && headName === "Transportation Fees" && s.transport_fee_head) {
                                head = feeHeads.find(h => h.id === s.transport_fee_head);
                            }
                            if (head) initialAmounts[`${instNum}-${head.id}`] = details.pending.toFixed(2);
                        }
                    });
                } else {
                    setSelectedInsts([]);
                }
            }
            setPaymentAmounts(initialAmounts);
        } catch (error) {
            console.error("Error fetching student fee summary:", error);
        }
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

            {/* Global Settings Panel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 border-l-4 border-l-blue-600">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                            Common Installment Settings
                        </h3>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-tight">Applies to all installment-based fee heads</p>
                    </div>
                    <button
                        onClick={saveGlobalSettings}
                        disabled={isSavingSettings}
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 disabled:bg-blue-300 transition shadow-lg shadow-blue-100"
                    >
                        {isSavingSettings ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Session</label>
                        <select
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 font-bold text-gray-700 focus:ring-2 focus:ring-blue-500"
                            value={globalSettings.session}
                            onChange={(e) => setGlobalSettings({ ...globalSettings, session: e.target.value })}
                        >
                            <option value="2024-25">2024-25</option>
                            <option value="2025-26">2025-26</option>
                            <option value="2026-27">2026-27</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Installment Count</label>
                        <input
                            type="number"
                            min="1" max="12"
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 font-bold text-gray-700 focus:ring-2 focus:ring-blue-500"
                            value={globalSettings.installment_count}
                            onChange={(e) => setGlobalSettings({ ...globalSettings, installment_count: parseInt(e.target.value) || 1 })}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Due Months ({globalSettings.due_months.split(',').filter(x => x).length} / {globalSettings.installment_count})</label>
                        <div className="grid grid-cols-6 gap-2">
                            {[4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map(m => {
                                const selected = globalSettings.due_months.split(',').includes(m.toString());
                                return (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => {
                                            const current = globalSettings.due_months.split(',').filter(x => x);
                                            if (selected) {
                                                setGlobalSettings({ ...globalSettings, due_months: current.filter(x => x !== m.toString()).join(',') });
                                            } else if (current.length < globalSettings.installment_count) {
                                                setGlobalSettings({ ...globalSettings, due_months: [...current, m.toString()].join(',') });
                                            }
                                        }}
                                        className={`py-2 rounded-lg text-[10px] font-black transition ${selected ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                            }`}
                                    >
                                        {new Date(2000, m - 1).toLocaleString('default', { month: 'short' })}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* One-time Fee Heads */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span className="w-2 h-6 bg-orange-400 rounded-full"></span>
                            One-time Fee Heads
                        </h3>
                        <button
                            onClick={() => { resetHeadForm(); setNewHead(h => ({ ...h, frequency: 'ONCE' })); setShowModal(true); }}
                            className="text-xs font-bold uppercase tracking-widest text-orange-600 hover:text-orange-700 bg-orange-50 px-4 py-2 rounded-xl transition"
                        >
                            + Add One-time
                        </button>
                    </div>
                    <div className="space-y-4">
                        {feeHeads.filter(h => h.frequency === 'ONCE').length === 0 ? (
                            <div className="py-20 text-center text-gray-400 border-2 border-dashed rounded-2xl bg-gray-50">No one-time fees.</div>
                        ) : (
                            feeHeads.filter(h => h.frequency === 'ONCE').map(head => (
                                <div key={head.id} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex justify-between items-center hover:shadow-sm transition group">
                                    <div>
                                        <p className="font-bold text-gray-800">{head.name}</p>
                                        <p className="text-[10px] text-gray-400 uppercase font-black">{head.amounts?.length || 0} Classes Configured</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEditHead(head)} className="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-blue-600 shadow-sm border border-gray-100 hover:bg-blue-50">✎</button>
                                        <button onClick={() => handleDeleteHead(head.id)} className="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-red-600 shadow-sm border border-gray-100 hover:bg-red-50">✕</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Installment Fee Heads */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                            Installment Fee Heads
                        </h3>
                        <button
                            onClick={() => { resetHeadForm(); setNewHead(h => ({ ...h, frequency: 'INSTALLMENTS' })); setShowModal(true); }}
                            className="text-xs font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-xl transition"
                        >
                            + Add Installment
                        </button>
                    </div>
                    <div className="space-y-4">
                        {feeHeads.filter(h => h.frequency === 'INSTALLMENTS').length === 0 ? (
                            <div className="py-20 text-center text-gray-400 border-2 border-dashed rounded-2xl bg-gray-50">No installment fees.</div>
                        ) : (
                            feeHeads.filter(h => h.frequency === 'INSTALLMENTS').map(head => (
                                <div key={head.id} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex justify-between items-center hover:shadow-sm transition group">
                                    <div>
                                        <p className="font-bold text-gray-800">{head.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[10px] text-gray-400 uppercase font-black">{head.amounts?.length || 0} Classes</p>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <p className="text-[10px] text-blue-600 uppercase font-black">{globalSettings.installment_count} Inst.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEditHead(head)} className="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-blue-600 shadow-sm border border-gray-100 hover:bg-blue-50">✎</button>
                                        <button onClick={() => handleDeleteHead(head.id)} className="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-red-600 shadow-sm border border-gray-100 hover:bg-red-50">✕</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
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

                                {studentFeeSummary && (
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <label className="block text-sm font-black text-gray-600 uppercase tracking-widest">Select Installment</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPayAll(!payAll);
                                                    if (!payAll) setSelectedInsts([]);
                                                }}
                                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition ${payAll ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                            >
                                                {payAll ? 'Paying All' : 'Pay All Installments'}
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mb-6">
                                            {Object.keys(studentFeeSummary.installment_data).sort((a, b) => parseInt(a) - parseInt(b)).map(inst => {
                                                const data = studentFeeSummary.installment_data[inst];
                                                const totalDue = Object.values(data.heads).reduce((acc, h) => acc + h.due, 0);
                                                const totalPaid = Object.values(data.heads).reduce((acc, h) => acc + h.paid, 0);
                                                const isPaid = totalPaid >= (totalDue - 0.01) && totalDue > 0;

                                                // Check if previous installment is paid OR being paid in this transaction
                                                const prevInst = parseInt(inst) - 1;
                                                const isPrevPaid = prevInst < 1 || selectedInsts.includes(prevInst.toString()) || (
                                                    Object.values(studentFeeSummary.installment_data[prevInst.toString()].heads).reduce((acc, h) => acc + h.paid, 0) >=
                                                    (Object.values(studentFeeSummary.installment_data[prevInst.toString()].heads).reduce((acc, h) => acc + h.due, 0) - 0.01)
                                                );

                                                // Get month name
                                                const monthsArray = globalSettings.due_months.split(',');
                                                const monthNum = monthsArray[parseInt(inst) - 1];
                                                const monthName = monthNum ? new Date(2000, parseInt(monthNum) - 1).toLocaleString('default', { month: 'short' }) : `Inst ${inst}`;

                                                const isSelected = selectedInsts.includes(inst);

                                                return (
                                                    <button
                                                        key={inst}
                                                        type="button"
                                                        disabled={payAll || (!isPrevPaid && !isSelected)}
                                                        onClick={() => {
                                                            if (!isPaid) {
                                                                if (isSelected) {
                                                                    // Unselect this and all subsequent
                                                                    setSelectedInsts(selectedInsts.filter(i => parseInt(i) < parseInt(inst)));
                                                                } else {
                                                                    // Select this and all previous unpaid
                                                                    const toSelect = [];
                                                                    for (let i = 1; i <= parseInt(inst); i++) {
                                                                        const iStr = i.toString();
                                                                        const iData = studentFeeSummary.installment_data[iStr];
                                                                        const iDue = Object.values(iData.heads).reduce((acc, h) => acc + h.due, 0);
                                                                        const iPaid = Object.values(iData.heads).reduce((acc, h) => acc + h.paid, 0);
                                                                        if (iPaid < (iDue - 0.01)) toSelect.push(iStr);
                                                                    }
                                                                    setSelectedInsts(toSelect);

                                                                    // Pre-fill amounts
                                                                    toSelect.forEach(sInst => {
                                                                        Object.entries(studentFeeSummary.installment_data[sInst].heads).forEach(([hName, details]) => {
                                                                            if (details.pending > 0) {
                                                                                let head = feeHeads.find(h => h.name === hName);
                                                                                if (!head && hName === "Transportation Fees" && selectedStudent?.transport_fee_head) {
                                                                                    head = feeHeads.find(h => h.id === selectedStudent.transport_fee_head);
                                                                                }
                                                                                if (head) newAmts[`${sInst}-${head.id}`] = details.pending.toFixed(2);
                                                                            }
                                                                        });
                                                                    });
                                                                    setPaymentAmounts(newAmts);
                                                                }
                                                            }
                                                        }}
                                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex flex-col items-center min-w-[85px] border-2 ${isPaid ? 'bg-green-50 border-green-100 text-green-600 cursor-not-allowed' :
                                                            isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-md' :
                                                                !isPrevPaid ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed' :
                                                                    'bg-white border-gray-100 text-gray-600 hover:border-blue-200'
                                                            } ${payAll ? 'opacity-30' : ''}`}
                                                    >
                                                        <span className="uppercase text-[11px] font-black">{monthName}</span>
                                                        <span className="text-sm mt-0.5">{isPaid ? 'PAID' : `₹${(totalDue - totalPaid).toFixed(0)}`}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {selectedInsts.length > 0 && studentFeeSummary && !payAll && (
                                    <div>
                                        <label className="block text-sm font-black text-gray-600 uppercase tracking-widest mb-4">
                                            Selected Installments Breakdown
                                        </label>
                                        <div className="space-y-6">
                                            {selectedInsts.sort((a, b) => parseInt(a) - parseInt(b)).map(inst => (
                                                <div key={inst} className="space-y-3">
                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-lg inline-block">
                                                        {globalSettings.due_months.split(',')[parseInt(inst) - 1] ? new Date(2000, parseInt(globalSettings.due_months.split(',')[parseInt(inst) - 1]) - 1).toLocaleString('default', { month: 'long' }) : `Installment ${inst}`}
                                                    </p>
                                                    {Object.entries(studentFeeSummary.installment_data[inst].heads).map(([headName, details]) => {
                                                        let head = feeHeads.find(h => h.name === headName);
                                                        if (!head && headName === "Transportation Fees" && selectedStudent?.transport_fee_head) {
                                                            head = feeHeads.find(h => h.id === selectedStudent.transport_fee_head);
                                                        }
                                                        if (!head) return null;
                                                        const key = `${inst}-${head.id}`;
                                                        const isTransport = head?.is_transport_fee;
                                                        const displayName = isTransport ? "Transportation Fees" : headName;

                                                        return (
                                                            <div key={key} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition ${paymentAmounts[key] ? 'border-blue-500 bg-blue-50' : 'border-gray-50 hover:border-gray-100'}`}>
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-bold text-gray-800">{displayName}</p>
                                                                    <div className="flex gap-3 mt-1">
                                                                        <span className="text-xs text-gray-600 font-black uppercase tracking-tight">Due: ₹{details.due.toFixed(2)}</span>
                                                                        {details.paid > 0 && <span className="text-xs text-green-700 font-black uppercase tracking-tight">Paid: ₹{details.paid.toFixed(2)}</span>}
                                                                    </div>
                                                                </div>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-bold">₹</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="0.00"
                                                                        disabled={details.pending <= 0}
                                                                        className="w-32 border border-gray-200 rounded-xl py-2.5 pl-7 pr-3 text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                                                                        value={paymentAmounts[key] || ''}
                                                                        onChange={(e) => setPaymentAmounts({ ...paymentAmounts, [key]: e.target.value })}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {payAll && studentFeeSummary && (
                                    <div className="p-6 bg-orange-50 border border-orange-200 rounded-2xl text-center">
                                        <p className="text-orange-800 font-bold">You are paying all pending dues for all installments.</p>
                                        <p className="text-2xl font-black text-orange-600 mt-2">₹{studentFeeSummary.pending_amount.toLocaleString()}</p>
                                    </div>
                                )}

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
                            <tr className="bg-gray-50 bg-opacity-80 text-left text-[11px] font-black text-gray-600 uppercase tracking-widest">
                                <th className="px-6 py-4">Receipt #</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Student Name</th>
                                <th className="px-6 py-4">Fee Details</th>
                                <th className="px-6 py-3 text-right">Total Paid</th>
                                <th className="px-6 py-4 text-right pr-10">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-50">
                            {(!transactions || transactions.length === 0) ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">No payments found.</td>
                                </tr>
                            ) : (
                                transactions.map((group) => (
                                    <tr key={group.id} className="hover:bg-gray-50 transition group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-blue-600">
                                            #{group.receipt_no || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-500">
                                            {group.payment_date ? new Date(group.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm font-bold text-gray-800">{group.student_name || 'Unknown'}</p>
                                            <p className="text-xs font-bold text-gray-500">ID: {group.student_uid || 'N/A'}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                {(group.transactions || []).map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase">Inst {item.installment_number}</span>
                                                        <span className="text-xs text-gray-700 font-medium">
                                                            {item.fee_head_name || 'Fee'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-bold">₹{parseFloat(item.amount_paid || 0).toFixed(0)}</span>
                                                    </div>
                                                ))}
                                                {group.remarks && <p className="text-[10px] text-gray-400 italic mt-1 border-t border-gray-50 pt-1">"{group.remarks}"</p>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-black text-gray-900">
                                            ₹{parseFloat(group.total_amount || 0).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                                                <button onClick={() => handleDeleteTransaction(group)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">✕</button>
                                            </div>
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
                                {/* Session and Frequency are now global and preset */}

                                {newHead.frequency === 'INSTALLMENTS' && (
                                    <div className="col-span-2 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">!</div>
                                        <div>
                                            <p className="text-sm font-bold text-blue-700">Inherited Global Settings</p>
                                            <p className="text-[10px] text-blue-500 uppercase font-black">This fee will have {globalSettings.installment_count} installments as per global config.</p>
                                        </div>
                                    </div>
                                )}

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

                                {/* Due Day and Months are now global */}
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
