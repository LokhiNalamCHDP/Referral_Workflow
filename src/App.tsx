import { Navigate, Route, Routes } from 'react-router-dom'
import NotepadPage from './pages/NotepadPage'
import ReferralTablePage from './pages/ReferralTablePage'
import ReportsPage from './pages/ReportsPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import SetPasswordPage from './pages/SetPasswordPage'

export default function App() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/" element={<ReferralTablePage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/notepad" element={<NotepadPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
