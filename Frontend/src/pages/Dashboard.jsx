import { useState, useEffect } from 'react';
import api from '../api';

function Dashboard() {
    const [stats, setStats] = useState({
        total_students: 0,
        active_students: 0,
        tc_students: 0,
        total_collected: 0,
        total_pending: 0
    });
    const [pendingFees, setPendingFees] = useState([]);
    const [filters, setFilters] = useState({
        session: '2026-27',
        student_class: '',
        installment: '1',
        date: new Date().toISOString().split('T')[0],
        show_all: false
    });
    const [globalSettings, setGlobalSettings] = useState({ installment_count: 1 });

    const classOptions = ['Nursery', 'KG1', 'KG2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

    useEffect(() => {
        fetchGlobalSettings();
        fetchStats();
        fetchPendingFees();
    }, [filters]);

    const fetchGlobalSettings = async () => {
        try {
            const response = await api.get(`fees/settings/${filters.session}/`);
            setGlobalSettings(response.data);
            // If current installment filter is higher than new count, reset it
            if (parseInt(filters.installment) > response.data.installment_count) {
                setFilters(prev => ({ ...prev, installment: '1' }));
            }
        } catch (error) {
            console.log("No settings found for session, using defaults");
            setGlobalSettings({ installment_count: 4 });
        }
    };

    const fetchStats = async () => {
        try {
            const queryParams = new URLSearchParams(filters).toString();
            const response = await api.get(`students/stats/?${queryParams}`);
            setStats(response.data);
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };

    const fetchPendingFees = async () => {
        try {
            const queryParams = new URLSearchParams({
                session: filters.session,
                student_class: filters.student_class,
                show_all: filters.show_all
            }).toString();
            const response = await api.get(`students/pending_fees/?${queryParams}`);
            setPendingFees(response.data);
        } catch (error) {
            console.error("Error fetching pending fees:", error);
        }
    };

    const exportToExcel = () => {
        // Simple CSV export
        const headers = ['Student ID', 'Name', 'Class', 'Total Due', 'Paid', 'Pending Amount'];
        const rows = pendingFees.map(s => [s.student_id, s.name, s.student_class, s.total_due, s.total_paid, s.pending_amount]);

        let csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `student_fees_${filters.session}_${filters.student_class || 'all'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-semibold">Dashboard</h2>
                <div className="flex gap-4 bg-white p-3 rounded-lg shadow-sm">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Session</label>
                        <select
                            className="bg-transparent border-none focus:ring-0 text-sm font-semibold"
                            value={filters.session}
                            onChange={(e) => setFilters({ ...filters, session: e.target.value })}
                        >
                            <option value="2024-25">2024-25</option>
                            <option value="2025-26">2025-26</option>
                            <option value="2026-27">2026-27</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Class</label>
                        <select
                            className="bg-transparent border-none focus:ring-0 text-sm font-semibold"
                            value={filters.student_class}
                            onChange={(e) => setFilters({ ...filters, student_class: e.target.value })}
                        >
                            <option value="">All Classes</option>
                            {classOptions.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">Installment</label>
                        <select
                            className="bg-transparent border-none focus:ring-0 text-sm font-semibold"
                            value={filters.installment}
                            onChange={(e) => setFilters({ ...filters, installment: e.target.value })}
                        >
                            <option value="">All</option>
                            {Array.from({ length: globalSettings.installment_count }, (_, i) => i + 1).map(num => (
                                <option key={num} value={num}>Inst. {num}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase">As of Date</label>
                        <input
                            type="date"
                            className="bg-transparent border-none focus:ring-0 text-sm font-semibold"
                            value={filters.date}
                            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Students</h3>
                    <p className="text-2xl mt-2 text-gray-800 font-bold">{stats.total_students}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-indigo-500">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active</h3>
                    <p className="text-2xl mt-2 text-indigo-600 font-bold">{stats.active_students}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-orange-500">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Withdrawals (TC)</h3>
                    <p className="text-2xl mt-2 text-orange-600 font-bold">{stats.tc_students}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Collected</h3>
                    <p className="text-2xl mt-2 text-green-600 font-bold font-mono">₹{stats.total_collected.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Pending</h3>
                    <p className="text-2xl mt-2 text-red-600 font-bold font-mono">₹{stats.total_pending.toLocaleString()}</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800">Student Fees Detail</h3>
                        <p className="text-gray-500 text-sm mt-1 font-medium">Session-wise fee breakdown and collection status</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <label className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-100"
                                checked={filters.show_all}
                                onChange={(e) => setFilters({ ...filters, show_all: e.target.checked })}
                            />
                            <span className="text-xs font-black text-gray-500 uppercase tracking-tighter">Show All Students</span>
                        </label>
                        <button
                            onClick={exportToExcel}
                            className="bg-black text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 shadow-xl shadow-gray-200 transition"
                        >
                            Export to Excel
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                            <tr className="bg-gray-50 bg-opacity-50">
                                <th className="px-6 py-5 text-left text-xs font-black text-gray-600 uppercase tracking-widest">Student</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-gray-600 uppercase tracking-widest">Class</th>
                                {filters.installment ? (
                                    <>
                                        {/* Dynamic headers for fee heads if installment selected */}
                                        {pendingFees.length > 0 && Object.keys(pendingFees[0].installment_data[filters.installment]?.heads || {}).map(head => (
                                            <th key={head} className="px-6 py-5 text-right text-xs font-black text-gray-600 uppercase tracking-widest">{head}</th>
                                        ))}
                                        {/* Added Totals for Installment */}
                                        <th className="px-6 py-5 text-right text-xs font-black text-gray-600 uppercase tracking-widest bg-gray-100">Total Due</th>
                                        <th className="px-6 py-5 text-right text-xs font-black text-gray-600 uppercase tracking-widest bg-gray-100">Total Paid</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-5 text-right text-xs font-black text-gray-600 uppercase tracking-widest">Total Due</th>
                                        <th className="px-6 py-5 text-right text-xs font-black text-gray-600 uppercase tracking-widest">Total Paid</th>
                                        <th className="px-6 py-5 text-right text-xs font-black text-gray-600 uppercase tracking-widest">Pending</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-50">
                            {pendingFees.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400 font-medium italic">No students found for this selection.</td>
                                </tr>
                            ) : (
                                pendingFees.map((s) => (
                                    <tr key={s.id} className="hover:bg-gray-50 transition group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-sm font-bold text-gray-800">{s.name}</p>
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">#{s.student_id}</p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-xs font-black bg-gray-100 text-gray-600 px-2 py-1 rounded-lg uppercase">{s.student_class}</span>
                                        </td>
                                        {filters.installment ? (
                                            <>
                                                {Object.keys(pendingFees[0].installment_data[filters.installment]?.heads || {}).map(head => {
                                                    const details = s.installment_data[filters.installment]?.heads[head] || { due: 0, paid: 0, pending: 0 };
                                                    return (
                                                        <td key={head} className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="text-xs font-bold">
                                                                <span className="text-gray-500">D: ₹{details.due.toFixed(0)}</span>
                                                                <span className="text-green-700 ml-2">P: ₹{details.paid.toFixed(0)}</span>
                                                            </div>
                                                            {details.pending > 0 && <p className="text-xs font-black text-red-600 mt-1">Pending: ₹{details.pending.toFixed(0)}</p>}
                                                        </td>
                                                    )
                                                })}
                                                {/* Calculate and Show Totals */}
                                                {(() => {
                                                    const instData = s.installment_data[filters.installment];
                                                    const totalInstDue = instData ? Object.values(instData.heads).reduce((acc, h) => acc + h.due, 0) : 0;
                                                    const totalInstPaid = instData ? Object.values(instData.heads).reduce((acc, h) => acc + h.paid, 0) : 0;
                                                    return (
                                                        <>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right bg-gray-50">
                                                                <span className="text-sm font-bold text-gray-800">₹{totalInstDue.toFixed(0)}</span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right bg-gray-50">
                                                                <span className="text-sm font-bold text-green-600">₹{totalInstPaid.toFixed(0)}</span>
                                                            </td>
                                                        </>
                                                    );
                                                })()}
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right font-medium">₹{s.total_due.toLocaleString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-medium">₹{s.total_paid.toLocaleString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right font-bold">₹{s.pending_amount.toLocaleString()}</td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
