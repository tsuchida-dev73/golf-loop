'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const FOREST = '#1C4230'
const MUTED = '#9BA090'

function IconHome({ active }: { active: boolean }) {
  const c = active ? FOREST : MUTED
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3L21 9.5V20C21 20.6 20.6 21 20 21H15V15.5H9V21H4C3.4 21 3 20.6 3 20V9.5Z" fill={active ? `${FOREST}18` : 'none'} />
      <path d="M3 9.5L12 3L21 9.5V20C21 20.6 20.6 21 20 21H15V15.5H9V21H4C3.4 21 3 20.6 3 20V9.5Z" />
    </svg>
  )
}

function IconLog({ active }: { active: boolean }) {
  const c = active ? FOREST : MUTED
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" fill={active ? `${FOREST}18` : 'none'} />
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="12" y2="17" />
    </svg>
  )
}

function IconSwing({ active }: { active: boolean }) {
  const c = active ? FOREST : MUTED
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4.5" r="2" fill={active ? `${FOREST}30` : 'none'} />
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 6.5L10 12L12 19" />
      <path d="M10 9L6 13" />
      <path d="M13 8.5L18 6" />
    </svg>
  )
}

function IconFlag({ active }: { active: boolean }) {
  const c = active ? FOREST : MUTED
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="3" x2="7" y2="21" />
      <path d="M7 4L18 7.5L7 11V4Z" fill={active ? `${FOREST}30` : 'none'} />
      <path d="M7 4L18 7.5L7 11V4Z" />
    </svg>
  )
}

function IconChart({ active }: { active: boolean }) {
  const c = active ? FOREST : MUTED
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" rx="1" fill={active ? `${FOREST}30` : 'none'} />
      <rect x="10" y="7" width="4" height="14" rx="1" fill={active ? `${FOREST}30` : 'none'} />
      <rect x="17" y="3" width="4" height="18" rx="1" fill={active ? `${FOREST}30` : 'none'} />
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  )
}

const navItems = [
  { href: '/', label: 'ホーム', Icon: IconHome },
  { href: '/practice', label: '練習ログ', Icon: IconLog },
  { href: '/swing', label: 'スイング', Icon: IconSwing },
  { href: '/round-plan', label: 'ラウンド準備', Icon: IconFlag },
  { href: '/analysis', label: 'スコア分析', Icon: IconChart },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '480px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E8DFCE',
        display: 'flex',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map(({ href, label, Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: '10px',
              paddingBottom: '10px',
              gap: '3px',
              textDecoration: 'none',
              color: active ? FOREST : MUTED,
              fontSize: '10px',
              fontWeight: active ? 500 : 400,
              letterSpacing: '0.01em',
            }}
          >
            <Icon active={active} />
            <span style={{ lineHeight: 1 }}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
