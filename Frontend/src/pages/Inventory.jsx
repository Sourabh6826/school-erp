import { useState, useEffect } from 'react';
import api from '../api';

function Inventory() {
    const [items, setItems] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', category: 'OTHER', quantity: 0, reorder_level: 10 });

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const response = await api.get('inventory/items/');
            setItems(response.data);
        } catch (error) {
            console.error("Error fetching inventory:", error);
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            await api.post('inventory/items/', newItem);
            setShowModal(false);
            setNewItem({ name: '', category: 'OTHER', quantity: 0, reorder_level: 10 });
            fetchItems(); // Refresh list
        } catch (error) {
            console.error("Error adding item:", error);
            alert("Failed to add item");
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-semibold">Inventory</h2>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                >
                    Add Item
                </button>
            </div>

            {/* Inventory Table */}
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
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-4 text-center text-gray-500">No items found. Add one!</td>
                            </tr>
                        ) : (
                            items.map((item) => (
                                <tr key={item.id}>
                                    <td className="px-6 py-4">{item.name}</td>
                                    <td className="px-6 py-4">{item.category}</td>
                                    <td className="px-6 py-4">{item.quantity}</td>
                                    <td className={`px-6 py-4 font-semibold ${item.quantity <= item.reorder_level ? 'text-red-600' : 'text-green-600'}`}>
                                        {item.quantity <= item.reorder_level ? 'Low Stock' : 'In Stock'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Item Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                        <h3 className="text-xl font-bold mb-4">Add New Item</h3>
                        <form onSubmit={handleAddItem}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Item Name</label>
                                <input
                                    type="text"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={newItem.name}
                                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Category</label>
                                <select
                                    className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={newItem.category}
                                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                >
                                    <option value="STATIONERY">Stationery</option>
                                    <option value="FURNITURE">Furniture</option>
                                    <option value="ELECTRONICS">Electronics</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2">Quantity</label>
                                <input
                                    type="number"
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    value={newItem.quantity}
                                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
                                    required
                                />
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Inventory;
