import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import CompanyLayout from './layouts/CompanyLayout'
import PublicLayout from './layouts/PublicLayout'
import Apply from './pages/Apply'
import AdminAudit from './pages/admin/AdminAudit'
import AdminCandidates from './pages/admin/AdminCandidates'
import AdminCompanies from './pages/admin/AdminCompanies'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminLogin from './pages/admin/AdminLogin'
import AdminPlaceholder from './pages/admin/AdminPlaceholder'
import AdminVacancies from './pages/admin/AdminVacancies'
import CandidateDashboard from './pages/candidate/CandidateDashboard'
import CompanyApplicationDetail from './pages/company/CompanyApplicationDetail'
import CompanyApplications from './pages/company/CompanyApplications'
import CompanyLogin from './pages/company/CompanyLogin'
import CompanyOverview from './pages/company/CompanyOverview'
import CompanyProfile from './pages/company/CompanyProfile'
import CompanyRegister from './pages/company/CompanyRegister'
import CompanyReport from './pages/company/CompanyReport'
import CompanyVacancies from './pages/company/CompanyVacancies'
import CompanyVerify from './pages/company/CompanyVerify'
import VacancyForm from './pages/company/VacancyForm'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import Interview from './pages/interview/Interview'
import InterviewEntry from './pages/interview/InterviewEntry'
import McqRound from './pages/interview/McqRound'
import JobDetail from './pages/JobDetail'
import Jobs from './pages/Jobs'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Recommend from './pages/recommend/Recommend'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'

// Admin route Part 6
export default function App() {
  return (
    <Routes>
      {/* Admin: alada layout, public header/footer nei */}
      <Route path="admin/login" element={<AdminLogin />} />
      <Route path="admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="companies" element={<AdminCompanies />} />
        <Route path="candidates" element={<AdminCandidates />} />
        <Route path="vacancies" element={<AdminVacancies />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="users" element={<AdminPlaceholder title="Users" />} />
        <Route path="reports" element={<AdminPlaceholder title="Reports" />} />
        <Route path="settings" element={<AdminPlaceholder title="Settings" />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="jobs/:id/apply" element={<ProtectedRoute role="candidate"><Apply /></ProtectedRoute>} />
        <Route path="register" element={<Register />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="dashboard" element={<ProtectedRoute role="candidate"><CandidateDashboard /></ProtectedRoute>} />
        <Route path="recommend" element={<ProtectedRoute role="candidate"><Recommend /></ProtectedRoute>} />

        <Route path="interview/start/:applicationId" element={<ProtectedRoute role="candidate"><Interview /></ProtectedRoute>} />
        <Route path="interview/:token" element={<ProtectedRoute role="candidate"><InterviewEntry /></ProtectedRoute>} />
        <Route path="round2/:applicationId" element={<ProtectedRoute role="candidate"><McqRound /></ProtectedRoute>} />

        <Route path="company/register" element={<CompanyRegister />} />
        <Route path="company/verify-email" element={<CompanyVerify />} />
        <Route path="company/login" element={<CompanyLogin />} />
        <Route path="company" element={<ProtectedRoute role="company"><CompanyLayout /></ProtectedRoute>}>
          <Route index element={<CompanyOverview />} />
          <Route path="vacancies" element={<CompanyVacancies />} />
          <Route path="vacancies/new" element={<VacancyForm />} />
          <Route path="vacancies/:id/edit" element={<VacancyForm />} />
          <Route path="applications" element={<CompanyApplications />} />
          <Route path="applications/:id" element={<CompanyApplicationDetail />} />
          <Route path="applications/:id/report" element={<CompanyReport />} />
          <Route path="profile" element={<CompanyProfile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
