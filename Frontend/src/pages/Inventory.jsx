function Inventory() {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-semibold">Inventory</h2>
                <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Add Item</button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <th className="px-6 py-3">Item Name</th>
                            <th className="px-6 py-3">Category</th>
                            <th className="px-6 py-3">Quantity</th>
                            <th className="px-6 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                            <td className="px-6 py-4">Chalk Box</td>
                            <td className="px-6 py-4">Stationery</td>
                            <td className="px-6 py-4">50</td>
                            <td className="px-6 py-4 text-green-600">In Stock</td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4">Whiteboard</td>
                            <td className="px-6 py-4">Furniture</td>
                            <td className="px-6 py-4">2</td>
                            <td className="px-6 py-4 text-red-600">Low Stock</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Inventory;
