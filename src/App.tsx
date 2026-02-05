import { Navigate, Route, Routes } from 'react-router-dom'
import NotepadPage from './pages/NotepadPage'
import ReferralTablePage from './pages/ReferralTablePage'
import ReportsPage from './pages/ReportsPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import SetPasswordPage from './pages/SetPasswordPage'
import TableSettingsPage from './pages/TableSettingsPage'
import { useAccess } from './lib/AccessProvider'
import { canAdmin } from './lib/permissions'

function AdminRoute({ children }: { children: JSX.Element }) {
  const { access, loading } = useAccess()
  if (loading) return null
  return canAdmin(access?.role) ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/" element={<ReferralTablePage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/notepad" element={<NotepadPage />} />
      <Route
        path="/table-settings"
        element={
          <AdminRoute>
            <TableSettingsPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
