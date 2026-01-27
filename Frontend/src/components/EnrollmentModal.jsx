import { useState, useEffect } from 'react';
import api from '../api';

function EnrollmentModal({ student, session, onClose, onSave }) {
    const [feeHeads, setFeeHeads] = useState([]);
    const [enrollments, setEnrollments] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [installmentCount, setInstallmentCount] = useState(4);

    useEffect(() => {
        if (student && session) {
            fetchData();
        }
    }, [student, session]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch fee heads for session
            const headsResponse = await api.get(`fees/fee-heads/?session=${session}`);
            setFeeHeads(headsResponse.data);

            // Fetch global settings for installment count
            try {
                const settingsResponse = await api.get(`fees/settings/${session}/`);
                setInstallmentCount(settingsResponse.data.installment_count);
            } catch (err) {
                setInstallmentCount(4); // Default
            }

            // Fetch existing enrollments
            const enrollResponse = await api.get(`students/${student.id}/get_enrollments/?session=${session}`);

            // Convert enrollment array to object structure
            const enrollMap = {};
            enrollResponse.data.forEach(enroll => {
                if (!enrollMap[enroll.fee_head]) {
                    enrollMap[enroll.fee_head] = {};
                }
                enrollMap[enroll.fee_head][enroll.installment_number] = enroll.is_enrolled;
            });

            setEnrollments(enrollMap);
        } catch (error) {
            console.error('Error fetching enrollment data:', error);
        } finally {
            setLoading(false);
        }
    };

    const isEnrolled = (feeHeadId, installmentNum) => {
        // Default is enrolled (true) if no record exists
        if (!enrollments[feeHeadId]) return true;
        if (enrollments[feeHeadId][installmentNum] === undefined) return true;
        return enrollments[feeHeadId][installmentNum];
    };

    const toggleEnrollment = (feeHeadId, installmentNum) => {
        setEnrollments(prev => {
            const newEnrollments = { ...prev };
            if (!newEnrollments[feeHeadId]) {
                newEnrollments[feeHeadId] = {};
            }
            const currentValue = isEnrolled(feeHeadId, installmentNum);
            newEnrollments[feeHeadId][installmentNum] = !currentValue;
            return newEnrollments;
        });
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            // Save enrollments for each fee head
            for (const feeHead of feeHeads) {
                const feeHeadEnrollments = {};
                for (let i = 1; i <= installmentCount; i++) {
                    feeHeadEnrollments[i] = isEnrolled(feeHead.id, i);
                }

                await api.post(`students/${student.id}/manage_enrollment/`, {
                    fee_head_id: feeHead.id,
                    session: session,
                    enrollments: feeHeadEnrollments
                });
            }

            if (onSave) onSave();
            onClose();
        } catch (error) {
            console.error('Error saving enrollments:', error);
            alert('Failed to save enrollments. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!student) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                    <h2 className="text-2xl font-bold">Manage Fee Enrollment</h2>
                    <p className="text-blue-100 mt-1">
                        {student.name} (#{student.student_id}) - Session {session}
                    </p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {feeHeads.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No fee heads found for this session.</p>
                            ) : (
                                feeHeads.map(head => (
                                    <div key={head.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition">
                                        <h3 className="font-bold text-lg text-gray-800 mb-3">{head.name}</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {Array.from({ length: installmentCount }, (_, i) => i + 1).map(instNum => (
                                                <label
                                                    key={instNum}
                                                    className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition ${isEnrolled(head.id, instNum)
                                                            ? 'border-green-500 bg-green-50'
                                                            : 'border-red-300 bg-red-50'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isEnrolled(head.id, instNum)}
                                                        onChange={() => toggleEnrollment(head.id, instNum)}
                                                        className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
                                                    />
                                                    <span className="font-semibold text-sm">
                                                        Installment {instNum}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-6 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100 transition"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default EnrollmentModal;
