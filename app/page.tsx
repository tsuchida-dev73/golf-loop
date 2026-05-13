'use client'

import { useState, useEffect, startTransition } from 'react'
import Link from 'next/link'
import BottomNav from './components/BottomNav'

const FOREST       = '#1C4230'
const FOREST_MID   = '#235C3E'
const FOREST_LIGHT = '#3A7D57'
const TERRACOTTA   = '#C0522D'
const CREAM        = '#FAF8F0'
const SAND_LIGHT   = '#E8DFCE'
const CARD         = '#FFFFFF'
const INK          = '#1C1C1C'
const MUTED        = '#6B7060'

// ── Types (mirror storage schemas – do not modify) ──────────────────────────
type Category = 'driver' | 'iron' | 'approach' | 'putter'
type PracticeLog = {
  id: string; date: string; categories: Category[]
  theme: string; good: string; bad: string; insight: string; next: string; savedAt: string
}
type Par      = 3 | 4 | 5
type TeeShot  = 'FW' | '左' | '右' | 'OB' | '池' | null
type HoleData = { par: Par; score: number; putts: number; teeShot: TeeShot; memo: string }
type RoundLog = {
  id: string; date: string; courseName: string; weather: string
  targetScore: number; holes: HoleData[]; savedAt: string
}
type Strategy = {
  attack: string; teeShot: string; aroundGreen: string
  windAdjust: string; mental: string; oneWord: string
}
type RoundPlan = {
  id: string; date: string; courseName: string; startTime: string
  weather: string; windSpeed: string; temperature: string
  targetScore: number; cautions: string; recentIssues: string
  strategy: Strategy; savedAt: string
}
type BestShot = {
  id: string; date: string; courseName: string; hole: string; club: string
  shotType: string; memo: string; mood: string; savedAt: string
}

const PRACTICE_KEY  = 'golf-loop-practice-logs'
const ROUND_KEY     = 'golf-loop-round-logs'
const PLAN_KEY      = 'golf-loop-round-plans'
const LIVE_KEY      = 'golf-loop-live-round'
const BEST_SHOT_KEY = 'golf-loop-best-shots'

