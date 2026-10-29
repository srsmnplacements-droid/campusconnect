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
import ContentAdmin from './pages/ContentAdmin'
import StudentContent from './pages/StudentContent'
import ResumePage from './pages/ResumePage'
import EventsAdmin from './pages/EventsAdmin'
import EventParticipants from './pages/EventParticipants'
import StudentEvents from './pages/StudentEvents'
import CompaniesAdmin from './pages/CompaniesAdmin'
import DrivesAdmin from './pages/DrivesAdmin'
import DriveApplicants from './pages/DriveApplicants'
import StudentDrives from './pages/StudentDrives'

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
        <Route path="/admin/notices" element={<RequireRole role="admin"><ContentAdmin key="notices" kind="notices" /></RequireRole>} />
        <Route path="/admin/resources" element={<RequireRole role="admin"><ContentAdmin key="resources" kind="placement_resources" /></RequireRole>} />
        <Route path="/student/notices" element={<RequireRole role="student"><StudentContent key="notices" kind="notices" /></RequireRole>} />
        <Route path="/student/resources" element={<RequireRole role="student"><StudentContent key="resources" kind="placement_resources" /></RequireRole>} />
        <Route path="/student/resume" element={<RequireRole role="student"><ResumePage /></RequireRole>} />
        <Route path="/admin/events" element={<RequireRole role="admin"><EventsAdmin /></RequireRole>} />
        <Route path="/admin/events/:id" element={<RequireRole role="admin"><EventParticipants /></RequireRole>} />
        <Route path="/student/events" element={<RequireRole role="student"><StudentEvents /></RequireRole>} />
        <Route path="/admin/companies" element={<RequireRole role="admin"><CompaniesAdmin /></RequireRole>} />
        <Route path="/admin/drives" element={<RequireRole role="admin"><DrivesAdmin /></RequireRole>} />
        <Route path="/admin/drives/:id" element={<RequireRole role="admin"><DriveApplicants /></RequireRole>} />
        <Route path="/student/drives" element={<RequireRole role="student"><StudentDrives /></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
