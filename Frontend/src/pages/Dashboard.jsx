function Dashboard() {
    return (
        <div>
            <h2 className="text-3xl font-semibold mb-6">Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold text-gray-700">Total Students</h3>
                    <p className="text-4xl mt-4 text-blue-500 font-bold">1,245</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold text-gray-700">Fees Collected</h3>
                    <p className="text-4xl mt-4 text-green-500 font-bold">$45,000</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold text-gray-700">Low Stock Items</h3>
                    <p className="text-4xl mt-4 text-red-500 font-bold">12</p>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
