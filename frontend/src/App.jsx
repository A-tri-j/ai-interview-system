import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import CompanyLayout from './layouts/CompanyLayout'
import PublicLayout from './layouts/PublicLayout'
import Apply from './pages/Apply'
import CandidateDashboard from './pages/candidate/CandidateDashboard'
import CompanyApplicationDetail from './pages/company/CompanyApplicationDetail'
import CompanyApplications from './pages/company/CompanyApplications'
import CompanyLogin from './pages/company/CompanyLogin'
import CompanyOverview from './pages/company/CompanyOverview'
import CompanyRegister from './pages/company/CompanyRegister'
import CompanyVacancies from './pages/company/CompanyVacancies'
import CompanyVerify from './pages/company/CompanyVerify'
import VacancyForm from './pages/company/VacancyForm'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import JobDetail from './pages/JobDetail'
import Jobs from './pages/Jobs'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'

// Interview, report, admin route porer part-e ashbe
export default function App() {
  return (
    <Routes>
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
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
