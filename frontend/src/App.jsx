import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import DonorDashboard from './pages/DonorDashboard'
import RecipientPortal from './pages/RecipientPortal'
import VolunteerDashboard from './pages/VolunteerDashboard'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />

                    {/* Protected routes — role-gated */}
                    <Route path="/donor" element={
                        <ProtectedRoute allowedRoles={['donor']}>
                            <DonorDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="/recipient" element={
                        <ProtectedRoute allowedRoles={['recipient']}>
                            <RecipientPortal />
                        </ProtectedRoute>
                    } />
                    <Route path="/volunteer" element={
                        <ProtectedRoute allowedRoles={['volunteer']}>
                            <VolunteerDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    } />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}
