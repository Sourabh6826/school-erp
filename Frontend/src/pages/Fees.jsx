import { useState, useEffect } from 'react';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

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
    const [paymentMode, setPaymentMode] = useState('CASH');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit Receipt State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingReceipt, setEditingReceipt] = useState(null);

    const [globalSettings, setGlobalSettings] = useState({
        session: '2026-27',
        installment_count: 4,
        due_months: '4,7,10,1',
        due_day: 10,
        late_fee_amount: 0,
        late_fee_start_day: 15,
        late_fee_frequency: 'ONCE'
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [loading, setLoading] = useState(false);
    const [payAll, setPayAll] = useState(false);
    const [activeTab, setActiveTab] = useState('config'); // 'config' | 'transactions'

    useEffect(() => {
        const loadAll = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchGlobalSettings(),
                    fetchFeeHeads(),
                    fetchStudents(),
                    fetchTransactions()
                ]);
            } catch (err) {
                console.error("Fees load error:", err);
            } finally {
                setLoading(false);
            }
        };
        loadAll();
    }, [globalSettings.session]);

    const fetchGlobalSettings = async () => {
        try {
            const response = await api.get(`fees/settings/${globalSettings.session}/`);
            // Ensure session is preserved; backend serializer includes it but just to be safe
            setGlobalSettings(prev => ({
                ...prev,
                ...response.data,
                session: response.data.session || prev.session
            }));
        } catch (error) {
            console.log("No settings found for session, using defaults");
            // Preserve session even if fetch fails
            setGlobalSettings(prev => ({
                ...prev,
                installment_count: 4,
                due_months: '4,7,10,1',
                due_day: 10,
                // Only overwrite if not present? Actually defaults are fine, but keep session.
            }));
        }
    };

    const saveGlobalSettings = async () => {
        setIsSavingSettings(true);
        try {
            try {
                await api.put(`fees/settings/${globalSettings.session}/`, globalSettings);
            } catch (err) {
                console.warn("PUT failed, trying POST...", err);
                await api.post('fees/settings/', globalSettings);
            }
            alert("Settings saved successfully!");
            fetchFeeHeads();
        } catch (error) {
            console.error("Error saving global settings:", error.response?.data || error);
            alert(`Failed to save settings: ${JSON.stringify(error.response?.data || error.message)}`);
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
        setIsSubmitting(true);
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
                // Validation: Strict Sequential Check
                // We need to ensure that for any selected installment, all previous installments are FULLY PAID.
                // "Fully Paid" means: Historical Paid + Current Payment Amount >= Due Amount

                // FILTER STALE DATA: Only consider keys that belong to currently selected installments (active UI state)
                const activePaymentKeys = Object.keys(paymentAmounts).filter(key => {
                    const [instNum] = key.split('-');
                    return selectedInsts.includes(instNum) || selectedInsts.includes(parseInt(instNum));
                });

                const instsBeingPaid = [...new Set(activePaymentKeys
                    .filter(key => paymentAmounts[key] && parseFloat(paymentAmounts[key]) > 0)
                    .map(key => parseInt(key.split('-')[0])))
                ].sort((a, b) => a - b);

                if (instsBeingPaid.length > 0) {
                    const maxInst = Math.max(...instsBeingPaid);

                    // Check every installment from 1 up to (maxInst - 1)
                    for (let i = 1; i < maxInst; i++) {
                        const instData = studentFeeSummary.installment_data[i];
                        if (instData) {
                            // Check if this installment 'i' is fully cleared
                            const isFullyCleared = Object.entries(instData.heads).every(([hName, details]) => {
                                let head = feeHeads.find(h => h.name === hName);
                                if (!head && hName === "Transportation Fees" && selectedStudent?.transport_fee_head) {
                                    head = feeHeads.find(h => h.id === selectedStudent.transport_fee_head);
                                }

                                const key = `${i}-${head?.id}`;
                                const payingNow = (activePaymentKeys.includes(key) && paymentAmounts[key]) ? parseFloat(paymentAmounts[key]) : 0;
                                const totalPaidWithCurrent = details.paid + payingNow;
                                const remaining = details.due - totalPaidWithCurrent;

                                // Allow small float margin
                                return remaining < 0.01;
                            });

                            if (!isFullyCleared) {
                                alert(`Installment ${i} is not fully paid. You cannot make payments for Installment ${maxInst} until previous installments are cleared.`);
                                setIsSubmitting(false);
                                return;
                            }
                        }
                    }
                }

                items = activePaymentKeys
                    .filter(key => paymentAmounts[key] && parseFloat(paymentAmounts[key]) > 0)
                    .map(key => {
                        const [instNum, headId] = key.split('-');
                        return {
                            fee_head: headId,
                            amount_paid: paymentAmounts[key],
                            installment_number: instNum
                        };
                    });
            }

            if (items.length === 0) {
                alert("Please enter at least one payment amount");
                setIsSubmitting(false);
                return;
            }

            await api.post('fees/receipts/', {
                student: selectedStudent.id,
                items: items,
                remarks: paymentRemarks,
                payment_mode: paymentMode
            });

            setShowPaymentModal(false);
            setSelectedStudent(null);
            setPaymentAmounts({});
            setPaymentRemarks('');
            setPaymentMode('CASH');
            setPayAll(false);
            setSearchTerm('');
            fetchTransactions(historySearch);
            alert('Payment recorded successfully!');
        } catch (error) {
            console.error("Error recording payment:", error);
            alert("Failed to record payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrintReceipt = async (receipt) => {
        try {
            const response = await api.get(`fees/receipts/${receipt.id}/print_receipt/`);
            const data = response.data;

            // Create print window
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Receipt #${data.receipt_no}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
                        .header h1 { margin: 0; font-size: 28px; }
                        .header p { margin: 5px 0; color: #666; }
                        .receipt-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .info-block { }
                        .info-block label { font-weight: bold; display: block; margin-bottom: 5px; color: #333; }
                        .info-block p { margin: 0; font-size: 16px; }
                        table { width: 100%; border-collapse: collapse; margin: 30px 0; }
                        th { background: #f5f5f5; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: bold; }
                        td { padding: 12px; border-bottom: 1px solid #eee; }
                        .total-row { font-weight: bold; font-size: 18px; background: #f9f9f9; }
                        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
                        @media print { body { padding: 20px; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Payment Receipt</h1>
                        <p>School ERP System</p>
                    </div>
                    
                    <div class="receipt-info">
                        <div class="info-block">
                            <label>Receipt No:</label>
                            <p>#${data.receipt_no}</p>
                        </div>
                        <div class="info-block">
                            <label>Date:</label>
                            <p>${data.payment_date}</p>
                        </div>
                        <div class="info-block">
                            <label>Student Name:</label>
                            <p>${data.student_name}</p>
                        </div>
                        <div class="info-block">
                            <label>Student ID:</label>
                            <p>${data.student_id}</p>
                        </div>
                        <div class="info-block">
                            <label>Class:</label>
                            <p>${data.student_class}</p>
                        </div>
                        <div class="info-block">
                            <label>Payment Mode:</label>
                            <p>${data.payment_mode}</p>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Fee Head</th>
                                <th>Installment</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.map(item => `
                                <tr>
                                    <td>${item.fee_head}</td>
                                    <td>Installment ${item.installment_number}</td>
                                    <td style="text-align: right;">₹${item.amount_paid.toLocaleString('en-IN')}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="2">Total Amount</td>
                                <td style="text-align: right;">₹${data.total_amount.toLocaleString('en-IN')}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    ${data.remarks ? `<p><strong>Remarks:</strong> ${data.remarks}</p>` : ''}
                    
                    <div class="footer">
                        <p>This is a computer-generated receipt</p>
                    </div>
                    
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (error) {
            console.error("Error printing receipt:", error);
            alert("Failed to load receipt for printing");
        }
    };

    const handleEditTransaction = (receipt) => {
        const receiptCopy = JSON.parse(JSON.stringify(receipt));
        setEditingReceipt(receiptCopy);
        setShowEditModal(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const items = editingReceipt.transactions.map(t => ({
                transaction_id: t.id,
                amount_paid: t.amount_paid
            }));

            await api.put(`fees/receipts/${editingReceipt.id}/`, {
                items: items,
                remarks: editingReceipt.remarks
            });

            setShowEditModal(false);
            setEditingReceipt(null);
            fetchTransactions(historySearch);
            alert('Receipt updated successfully!');
        } catch (error) {
            console.error("Error updating receipt:", error);
            alert("Failed to update receipt");
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
    const [selectedInsts, setSelectedInsts] = useState([]);

    const selectStudentForPayment = async (s) => {
        setSelectedStudent(s);
        setPayAll(false);
        setStudentFeeSummary(null); // Clear previous summary immediately
        try {
            const url = `students/pending_fees/?student_id=${s.id}&show_all=true&session=${globalSettings.session}`;
            console.log("Fetching fees from:", url);
            const response = await api.get(url);
            // Use lax equality for ID check in case of string/number mismatch
            const summary = response.data.find(item => item.id == s.id);

            if (summary) {
                setStudentFeeSummary(summary);

                const initialAmounts = {};
                if (summary.installment_data) {
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
            } else {
                console.warn("Student not found in pending fees response", s, response.data);
                // Maybe set a flag 'noFeesFound' to show in UI? For now just log.
            }
        } catch (error) {
            console.error("Error fetching student fee summary:", error);
        }
    };

    return (
        <div className="p-4">
            <div className="grid grid-cols-3 items-center mb-6">
                <div>
                    <h2 className="text-3xl font-semibold">Fee Management</h2>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Configure Fees & Manage Payments</p>
                </div>

                <div className="flex justify-center">
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'config' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <span>⚙️ Configuration</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'transactions' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            <span>💸 Payments</span>
                        </button>
                    </div>
                </div>

                <div className="flex justify-end gap-3 min-h-[48px]">
                    {activeTab === 'transactions' && (
                        <button onClick={() => setShowPaymentModal(true)} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-100 transition flex items-center gap-2 animate-fade-in">
                            <span>+ Record Payment</span>
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'config' && (
                <div className="space-y-8 animate-fade-in-up">
                    {/* Global Settings Panel */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Global Configuration</h3>
                                <p className="text-xs text-gray-500 font-medium">Session and Late Fee policies</p>
                            </div>
                            <button
                                onClick={saveGlobalSettings}
                                disabled={isSavingSettings}
                                className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 disabled:bg-blue-300 transition shadow-lg shadow-blue-100"
                            >
                                {isSavingSettings ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Academic Session</label>
                                <select
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={globalSettings.session}
                                    onChange={(e) => setGlobalSettings({ ...globalSettings, session: e.target.value })}
                                >
                                    <option value="2024-25">2024-25</option>
                                    <option value="2025-26">2025-26</option>
                                    <option value="2026-27">2026-27</option>
                                </select>
                                <p className="text-[10px] text-gray-400 mt-2 font-medium">Changing session will reload all fee heads.</p>
                            </div>

                            <div className="bg-red-50 p-5 rounded-2xl border border-red-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <svg className="w-24 h-24 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                                </div>
                                <h4 className="text-sm font-black text-red-800 uppercase tracking-widest mb-4 flex items-center gap-2">Late Fee Policy</h4>
                                <div className="grid grid-cols-2 gap-4 relative z-10">
                                    <div>
                                        <label className="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Fine Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-xs font-bold text-red-300">₹</span>
                                            <input
                                                type="number"
                                                className="w-full bg-white border border-red-100 rounded-xl py-2 pl-6 pr-3 text-sm font-bold text-red-700 focus:ring-2 focus:ring-red-200 outline-none"
                                                value={globalSettings.late_fee_amount}
                                                onChange={(e) => setGlobalSettings({ ...globalSettings, late_fee_amount: e.target.value })}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Apply After Day</label>
                                        <input
                                            type="number"
                                            min="1" max="31"
                                            className="w-full bg-white border border-red-100 rounded-xl py-2 px-3 text-sm font-bold text-red-700 focus:ring-2 focus:ring-red-200 outline-none"
                                            value={globalSettings.late_fee_start_day}
                                            onChange={(e) => setGlobalSettings({ ...globalSettings, late_fee_start_day: e.target.value })}
                                            placeholder="15"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Frequency</label>
                                        <div className="flex bg-white rounded-xl p-1 border border-red-100">
                                            <button
                                                onClick={() => setGlobalSettings({ ...globalSettings, late_fee_frequency: 'ONCE' })}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${globalSettings.late_fee_frequency === 'ONCE' ? 'bg-red-500 text-white shadow-sm' : 'text-red-400 hover:bg-red-50'}`}
                                            >
                                                Once
                                            </button>
                                            <button
                                                onClick={() => setGlobalSettings({ ...globalSettings, late_fee_frequency: 'PER_DAY' })}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${globalSettings.late_fee_frequency === 'PER_DAY' ? 'bg-red-500 text-white shadow-sm' : 'text-red-400 hover:bg-red-50'}`}
                                            >
                                                Daily
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative min-h-[400px]">
                        {loading && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                <LoadingSpinner message="Syncing configurations..." />
                            </div>
                        )}
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

                            {/* Compact Common Settings */}
                            <div className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-xs font-black text-blue-800 uppercase tracking-widest">Common Settings</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Inst. Count</span>
                                        <input
                                            type="number"
                                            min="1" max="12"
                                            className="w-16 bg-white border border-blue-200 rounded-lg px-2 py-1 text-center font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                                            value={globalSettings.installment_count}
                                            onChange={(e) => setGlobalSettings({ ...globalSettings, installment_count: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-6 gap-1">
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
                                                className={`py-1.5 rounded-md text-[10px] font-black transition ${selected ? 'bg-blue-600 text-white shadow-sm scale-105' : 'bg-white text-blue-300 hover:bg-blue-100'}`}
                                            >
                                                {new Date(2000, m - 1).toLocaleString('default', { month: 'short' })}
                                            </button>
                                        )
                                    })}
                                </div>
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
                    </div>
                </div>
            )}

            {activeTab === 'transactions' && (
                <div className="space-y-8 animate-fade-in-up relative min-h-[400px]">
                    {loading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                            <LoadingSpinner message="Loading transaction history..." />
                        </div>
                    )}
                    <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100">
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
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-blue-600">#{group.receipt_no || 'N/A'}</td>
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
                                                                <span className="text-xs text-gray-700 font-medium">{item.fee_head_name || 'Fee'}</span>
                                                                <span className="text-[10px] text-gray-400 font-bold">₹{parseFloat(item.amount_paid || 0).toFixed(0)}</span>
                                                            </div>
                                                        ))}
                                                        {group.remarks && <p className="text-[10px] text-gray-400 italic mt-1 border-t border-gray-50 pt-1">"{group.remarks}"</p>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-black text-gray-900">₹{parseFloat(group.total_amount || 0).toLocaleString('en-IN')}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                                                        <button onClick={() => handlePrintReceipt(group)} className="w-8 h-8 flex items-center justify-center bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition" title="Print Receipt">🖨</button>
                                                        <button onClick={() => handleEditTransaction(group)} className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition" title="Edit">✎</button>
                                                        <button onClick={() => handleDeleteTransaction(group)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition" title="Delete">✕</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Record Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-0 rounded-3xl shadow-2xl w-[1000px] max-h-[90vh] overflow-hidden flex flex-col relative transition-all duration-300">
                        {isSubmitting && <LoadingSpinner message="Recording payment..." />}

                        {/* Header */}
                        <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100 bg-white z-10">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">New Payment Entry</h3>
                                {selectedStudent && <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Record Fees for {selectedStudent.name}</p>}
                            </div>
                            <button onClick={() => {
                                if (!isSubmitting) {
                                    setShowPaymentModal(false);
                                    setSelectedStudent(null);
                                    setSearchTerm('');
                                    setPaymentMode('CASH');
                                }
                            }} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        {!selectedStudent ? (
                            <div className="p-12 flex-1 overflow-y-auto">
                                <div className="max-w-md mx-auto space-y-6">
                                    <div className="relative">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 text-center">Step 1: Find Student</label>
                                        <input
                                            type="text"
                                            className="w-full border-2 border-gray-100 rounded-2xl px-6 py-5 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-xl font-medium transition shadow-sm"
                                            placeholder="Enter name or enrollment ID..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            autoFocus
                                        />
                                        {filteredStudents.length > 0 && (
                                            <div className="mt-4 border border-gray-100 rounded-2xl divide-y bg-white shadow-2xl max-h-60 overflow-y-auto absolute w-full z-20 overflow-hidden">
                                                {filteredStudents.map(s => (
                                                    <button
                                                        key={s.id}
                                                        className="w-full text-left px-6 py-4 hover:bg-blue-50 transition flex justify-between items-center group"
                                                        onClick={() => selectStudentForPayment(s)}
                                                    >
                                                        <div>
                                                            <p className="font-bold text-gray-800 group-hover:text-blue-700">{s.name}</p>
                                                            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tight opacity-70">#{s.student_id} • {s.student_class}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-blue-600 text-[10px] font-black opacity-0 group-hover:opacity-100 transition uppercase tracking-widest">Select Student</span>
                                                            <svg className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-10 border-2 border-dashed border-gray-100 rounded-[2rem] text-center bg-gray-50">
                                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-2xl">🔍</div>
                                        <p className="text-gray-400 font-medium">Search for a student to load their pending dues and record a payment.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-hidden flex">
                                {/* Left Panel: Student & Installments */}
                                <div className="w-[380px] border-r border-gray-100 bg-gray-50/50 p-8 overflow-y-auto">
                                    {/* Student Card */}
                                    <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-100 mb-8 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" /></svg>
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Student Profile</p>
                                            <p className="text-2xl font-black tracking-tight leading-tight">{selectedStudent.name}</p>
                                            <div className="flex flex-wrap gap-2 mt-4">
                                                <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest leading-none flex items-center shadow-inner">#{selectedStudent.student_id}</span>
                                                <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full uppercase tracking-widest leading-none flex items-center shadow-inner">{selectedStudent.student_class}</span>
                                                {selectedStudent.is_new_admission && <span className="text-[10px] font-black bg-orange-400 px-3 py-1 rounded-full uppercase tracking-widest leading-none flex items-center shadow-lg">New Adm.</span>}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedStudent(null); setPaymentAmounts({}); }}
                                            className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 backdrop-blur-sm"
                                        >
                                            Switch Student
                                        </button>
                                    </div>

                                    {studentFeeSummary && (
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Select Installments</label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPayAll(!payAll);
                                                        if (!payAll) setSelectedInsts([]);
                                                    }}
                                                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${payAll ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300 shadow-sm'}`}
                                                >
                                                    {payAll ? 'Paying Full' : 'Pay Full Balance'}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                {Object.keys(studentFeeSummary.installment_data).sort((a, b) => parseInt(a) - parseInt(b)).map(inst => {
                                                    const data = studentFeeSummary.installment_data[inst];
                                                    const totalDue = Object.values(data.heads).reduce((acc, h) => acc + h.due, 0);
                                                    const totalPaid = Object.values(data.heads).reduce((acc, h) => acc + h.paid, 0);
                                                    const isPaid = totalPaid >= (totalDue - 0.01) && totalDue > 0;

                                                    const prevInst = parseInt(inst) - 1;
                                                    const isPrevPaid = prevInst < 1 || selectedInsts.includes(prevInst.toString()) || (
                                                        Object.values(studentFeeSummary.installment_data[prevInst.toString()].heads).reduce((acc, h) => acc + h.paid, 0) >=
                                                        (Object.values(studentFeeSummary.installment_data[prevInst.toString()].heads).reduce((acc, h) => acc + h.due, 0) - 0.01)
                                                    );

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
                                                                        setSelectedInsts(selectedInsts.filter(i => parseInt(i) < parseInt(inst)));
                                                                    } else {
                                                                        const toSelect = [];
                                                                        for (let i = 1; i <= parseInt(inst); i++) {
                                                                            const iStr = i.toString();
                                                                            const iData = studentFeeSummary.installment_data[iStr];
                                                                            const iDue = Object.values(iData.heads).reduce((acc, h) => acc + h.due, 0);
                                                                            const iPaid = Object.values(iData.heads).reduce((acc, h) => acc + h.paid, 0);
                                                                            if (iPaid < (iDue - 0.01)) toSelect.push(iStr);
                                                                        }
                                                                        setSelectedInsts(toSelect);

                                                                        const newAmts = {};
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
                                                            className={`px-4 py-3 rounded-2xl text-[10px] font-black transition-all flex flex-col items-center border-2 ${isPaid ? 'bg-green-50 border-green-100 text-green-600 cursor-not-allowed opacity-60' :
                                                                isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' :
                                                                    !isPrevPaid ? 'bg-gray-50 border-transparent text-gray-300 cursor-not-allowed' :
                                                                        'bg-white border-white text-gray-600 hover:border-blue-200 shadow-sm'
                                                                } ${payAll ? 'grayscale opacity-50' : ''}`}
                                                        >
                                                            <span className="uppercase tracking-widest">{monthName}</span>
                                                            <span className="text-sm mt-1">{isPaid ? '✓' : `₹${(totalDue - totalPaid).toFixed(0)}`}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Panel: Payment Form */}
                                <div className="flex-1 p-8 overflow-y-auto bg-white flex flex-col">
                                    <div className="flex-1">
                                        {payAll && studentFeeSummary ? (
                                            <div className="p-8 bg-orange-50 border border-orange-100 rounded-[2rem] text-center animate-fade-in mb-8">
                                                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-2xl">🔥</div>
                                                <p className="text-orange-800 font-black uppercase tracking-widest text-[11px]">Full Balance Payment</p>
                                                <p className="text-4xl font-black text-orange-600 mt-2 tracking-tight">₹{studentFeeSummary.pending_amount.toLocaleString()}</p>
                                                <p className="text-xs text-orange-400 mt-2 font-medium">All pending dues for all installments will be cleared.</p>
                                            </div>
                                        ) : selectedInsts.length > 0 && studentFeeSummary ? (
                                            <div className="space-y-6 animate-fade-in">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm font-black text-gray-800 uppercase tracking-[0.15em]">Payment Breakdown</label>
                                                    <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest">{selectedInsts.length} Installments Selected</span>
                                                </div>

                                                <div className="space-y-4">
                                                    {selectedInsts.sort((a, b) => parseInt(a) - parseInt(b)).map(inst => (
                                                        <div key={inst} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
                                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                                                {globalSettings.due_months.split(',')[parseInt(inst) - 1] ? new Date(2000, parseInt(globalSettings.due_months.split(',')[parseInt(inst) - 1]) - 1).toLocaleString('default', { month: 'long' }) : `Installment ${inst}`}
                                                            </p>
                                                            <div className="space-y-3">
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
                                                                        <div key={key} className={`group flex items-center justify-between p-4 rounded-xl transition-all duration-300 border shadow-sm ${paymentAmounts[key] ? 'bg-white border-blue-200' : 'bg-transparent border-transparent'}`}>
                                                                            <div className="flex-1">
                                                                                <p className="text-sm font-bold text-gray-800">{displayName}</p>
                                                                                <div className="flex gap-3 mt-1 opacity-60">
                                                                                    <span className="text-[10px] text-gray-600 font-black uppercase tracking-tight">Due: ₹{details.due.toFixed(0)}</span>
                                                                                    {details.paid > 0 && <span className="text-[10px] text-green-700 font-black uppercase tracking-tight">Paid: ₹{details.paid.toFixed(0)}</span>}
                                                                                </div>
                                                                            </div>
                                                                            <div className="relative">
                                                                                <span className="absolute left-3 top-3.5 text-gray-300 text-xs font-bold leading-none">₹</span>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    placeholder="0"
                                                                                    disabled={details.pending <= 0}
                                                                                    className="w-32 border border-gray-100 rounded-xl py-3 pl-7 pr-3 text-right text-sm font-black focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none disabled:opacity-30 transition-all font-mono shadow-inner"
                                                                                    value={paymentAmounts[key] || ''}
                                                                                    onChange={(e) => setPaymentAmounts({ ...paymentAmounts, [key]: e.target.value })}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100">
                                                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 text-2xl">📅</div>
                                                <h4 className="text-gray-800 font-bold text-lg">No Installments Selected</h4>
                                                <p className="text-sm text-gray-400 max-w-xs mt-2 font-medium">Please select which months you are collecting fees for from the left panel.</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-6 border-t border-gray-100 space-y-6">
                                        <div className="grid grid-cols-2 gap-8">
                                            {/* Payment Mode Selector */}
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Payment Mode</label>
                                                <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPaymentMode('CASH')}
                                                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentMode === 'CASH' ? 'bg-white text-gray-800 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        💵 Cash
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPaymentMode('ONLINE')}
                                                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentMode === 'ONLINE' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        💳 Online
                                                    </button>
                                                </div>
                                                {paymentMode === 'ONLINE' && <p className="text-[9px] text-blue-500 mt-2 font-black uppercase tracking-widest text-center animate-pulse">Eligible for Bank Reconciliation</p>}
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Optional Remarks</label>
                                                <textarea
                                                    className="w-full border border-gray-100 rounded-2xl px-5 py-3 text-gray-700 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none text-sm min-h-[50px] transition-all"
                                                    value={paymentRemarks}
                                                    onChange={(e) => setPaymentRemarks(e.target.value)}
                                                    placeholder="Check no., UPI ref, etc..."
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-4 items-center">
                                            <div className="flex-1 bg-gray-900 rounded-3xl p-6 flex flex-col items-center justify-center text-white relative overflow-hidden group">
                                                <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Grand Total</p>
                                                <p className="text-3xl font-black tracking-tight leading-none">₹{
                                                    payAll ? (studentFeeSummary?.pending_amount || 0).toLocaleString() :
                                                        Object.values(paymentAmounts).reduce((acc, val) => acc + (parseFloat(val) || 0), 0).toLocaleString()
                                                }</p>
                                            </div>
                                            <button
                                                onClick={handlePaymentSubmit}
                                                disabled={isSubmitting || (!payAll && selectedInsts.length === 0)}
                                                className="flex-[1.5] h-full bg-green-600 text-white px-8 py-6 rounded-3xl font-black text-lg uppercase tracking-widest hover:bg-green-700 shadow-2xl shadow-green-200 transition-all disabled:opacity-30 flex items-center justify-center group"
                                            >
                                                <span>{isSubmitting ? 'Confirming...' : 'Record Payment'}</span>
                                                <svg className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7-7 7"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Payment History Section */}
            {/* Payment History Moved to Tab: transactions */}

            {/* Edit Receipt Modal */}
            {showEditModal && editingReceipt && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-[600px] max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-gray-800">Edit Receipt #{editingReceipt.receipt_no}</h3>
                            <button onClick={() => { setShowEditModal(false); setEditingReceipt(null); }} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-6">
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <p className="text-sm font-bold text-gray-700">{editingReceipt.student_name}</p>
                                <p className="text-xs text-gray-500">Date: {new Date(editingReceipt.payment_date).toLocaleDateString()}</p>
                            </div>

                            <div className="space-y-4">
                                {editingReceipt.transactions.map((t, idx) => (
                                    <div key={t.id || idx} className="flex justify-between items-center p-3 border border-gray-100 rounded-xl">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">{t.fee_head_name}</p>
                                            <p className="text-[10px] uppercase font-black text-gray-400">Installment {t.installment_number}</p>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm font-bold">₹</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-32 border border-gray-200 rounded-xl py-2 pl-7 pr-3 text-right text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={t.amount_paid}
                                                onChange={(e) => {
                                                    const updated = { ...editingReceipt };
                                                    updated.transactions[idx].amount_paid = e.target.value;
                                                    setEditingReceipt(updated);
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Remarks</label>
                                <textarea
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={editingReceipt.remarks}
                                    onChange={(e) => setEditingReceipt({ ...editingReceipt, remarks: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-4 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setEditingReceipt(null); }}
                                    className="flex-1 bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-bold hover:bg-gray-200 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-xl transition"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
