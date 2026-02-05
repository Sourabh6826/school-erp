import { useState, useEffect } from 'react';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

function Reconciliation() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [matching, setMatching] = useState(false);
    const [error, setError] = useState(null);
    const [file, setFile] = useState(null);

    useEffect(() => {
        fetchEntries();
    }, []);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const response = await api.get('/fees/reconciliation/');
            setEntries(response.data);
            setError(null);
        } catch (err) {
            setError('Failed to fetch bank entries');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.post('/fees/reconciliation/upload_statement/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setFile(null);
            fetchEntries();
            alert('Statement uploaded successfully!');
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleAutoMatch = async () => {
        setMatching(true);
        try {
            const response = await api.post('/fees/reconciliation/auto_match/');
            alert(response.data.message);
            fetchEntries();
        } catch (err) {
            alert('Auto-matching failed');
        } finally {
            setMatching(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Bank Reconciliation</h2>
                    <p className="text-gray-500 mt-1">Match bank statement credits with ERP transactions</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleAutoMatch}
                        disabled={matching || loading}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {matching ? 'Matching...' : '⚡ Auto-Match All'}
                    </button>
                </div>
            </div>

            {/* Upload Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Upload Bank Statement (CSV)</h3>
                <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-4">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    <button
                        type="submit"
                        disabled={!file || uploading}
                        className="px-6 py-2 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 disabled:opacity-50 transition-all"
                    >
                        {uploading ? 'Uploading...' : 'Upload & Sync'}
                    </button>
                    <p className="text-[11px] text-gray-400">Supported columns: Date, Description, Amount, Reference</p>
                </form>
            </div>

            {/* Entries Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative min-h-[400px]">
                {loading && <LoadingSpinner message="Fetching bank records..." />}

                <table className={`min-w-full divide-y divide-gray-100 ${loading ? 'opacity-20' : 'opacity-100'}`}>
                    <thead className="bg-gray-50">
                        <tr className="text-left text-[12px] font-black text-gray-600 uppercase tracking-widest">
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Matched ERP Transaction</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {entries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    {entry.is_reconciled ? (
                                        <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black rounded-full uppercase">Matched</span>
                                    ) : (
                                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-black rounded-full uppercase">Unmatched</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700 font-medium">{entry.date}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={entry.description}>
                                    {entry.description}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-gray-800">₹{entry.amount}</td>
                                <td className="px-6 py-4">
                                    {entry.is_reconciled ? (
                                        <div className="flex items-center justify-between gap-2">
                                            {entry.matched_transaction ? (
                                                <div className="text-xs">
                                                    <p className="font-bold text-blue-600">{entry.matched_transaction_details?.student_name}</p>
                                                    <p className="text-gray-400">Tx Date: {entry.matched_transaction_details?.date}</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 font-bold uppercase">Manually Verified</span>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm('Are you sure you want to unreconcile this entry?')) return;
                                                    try {
                                                        await api.post(`/fees/reconciliation/${entry.id}/unreconcile/`);
                                                        fetchEntries();
                                                    } catch (e) { alert('Failed to unreconcile'); }
                                                }}
                                                className="text-red-500 hover:text-red-700 text-xs font-bold underline px-2"
                                            >
                                                Unreconcile
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-gray-300 italic text-xs">No match found</span>
                                            <button
                                                onClick={async () => {
                                                    // Manual Reconcile (Mark verified)
                                                    if (!window.confirm('Mark this entry as reconciled manually?')) return;
                                                    try {
                                                        await api.post(`/fees/reconciliation/${entry.id}/reconcile_manual/`, {});
                                                        fetchEntries();
                                                    } catch (e) { alert('Failed to mark as reconciled'); }
                                                }}
                                                className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition"
                                            >
                                                Mark Reconciled
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!loading && entries.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-gray-400">No bank entries found. Please upload a statement.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Reconciliation;
