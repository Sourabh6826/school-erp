function Fees() {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-semibold">Fees Management</h2>
                <div className="space-x-2">
                    <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Record Payment</button>
                    <button className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Manage Fee Heads</button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h3 className="text-xl font-bold mb-4">Fee Heads</h3>
                <div className="flex gap-4">
                    <div className="p-4 bg-gray-50 border rounded w-1/4">
                        <p className="font-bold">Tuition Fee</p>
                        <p className="text-sm text-gray-500">Monthly</p>
                    </div>
                    <div className="p-4 bg-gray-50 border rounded w-1/4">
                        <p className="font-bold">Transport Fee</p>
                        <p className="text-sm text-gray-500">Monthly</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Fees;
