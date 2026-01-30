import { useState, useEffect } from 'react';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

function Ledger() {
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [ledgerData, setLedgerData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (searchTerm.length >= 2) {
            fetchStudents();
        } else {
            setStudents([]);
        }
    }, [searchTerm]);

    const fetchStudents = async () => {
        try {
            const response = await api.get(`students/?search=${searchTerm}`);
            setStudents(response.data);
        } catch (error) {
            console.error("Error fetching students:", error);
        }
    };

    const fetchLedger = async (student) => {
        setLoading(true);
        setSelectedStudent(student);
        setStudents([]);
        setSearchTerm('');
        try {
            const response = await api.get(`students/${student.id}/ledger/`);
            setLedgerData(response.data);
        } catch (error) {
            console.error("Error fetching ledger:", error);
            alert("Failed to fetch ledger");
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (!selectedStudent) return;

        const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
        const rows = ledgerData.map(e => [e.date, e.description, e.debit, e.credit, e.balance]);

        let csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ledger_${selectedStudent.student_id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4">
            <h2 className="text-3xl font-semibold mb-6">Student Ledger</h2>

            <div className="bg-white p-6 rounded-xl shadow-sm mb-8 relative">
                <label className="block text-sm font-bold text-gray-700 mb-2">Search Student (Name or ID)</label>
                <input
                    type="text"
                    className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Search to generate ledger..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                {students.length > 0 && (
                    <div className="absolute left-6 right-6 top-full mt-1 bg-white border rounded-lg shadow-xl z-10 max-h-60 overflow-y-auto">
                        {students.map(s => (
                            <button
                                key={s.id}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-0 flex justify-between items-center"
                                onClick={() => fetchLedger(s)}
                            >
                                <div>
                                    <p className="font-bold text-gray-800">{s.name}</p>
                                    <p className="text-xs text-gray-500">{s.student_id} | {s.student_class}</p>
                                </div>
                                <span className="text-blue-600 text-xs font-bold uppercase tracking-widest">Select</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedStudent && (
                <div className="bg-white p-6 rounded-xl shadow-sm">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <div>
                            <h3 className="text-2xl font-bold text-blue-800">{selectedStudent.name}</h3>
                            <p className="text-gray-500">
                                <span className="font-semibold">ID:</span> {selectedStudent.student_id} |
                                <span className="ml-2 font-semibold">Class:</span> {selectedStudent.student_class}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={exportToExcel}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
                            >
                                Export to Excel
                            </button>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <LoadingSpinner message="Analyzing ledger entries..." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Inst.</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Debit (Fee)</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Credit (Paid)</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {ledgerData.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-gray-400">No transactions found for this student.</td>
                                        </tr>
                                    ) : (
                                        ledgerData.map((e, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{e.date}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{e.description}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{e.installment || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 font-semibold">{e.debit > 0 ? `₹${e.debit.toLocaleString()}` : '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-bold">{e.credit > 0 ? `₹${e.credit.toLocaleString()}` : '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-800">₹{e.balance.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Ledger;