const CATEGORY_LABEL: Record<Category, string> = {
  driver: 'ドライバー', iron: 'アイアン', approach: 'アプローチ', putter: 'パター',
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function calcRoundStats(log: RoundLog) {
  const hs    = log.holes.slice(0, 18)
  const n     = Math.max(1, hs.length)
  const score = hs.reduce((s, h) => s + h.score, 0)
  const par   = hs.reduce((s, h) => s + h.par,   0)
  const putts = hs.reduce((s, h) => s + h.putts,  0)
  const fws   = hs.filter(h => h.teeShot === 'FW').length
  const obs   = hs.filter(h => h.teeShot === 'OB').length
  return { score, par, putts, fws, obs, fwPct: Math.round((fws / n) * 100), diff: score - par }
}

function deriveImprovementPoints(log: RoundLog): string[] {
  const hs     = log.holes.slice(0, 18)
  const points: string[] = []

  const obCount     = hs.filter(h => h.teeShot === 'OB').length
  if (obCount >= 1)  points.push(`OB ${obCount}回 — ティーショットの方向性を重点練習`)

  const threePutts  = hs.filter(h => h.putts >= 3).length
  if (threePutts >= 1) points.push(`3パット ${threePutts}回 — ロングパットの距離感向上`)

  const front9 = hs.slice(0, 9).reduce((s, h) => s + h.score - h.par, 0)
  const back9  = hs.slice(9 ).reduce((s, h) => s + h.score - h.par, 0)
  if (back9 - front9 >= 4) points.push(`後半が前半より +${back9 - front9} 打 — 後半の集中力維持`)

  const fwPct = Math.round((hs.filter(h => h.teeShot === 'FW').length / Math.max(1, hs.length)) * 100)
  if (points.length < 2 && fwPct < 50) points.push(`FW率 ${fwPct}% — フェアウェイキープを意識`)

  const putts = hs.reduce((s, h) => s + h.putts, 0)
  if (points.length < 2 && putts >= 36) points.push(`パット数 ${putts} — 距離感・ライン読みの精度向上`)

  if (points.length === 0) {
    const st = calcRoundStats(log)
    points.push(
      `スコア ${st.score}（${st.diff >= 0 ? '+' : ''}${st.diff}）`,
      `FW率 ${st.fwPct}% — 引き続き方向性を維持`,
      `パット数 ${st.putts} — 継続して磨きましょう`,
    )
  }
  return points.slice(0, 3)
}

function deriveTopPractice(log: RoundLog): { theme: string; drills: string[] } | null {
  const hs         = log.holes.slice(0, 18)
  const putts      = hs.reduce((s, h) => s + h.putts, 0)
  const threePutts = hs.filter(h => h.putts >= 3).length
  const obs        = hs.filter(h => h.teeShot === 'OB').length
  const rights     = hs.filter(h => h.teeShot === '右').length
  const lefts      = hs.filter(h => h.teeShot === '左').length
  const fws        = hs.filter(h => h.teeShot === 'FW').length
  const fwPct      = Math.round((fws / 18) * 100)
  const collapse   = hs.slice(9).reduce((s, h) => s + h.score - h.par, 0)
                   - hs.slice(0, 9).reduce((s, h) => s + h.score - h.par, 0)

  if (obs >= 2) {
    const dir = rights >= lefts ? '右' : '左'
    return { theme: `ドライバー${dir}ミス`,
      drills: ['アライメント確認・セットアップ 10分', 'ハーフスイングで方向性練習 20球', 'フェース管理ドリル 10球'] }
  }
  if (putts >= 37 || threePutts >= 4) {
    return { theme: 'パター距離感',
      drills: ['1mパット 20球', '5m距離感ドリル 10球', '10m距離感ドリル 10球'] }
  }
  if (collapse >= 5) {
    return { theme: '後半崩れ対策',
      drills: ['アプローチ30yd以内 20球', 'ルーティーン徹底練習（全球）', '疲労想定の力み対策'] }
  }
  if (rights >= 3) {
    return { theme: 'ドライバー右ミス傾向',
      drills: ['アライメント確認・セットアップ 10分', 'ハーフスイングで方向性練習 20球', 'フェース管理ドリル 10球'] }
  }
  if (lefts >= 3) {
    return { theme: 'ドライバー左ミス傾向',
      drills: ['アウトサイドイン矯正ドリル 10分', 'インサイドから振り出す練習 20球', 'フェース向き確認 10球'] }
  }
  if (fwPct < 40) {
    return { theme: 'フェアウェイキープ',
      drills: ['3WでFWキープ練習 15球', 'UTコントロール 10球', 'ドライバーは最後の5球のみ'] }
  }
  if (putts >= 34 || threePutts >= 2) {
    return { theme: 'パター精度',
      drills: ['ショートパット反復（1.5〜3m）20球', '5m距離感ドリル 10球', 'ルーティーン確認（全球）'] }
  }
  return null
}

function deriveNextRoundStrategy(log: RoundLog): { headline: string; body: string; isCritical: boolean } | null {
  const hs = log.holes.slice(0, 18)
  if (!hs.length) return null

  const obs    = hs.filter(h => h.teeShot === 'OB').length
  const fws    = hs.filter(h => h.teeShot === 'FW').length
  const fwPct  = Math.round((fws / Math.max(1, hs.length)) * 100)
  const putts  = hs.reduce((s, h) => s + h.putts, 0)
  const front9 = hs.slice(0, 9).reduce((s, h) => s + h.score - h.par, 0)
  const back9  = hs.slice(9).reduce((s, h) => s + h.score - h.par, 0)
  const collapse = back9 - front9

  if (obs >= 2)
    return { headline: 'ドライバー封印が最重要', body: `前回 OB ${obs}回。3W/UT戦略でフェアウェイキープを最優先に。`, isCritical: true }
  if (fwPct < 40)
    return { headline: '3W/UT戦略を採用', body: `FW率 ${fwPct}%。距離より方向性を優先してスコアアップを。`, isCritical: false }
  if (collapse >= 5)
    return { headline: '前半から抑えた戦略で', body: `前回後半 +${back9}（前半 +${front9}）崩れあり。体力・集中力を温存する前半戦略を。`, isCritical: false }
  if (putts >= 36)
    return { headline: 'パター改善が鍵', body: `前回 ${putts}パット。グリーン上での距離感向上でスコアアップ確実。`, isCritical: false }
  return null
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now    = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

function formatJpDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  const wd = ['日', '月', '火', '水', '木', '金', '土']
  return `${Number(m)}月${Number(d)}日（${wd[new Date(+y, +m - 1, +d).getDay()]}）`
}

// ── UI pieces ────────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.08)', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function CardHeader({ color, icon, label, sub }: { color: string; icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div style={{ backgroundColor: color, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }}>
        {label}
      </span>
      {sub && <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.55)', fontSize: '10px' }}>{sub}</span>}
    </div>
  )
}

