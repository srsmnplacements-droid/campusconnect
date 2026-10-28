import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { RequireAuth, RequireRole } from './components/Guards'
import Home from './pages/Home'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import StudentDashboard from './pages/StudentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import StudentsPage from './pages/StudentsPage'
import ImportStudents from './pages/ImportStudents'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
        <Route path="/student" element={<RequireRole role="student"><StudentDashboard /></RequireRole>} />
        <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
        <Route path="/admin/students" element={<RequireRole role="admin"><StudentsPage /></RequireRole>} />
        <Route path="/admin/students/import" element={<RequireRole role="admin"><ImportStudents /></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
