import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { useSupabaseAuth } from '../lib/useSupabaseAuth'
import { useAccess } from '../lib/AccessProvider'
import { canAdmin } from '../lib/permissions'
import convergenceLogo from '../assets/images/convergence-white.svg'

export default function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const navMenuRef = useRef<HTMLDivElement | null>(null)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const { session, signOut } = useSupabaseAuth()

  const { access } = useAccess()
  const isAdmin = useMemo(() => canAdmin(access?.role), [access?.role])

  if (!session) {
    return (
      <header className="border-b bg-gray-900 text-white">
        <div className="mx-auto flex items-center justify-center px-4 py-4">
          <img src={convergenceLogo} alt="Convergence" className="h-8 w-auto" />
        </div>
      </header>
    )
  }

  const rawName =
    typeof (session.user as any)?.user_metadata?.full_name === 'string'
      ? String((session.user as any).user_metadata.full_name).trim()
      : ''
  const displayName = rawName || (session.user.email ?? 'User')
  const initials = displayName
    .split(/\s+/)
    .filter((p) => p)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  const closeUserMenu = () => setIsUserMenuOpen(false)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!isUserMenuOpen) return
      const el = userMenuRef.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      setIsUserMenuOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isUserMenuOpen])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!isNavOpen) return
      const el = navMenuRef.current
      if (!el) return
      if (e.target instanceof Node && el.contains(e.target)) return
      setIsNavOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isNavOpen])

  return (
    <header className="border-b bg-gray-900 text-white">
      <div className="mx-auto flex items-center justify-between gap-3 px-4 py-4">
        <div className="relative flex items-center gap-2">
          <div className="relative" ref={navMenuRef}>
            <button
              type="button"
              onClick={() => setIsNavOpen((v) => !v)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
            >
              <div className="grid gap-1">
                <span className="block h-0.5 w-5 bg-white" />
                <span className="block h-0.5 w-5 bg-white" />
                <span className="block h-0.5 w-5 bg-white" />
              </div>
            </button>

            {isNavOpen ? (
              <div className="absolute left-0 top-12 z-50 w-64 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                <NavItem
                  onClick={() => {
                    setIsNavOpen(false)
                    navigate('/')
                  }}
                >
                  Referral tracker spreadsheet
                </NavItem>
                <NavItem
                  onClick={() => {
                    setIsNavOpen(false)
                    navigate('/referral-provider-updates')
                  }}
                >
                  Referral provider updates
                </NavItem>
                <NavItem
                  onClick={() => {
                    setIsNavOpen(false)
                    navigate('/reports')
                  }}
                >
                  Reports
                </NavItem>
                <NavItem
                  onClick={() => {
                    setIsNavOpen(false)
                    navigate('/notepad')
                  }}
                >
                  Notepad
                </NavItem>
                {isAdmin ? (
                  <NavItem
                    onClick={() => {
                      setIsNavOpen(false)
                      navigate('/table-settings')
                    }}
                  >
                    Table settings
                  </NavItem>
                ) : null}
                {isAdmin ? (
                  <NavItem
                    onClick={() => {
                      setIsNavOpen(false)
                      navigate('/user-management')
                    }}
                  >
                    User management
                  </NavItem>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Go to referral tracker"
            className="flex h-9 items-center justify-center rounded-md px-1"
          >
            <img src={convergenceLogo} alt="Convergence" className="h-7 w-auto" />
          </button>

          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle ? <p className="text-sm text-white/70">{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {right ? right : null}
          <div className="relative" ref={userMenuRef} data-user-menu-root>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((v) => !v)}
              aria-label="User menu"
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <div className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
                {initials || 'U'}
              </div>
              <div className="max-w-[220px] truncate">{displayName}</div>
            </button>

            {isUserMenuOpen ? (
              <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    closeUserMenu()
                    navigate('/set-password')
                  }}
                  className={clsx(
                    'block w-full px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50',
                  )}
                >
                  Change password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeUserMenu()
                    void signOut()
                  }}
                  className={clsx(
                    'block w-full px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50',
                  )}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

function NavItem({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'block w-full px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  )
}
