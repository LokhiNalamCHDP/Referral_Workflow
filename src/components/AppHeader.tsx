import { useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'
import { useSupabaseAuth } from '../lib/useSupabaseAuth'

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
  const navigate = useNavigate()
  const { session, signOut } = useSupabaseAuth()

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex items-center justify-between gap-3 px-4 py-4">
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNavOpen((v) => !v)}
            aria-label="Open menu"
            className="rounded-md border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
          >
            <div className="grid gap-1">
              <span className="block h-0.5 w-5 bg-slate-700" />
              <span className="block h-0.5 w-5 bg-slate-700" />
              <span className="block h-0.5 w-5 bg-slate-700" />
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
            </div>
          ) : null}

          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {right ? right : null}
          {session ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              Logout
            </button>
          ) : null}
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
