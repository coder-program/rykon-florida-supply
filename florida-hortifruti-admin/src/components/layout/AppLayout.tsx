import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const { usuario } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