function CardBody({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '16px' }}>{children}</div>
}

function NoDataLink({ text, href, color, actionLabel }: { text: string; href: string; color?: string; actionLabel?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: '13px', color: MUTED, marginBottom: '12px', lineHeight: 1.6 }}>{text}</div>
      <Link href={href} style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        fontSize: '13px', color: '#FFFFFF', fontWeight: 700, textDecoration: 'none',
        backgroundColor: color ?? FOREST, borderRadius: '8px', padding: '9px 18px',
      }}>
        {actionLabel ?? '記録する'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9,18 15,12 9,6" />
        </svg>
      </Link>
    </div>
  )
}

function QuickActionsBar() {
  const actions = [
    {
      href: '/practice', label: '練習',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ),
    },
    {
      href: '/round-live', label: 'ラウンド中',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TERRACOTTA} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.6 5.6a9.5 9.5 0 0 0 0 12.8" />
          <path d="M18.4 5.6a9.5 9.5 0 0 1 0 12.8" />
          <path d="M8.8 8.8a5 5 0 0 0 0 6.4" />
          <path d="M15.2 8.8a5 5 0 0 1 0 6.4" />
          <circle cx="12" cy="12" r="2" fill={TERRACOTTA} stroke="none" />
        </svg>
      ),
    },
    {
      href: '/round-plan', label: '準備',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FOREST_MID} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      href: '/analysis', label: '分析',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7A5800" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6"  y1="20" x2="6"  y2="14" />
        </svg>
      ),
    },
    {
      href: '/swing', label: 'スイング',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5050A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.95C18.88 4 12 4 12 4s-6.88 0-8.59.47A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
          <polygon points="9.75,15.02 15.5,12 9.75,8.98 9.75,15.02" />
        </svg>
      ),
    },
  ]
  return (
    <div style={{ display: 'flex', gap: '8px', padding: '14px 16px 0' }}>
      {actions.map(({ href, label, icon }) => (
        <Link key={href} href={href} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
          padding: '10px 4px 9px', backgroundColor: CARD, borderRadius: '12px',
          textDecoration: 'none', boxShadow: '0 1px 6px rgba(28,66,48,0.08)',
        }}>
          {icon}
          <span style={{ fontSize: '10px', color: INK, fontWeight: 600, letterSpacing: '0.01em' }}>{label}</span>
        </Link>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [mounted,      setMounted]      = useState(false)
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([])
  const [roundLogs,    setRoundLogs]    = useState<RoundLog[]>([])
  const [roundPlans,   setRoundPlans]   = useState<RoundPlan[]>([])
  const [liveRound,    setLiveRound]    = useState<{ score: number; holes: number } | null>(null)
  const [bestShots,    setBestShots]    = useState<BestShot[]>([])

  useEffect(() => {
    let practices: PracticeLog[] = []
    let rounds: RoundLog[]       = []
    let plans: RoundPlan[]       = []
    try {
      const p  = localStorage.getItem(PRACTICE_KEY)
      const r  = localStorage.getItem(ROUND_KEY)
      const pl = localStorage.getItem(PLAN_KEY)
      practices = p  ? JSON.parse(p)  : []
      rounds    = r  ? JSON.parse(r)  : []
      rounds.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
      plans     = pl ? JSON.parse(pl) : []
      const lv = localStorage.getItem(LIVE_KEY)
      if (lv) {
        const ld = JSON.parse(lv)
        const hs = Array.isArray(ld.holes) ? ld.holes : []
        const score = hs.reduce((s: number, h: { score: number }) => s + h.score, 0)
        const filled = hs.filter((h: { teeShot: string | null; putts: number }) =>
          h.teeShot !== null || h.putts !== 2
        ).length
        setLiveRound({ score, holes: filled })
      }
      const bs = localStorage.getItem(BEST_SHOT_KEY)
      if (bs) setBestShots(JSON.parse(bs))
    } catch {}
    startTransition(() => {
      setPracticeLogs(practices)
      setRoundLogs(rounds)
      setRoundPlans(plans)
      setMounted(true)
    })
  }, [])

  // derived data
  const latestPractice = practiceLogs[0] ?? null
  const latestRound    = roundLogs[0]    ?? null
  const latestPlan     = roundPlans[0]   ?? null

  const recentRounds  = roundLogs.slice(0, 3)
  const scoreList     = recentRounds.map(l => calcRoundStats(l).score)
  const displayScores = [...scoreList].reverse()   // oldest → newest for chart
  const avgScore      = scoreList.length ? scoreList.reduce((a, b) => a + b, 0) / scoreList.length : null
  const avgPutts      = recentRounds.length ? recentRounds.map(l => calcRoundStats(l).putts).reduce((a, b) => a + b, 0) / recentRounds.length : null
  const avgFwPct      = recentRounds.length ? Math.round(recentRounds.map(l => calcRoundStats(l).fwPct).reduce((a, b) => a + b, 0) / recentRounds.length) : null
  const scoreDiff     = scoreList.length >= 2 ? scoreList[0] - scoreList[1] : null  // negative = improved

  const topPractice       = latestRound ? deriveTopPractice(latestRound) : null
  const nextRoundStrategy = latestRound ? deriveNextRoundStrategy(latestRound) : null
  const latestShot        = bestShots[0] ?? null

  const improvPoints  = latestRound ? deriveImprovementPoints(latestRound) : [
    'バックスイングのテンポを落とす',
    '右膝の流れを抑制する',
    'インパクト後のフォロースルーを意識',
  ]

  // today label
  const today  = new Date()
  const WD     = ['日', '月', '火', '水', '木', '金', '土']
  const todayLabel = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日（${WD[today.getDay()]}）`

  // activity summary for header
  const daysSinceRound = latestRound
    ? Math.floor((today.getTime() - new Date(latestRound.savedAt).getTime()) / 86400000)
    : null
  const thisMonth = today.getMonth()
  const thisYear  = today.getFullYear()
  const practiceThisMonth = practiceLogs.filter(l => {
    const d = new Date(l.savedAt)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  }).length

  // bar chart helpers
  const getBarLabel = (i: number) => {
    const fromLatest = displayScores.length - 1 - i
    return fromLatest === 0 ? '前回' : `${fromLatest + 1}回前`
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', backgroundColor: CREAM }}>

      {/* Header */}
      <header style={{ backgroundColor: FOREST, padding: '52px 20px 22px' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: 700, margin: '0 0 5px', lineHeight: 1.15, letterSpacing: '0.12em', fontFamily: "Georgia, 'Times New Roman', serif" }}>
          GOLF LOOP
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 18px', letterSpacing: '0.04em' }}>
          練習・ラウンド・分析をつなぐ
        </p>

        {mounted && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '5px 14px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7ECB9E' }} />
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 500 }}>
                今月の練習 {practiceThisMonth}回
              </span>
            </div>
            {latestPractice?.theme && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '5px 14px', maxWidth: '170px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#A8E6C8', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {latestPractice.theme}
                </span>
              </div>
            )}
            {latestPlan && daysUntil(latestPlan.date) >= 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '5px 14px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F9C74F' }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 500 }}>
                  次回 {daysUntil(latestPlan.date)}日後
                </span>
              </div>
            )}
            {latestRound && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '5px 14px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#90C4F9' }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 500 }}>
                  前回 {calcRoundStats(latestRound).score}打
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      <QuickActionsBar />

      <main style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ラウンド中モード */}
        <Link href="/round-live" style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          backgroundColor: liveRound ? TERRACOTTA : CARD,
          borderRadius: '14px', padding: '16px 18px', textDecoration: 'none',
          boxShadow: liveRound
            ? `0 4px 18px ${TERRACOTTA}45`
            : '0 2px 12px rgba(28,66,48,0.08)',
          border: liveRound ? 'none' : `1.5px solid ${SAND_LIGHT}`,
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '13px', flexShrink: 0,
            backgroundColor: liveRound ? 'rgba(255,255,255,0.2)' : `${TERRACOTTA}12`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={liveRound ? '#fff' : TERRACOTTA}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.6 5.6a9.5 9.5 0 0 0 0 12.8" />
              <path d="M18.4 5.6a9.5 9.5 0 0 1 0 12.8" />
              <path d="M8.8 8.8a5 5 0 0 0 0 6.4" />
              <path d="M15.2 8.8a5 5 0 0 1 0 6.4" />
              <circle cx="12" cy="12" r="2" fill={liveRound ? '#fff' : TERRACOTTA} stroke="none" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: liveRound ? '#fff' : INK, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ラウンド中モード
              {liveRound && (
                <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '8px', padding: '2px 7px', color: '#fff', letterSpacing: '0.08em' }}>
                  LIVE
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: liveRound ? 'rgba(255,255,255,0.75)' : MUTED }}>
              {mounted && liveRound
                ? `進行中 — スコア ${liveRound.score}（${liveRound.holes}H 入力済）`
                : 'スマホ片手で素早くスコア入力'}
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={liveRound ? 'rgba(255,255,255,0.7)' : MUTED}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </Link>

        {/* ラウンド記録 */}
        <Link href="/round" style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          backgroundColor: CARD, borderRadius: '12px', padding: '14px 16px',
          textDecoration: 'none', boxShadow: '0 2px 12px rgba(28,66,48,0.08)',
        }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
            backgroundColor: `${FOREST_MID}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={FOREST_MID} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <line x1="8" y1="9" x2="16" y2="9" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="12" y2="17" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: INK, marginBottom: '2px' }}>ラウンド記録</div>
            <div style={{ fontSize: '12px', color: MUTED }}>終了後にスコアをまとめて入力</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </Link>

        {/* 番手別飛距離ショートカット */}
        <Link href="/club-distance" style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          backgroundColor: CARD, borderRadius: '12px', padding: '14px 16px',
          textDecoration: 'none', boxShadow: '0 2px 12px rgba(28,66,48,0.08)',
        }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
            backgroundColor: `${FOREST}0F`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="22" x2="19" y2="2" />
              <line x1="15" y1="22" x2="19" y2="22" />
              <line x1="19" y1="17" x2="19" y2="22" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: INK, marginBottom: '2px' }}>番手別飛距離</div>
            <div style={{ fontSize: '12px', color: MUTED }}>各クラブのキャリー・トータルを管理</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </Link>

        {/* ① 最新の練習テーマ ── golf-loop-practice-logs */}
        <Card>
          <CardHeader
            color={FOREST}
            label="最新の練習テーマ"
            sub={latestPractice ? formatJpDate(latestPractice.date) : undefined}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            }
          />
          <CardBody>
            {mounted && latestPractice ? (
              <>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: INK, lineHeight: 1.4, marginBottom: '6px' }}>
                    {latestPractice.theme || '（テーマ未記入）'}
                  </div>
                  {latestPractice.good && (
                    <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.65 }}>
                      ✓ {latestPractice.good.slice(0, 48)}
                    </div>
                  )}
                  {latestPractice.next && (
                    <div style={{ fontSize: '13px', color: FOREST_MID, lineHeight: 1.65, marginTop: '4px', fontWeight: 500 }}>
                      → 次回：{latestPractice.next.slice(0, 40)}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${SAND_LIGHT}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {latestPractice.categories.map(cat => (
                      <span key={cat} style={{ fontSize: '11px', color: FOREST_MID, backgroundColor: `${FOREST}0D`, borderRadius: '4px', padding: '3px 8px', fontWeight: 500 }}>
                        {CATEGORY_LABEL[cat]}
                      </span>
                    ))}
                  </div>
                  <Link href="/practice" style={{ fontSize: '12px', color: FOREST, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                    追加 →
                  </Link>
                </div>
              </>
            ) : mounted ? (
              <NoDataLink text="まだ練習ログがありません。練習後に記録して改善サイクルを始めましょう。" href="/practice" actionLabel="練習ログを記録" />
            ) : null}
          </CardBody>
        </Card>

        {/* ② 前回ラウンドの改善ポイント ── golf-loop-round-logs */}
        <Card>
          <CardHeader
            color={FOREST_MID}
            label="前回ラウンドの改善ポイント"
            sub={latestRound ? formatJpDate(latestRound.date) : undefined}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            }
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {improvPoints.map((point, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flexShrink: 0, marginTop: '1px', width: '19px', height: '19px', borderRadius: '50%', backgroundColor: `${FOREST_LIGHT}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke={FOREST_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '14px', color: INK, lineHeight: 1.5 }}>{point}</span>
                </div>
              ))}
            </div>
            {mounted && !latestRound && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${SAND_LIGHT}` }}>
                <NoDataLink text="ラウンドを記録するとここに改善ポイントが表示されます。" href="/round" actionLabel="ラウンドを記録" />
              </div>
            )}
            {latestRound && (
              <div style={{ marginTop: '14px', fontSize: '11px', color: MUTED, textAlign: 'right' }}>
                {formatJpDate(latestRound.date)} ラウンドより
              </div>
            )}
          </CardBody>
        </Card>

        {/* ③ 最近のベストショット */}
        <Card>
          <CardHeader
            color="#A08018"
            label="最近のベストショット"
            sub={latestShot ? formatJpDate(latestShot.date) : undefined}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
              </svg>
            }
          />
          <CardBody>
            {mounted && latestShot ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                  {latestShot.mood && (
                    <span style={{
                      fontSize: '11px', fontWeight: 700, borderRadius: '4px', padding: '2px 7px',
                      color: latestShot.mood === '最高' ? '#A08018' : latestShot.mood === 'しびれた' ? TERRACOTTA : FOREST_MID,
                      backgroundColor: latestShot.mood === '最高' ? '#C9A82418' : latestShot.mood === 'しびれた' ? `${TERRACOTTA}15` : `${FOREST_MID}15`,
                    }}>
                      {latestShot.mood === '最高' ? '最高！' : latestShot.mood === 'よかった' ? 'よかった' : latestShot.mood === '成長実感' ? '成長実感' : 'しびれた'}
                    </span>
                  )}
                  {latestShot.club && (
                    <span style={{ fontSize: '11px', color: MUTED, backgroundColor: '#FAF8F0',
                      borderRadius: '4px', padding: '2px 7px', border: `1px solid ${SAND_LIGHT}` }}>
                      {latestShot.club}
                    </span>
                  )}
                  {latestShot.courseName && (
                    <span style={{ fontSize: '11px', color: FOREST_MID, backgroundColor: `${FOREST}0D`,
                      borderRadius: '4px', padding: '2px 7px', fontWeight: 500 }}>
                      {latestShot.courseName}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: INK, lineHeight: 1.45, marginBottom: '12px' }}>
                  {latestShot.memo}
                </div>
                <Link href="/best-shot" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '10px', borderRadius: '8px',
                  backgroundColor: '#C9A82410', border: '1px solid #C9A82428',
                  textDecoration: 'none', fontSize: '13px', color: '#8A7010', fontWeight: 600,
                }}>
                  もっと記録する
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9,18 15,12 9,6" />
                  </svg>
                </Link>
              </>
            ) : mounted ? (
              <NoDataLink
                text="ナイスショットの瞬間を記録して自信につなげましょう。"
                href="/best-shot"
                color="#A08018"
                actionLabel="今日のナイスショットを残す"
              />
            ) : null}
          </CardBody>
        </Card>

        {/* ④ 今日の練習メニュー */}
        {mounted && topPractice && (
          <Card>
            <CardHeader
              color={FOREST_LIGHT}
              label="今日の練習メニュー"
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                </svg>
              }
            />
            <CardBody>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: `${TERRACOTTA}12`, borderRadius: '6px', padding: '4px 10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: TERRACOTTA }}>重点テーマ</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: TERRACOTTA }}>{topPractice.theme}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                {topPractice.drills.map((drill, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: FOREST, flexShrink: 0, lineHeight: '18px', minWidth: '14px' }}>{i + 1}.</span>
                    <span style={{ fontSize: '13px', color: INK, lineHeight: 1.5 }}>{drill}</span>
                  </div>
                ))}
              </div>
              <Link href="/analysis" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                padding: '10px', borderRadius: '8px',
                backgroundColor: `${FOREST}08`, border: `1px solid ${FOREST}18`,
                textDecoration: 'none', fontSize: '13px', color: FOREST, fontWeight: 600,
              }}>
                60分メニューも見る
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </Link>
            </CardBody>
          </Card>
        )}

        {/* ④ 次回ラウンド予定 ── golf-loop-round-plans */}
        <Card>
          <CardHeader
            color={TERRACOTTA}
            label="次回ラウンド予定"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8"  y1="2" x2="8"  y2="6" />
                <line x1="3"  y1="10" x2="21" y2="10" />
              </svg>
            }
          />
          <CardBody>
            {mounted && latestPlan ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: INK, marginBottom: '4px' }}>
                      {latestPlan.courseName || 'コース未記入'}
                    </div>
                    <div style={{ fontSize: '13px', color: MUTED }}>
                      {formatJpDate(latestPlan.date)}{latestPlan.startTime ? `　${latestPlan.startTime} スタート` : ''}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: '12px', backgroundColor: `${TERRACOTTA}12`, borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: TERRACOTTA, lineHeight: 1 }}>
                      {Math.max(0, daysUntil(latestPlan.date))}
                    </div>
                    <div style={{ fontSize: '10px', color: MUTED, marginTop: '3px' }}>日後</div>
                  </div>
                </div>
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${SAND_LIGHT}` }}>
                  {latestPlan.strategy?.oneWord ? (
                    <div style={{ fontSize: '13px', color: FOREST_MID, fontWeight: 500, lineHeight: 1.6 }}>
                      「{latestPlan.strategy.oneWord}」
                    </div>
                  ) : (
                    <div style={{ display: 'flex' }}>
                      {[
                        { label: '目標スコア', value: String(latestPlan.targetScore || '−') },
                        { label: '天気',       value: latestPlan.weather   || '−' },
                        { label: '風速',       value: latestPlan.windSpeed ? `${latestPlan.windSpeed}m` : '−' },
                      ].map(({ label, value }, i) => (
                        <div key={label} style={{ flex: 1, paddingLeft: i > 0 ? '16px' : 0, borderLeft: i > 0 ? `1px solid ${SAND_LIGHT}` : 'none', marginLeft: i > 0 ? '16px' : 0 }}>
                          <div style={{ fontSize: '10px', color: MUTED, marginBottom: '2px' }}>{label}</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: INK }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : mounted ? (
              <NoDataLink text="次回ラウンドの戦略を事前に準備しておきましょう。" href="/round-plan" color={TERRACOTTA} actionLabel="準備を作成" />
            ) : null}
          </CardBody>
        </Card>

        {/* ⑤ 次回ラウンド戦略 AI */}
        {mounted && nextRoundStrategy && (
          <Card>
            <CardHeader
              color={nextRoundStrategy.isCritical ? TERRACOTTA : FOREST_MID}
              label="次回ラウンド戦略 AI"
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
                  <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
                  <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                </svg>
              }
            />
            <CardBody>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '14px' }}>
                {nextRoundStrategy.isCritical && (
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, color: TERRACOTTA,
                    backgroundColor: `${TERRACOTTA}12`, borderRadius: '4px', padding: '2px 7px', marginTop: '2px' }}>
                    要注意
                  </span>
                )}
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: INK, marginBottom: '4px', lineHeight: 1.4 }}>
                    {nextRoundStrategy.headline}
                  </div>
                  <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>
                    {nextRoundStrategy.body}
                  </div>
                </div>
              </div>
              <Link href="/round-plan" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                padding: '10px', borderRadius: '8px',
                backgroundColor: `${FOREST}08`, border: `1px solid ${FOREST}18`,
                textDecoration: 'none', fontSize: '13px', color: FOREST, fontWeight: 600,
              }}>
                詳細戦略を作成する
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </Link>
            </CardBody>
          </Card>
        )}

        {/* ④ 直近スコア ── golf-loop-round-logs */}
        <Card>
          <CardHeader
            color="#3A5A4A"
            label={recentRounds.length > 0 ? `直近${recentRounds.length}回の平均スコア` : '直近のスコア'}
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
              </svg>
            }
          />
          <CardBody>
            {mounted && roundLogs.length > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '46px', fontWeight: 700, color: FOREST, lineHeight: 1, letterSpacing: '-0.02em' }}>
                      {avgScore !== null ? avgScore.toFixed(1) : '−'}
                    </div>
                    <div style={{ fontSize: '12px', color: MUTED, marginTop: '6px' }}>平均スコア</div>
                    {scoreDiff !== null && (
                      <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: scoreDiff < 0 ? `${FOREST_LIGHT}15` : `${TERRACOTTA}12`, borderRadius: '4px', padding: '3px 8px' }}>
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke={scoreDiff < 0 ? FOREST_LIGHT : TERRACOTTA} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {scoreDiff < 0
                            ? <polyline points="1,7 5,2 9,5" />
                            : <polyline points="1,3 5,8 9,5" />}
                        </svg>
                        <span style={{ fontSize: '11px', color: scoreDiff < 0 ? FOREST_LIGHT : TERRACOTTA, fontWeight: 600 }}>
                          前回比 {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bar chart (oldest → newest) */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', paddingBottom: '2px' }}>
                    {displayScores.map((score, i) => {
                      const barH   = Math.max(4, Math.min(52, Math.round(((120 - score) / 40) * 52)))
                      const isLast = i === displayScores.length - 1
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '11px', color: MUTED, fontWeight: 500 }}>{score}</span>
                          <div style={{ width: '28px', height: `${barH}px`, backgroundColor: isLast ? FOREST : `${FOREST}4A`, borderRadius: '4px 4px 0 0' }} />
                          <span style={{ fontSize: '10px', color: MUTED, whiteSpace: 'nowrap' }}>{getBarLabel(i)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${SAND_LIGHT}`, display: 'flex' }}>
                  {[
                    { label: 'ベスト',    value: String(Math.min(...scoreList)) },
                    { label: 'ワースト',  value: String(Math.max(...scoreList)) },
                    { label: 'FW率',      value: avgFwPct  !== null ? `${avgFwPct}%`          : '−' },
                    { label: 'パット平均', value: avgPutts  !== null ? avgPutts.toFixed(1)     : '−' },
                  ].map(({ label, value }, i) => (
                    <div key={label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? `1px solid ${SAND_LIGHT}` : 'none' }}>
                      <div style={{ fontSize: '10px', color: MUTED, marginBottom: '3px' }}>{label}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: INK }}>{value}</div>
                    </div>
                  ))}
                </div>
                <Link href="/analysis" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  marginTop: '12px', padding: '10px', borderRadius: '8px',
                  backgroundColor: `${FOREST}08`, border: `1px solid ${FOREST}18`,
                  textDecoration: 'none', fontSize: '13px', color: FOREST, fontWeight: 600,
                }}>
                  詳細を分析する
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9,18 15,12 9,6" />
                  </svg>
                </Link>
              </>
            ) : mounted ? (
              <NoDataLink text="ラウンドを記録するとスコアの推移が表示されます。" href="/round" actionLabel="ラウンドを記録" />
            ) : null}
          </CardBody>
        </Card>

      </main>

      <BottomNav />
    </div>
  )
}
