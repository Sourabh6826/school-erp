import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Fees from './pages/Fees';
import Ledger from './pages/Ledger';


function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-md">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-blue-600">Fees ERP</h1>
          </div>
          <nav className="mt-6">
            <Link to="/" className="block px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600">Dashboard</Link>
            <Link to="/students" className="block px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600">Students</Link>
            <Link to="/fees" className="block px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600">Fees</Link>
            <Link to="/ledger" className="block px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600">Ledger</Link>

          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/fees" element={<Fees />} />
            <Route path="/ledger" element={<Ledger />} />

          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
