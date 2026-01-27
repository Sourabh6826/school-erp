import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Fees from './pages/Fees';
import Ledger from './pages/Ledger';

function AppContent() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="flex h-screen bg-gray-100">
                {/* Sidebar */}
                <aside className="w-64 bg-white shadow-md flex flex-col">
                  <div className="p-6">
                    <h1 className="text-2xl font-bold text-blue-600">Fees ERP</h1>
                  </div>

                  <nav className="mt-6 flex-1">
                    <Link to="/" className="block px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600">Dashboard</Link>
                    <Link to="/students" className="block px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600">Students</Link>
                    <Link to="/fees" className="block px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600">Fees</Link>
                    <Link to="/ledger" className="block px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600">Ledger</Link>
                  </nav>

                  {/* User Info & Logout */}
                  <div className="border-t border-gray-200 p-4">
                    <div className="flex items-center mb-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {user?.username?.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-semibold text-gray-700">{user?.username}</p>
                        <p className="text-xs text-gray-500">{user?.is_staff ? 'Administrator' : 'User'}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                    >
                      Logout
                    </button>
                  </div>
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
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
