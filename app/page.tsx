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

const PRACTICE_KEY = 'golf-loop-practice-logs'
const ROUND_KEY    = 'golf-loop-round-logs'
const PLAN_KEY     = 'golf-loop-round-plans'

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
      href: '/round', label: 'ラウンド',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={TERRACOTTA} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
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
      <header style={{ backgroundColor: FOREST, padding: '52px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', letterSpacing: '0.15em', marginBottom: '6px', fontWeight: 500 }}>
              GOLF LOOP
            </div>
            <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
              おはようございます
            </h1>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', marginTop: '4px' }}>
              {mounted ? todayLabel : ''}
            </div>
          </div>
          <button
            style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>

        {mounted && (
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '5px 14px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7ECB9E' }} />
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 500 }}>
                今月の練習 {practiceThisMonth}回
              </span>
            </div>
            {daysSinceRound !== null && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '5px 14px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F9C74F' }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 500 }}>
                  最終ラウンド {daysSinceRound === 0 ? '今日' : `${daysSinceRound}日前`}
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      <QuickActionsBar />

      <main style={{ padding: '14px 16px 100px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

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

        {/* ③ 次回ラウンド予定 ── golf-loop-round-plans */}
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
