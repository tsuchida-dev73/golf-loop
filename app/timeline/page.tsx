'use client'

import { useState, useEffect, startTransition } from 'react'
import Link from 'next/link'
import BottomNav from '../components/BottomNav'

const FOREST       = '#1C4230'
const FOREST_MID   = '#235C3E'
const FOREST_LIGHT = '#3A7D57'
const TERRACOTTA   = '#C0522D'
const CREAM        = '#FAF8F0'
const SAND_LIGHT   = '#E8DFCE'
const CARD         = '#FFFFFF'
const INK          = '#1C1C1C'
const MUTED        = '#6B7060'
const GOLD         = '#C9A824'
const GOLD_DARK    = '#A08018'

type Category  = 'driver' | 'iron' | 'approach' | 'putter'
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
type BestShot = {
  id: string; date: string; courseName: string; hole: string; club: string
  shotType: string; memo: string; whyGood: string; reproducePoint: string; mood: string; savedAt: string
}

type FilterType = 'all' | 'practice' | 'round' | 'bestShot'

type TimelineEntry =
  | { type: 'practice'; data: PracticeLog; sortKey: string }
  | { type: 'round';    data: RoundLog;    sortKey: string }
  | { type: 'bestShot'; data: BestShot;    sortKey: string }

const PRACTICE_KEY  = 'golf-loop-practice-logs'
const ROUND_KEY     = 'golf-loop-round-logs'
const BEST_SHOT_KEY = 'golf-loop-best-shots'

const CATEGORY_LABEL: Record<Category, string> = {
  driver: 'ドライバー', iron: 'アイアン', approach: 'アプローチ', putter: 'パター',
}

function formatJpDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  const wd = ['日', '月', '火', '水', '木', '金', '土']
  return `${Number(m)}月${Number(d)}日（${wd[new Date(+y, +m - 1, +d).getDay()]}）`
}

function calcRoundStats(log: RoundLog) {
  const hs    = log.holes.slice(0, 18)
  const score = hs.reduce((s, h) => s + h.score, 0)
  const par   = hs.reduce((s, h) => s + h.par,   0)
  const putts = hs.reduce((s, h) => s + h.putts,  0)
  const obs   = hs.filter(h => h.teeShot === 'OB').length
  return { score, par, putts, obs, diff: score - par }
}

function EntryHeader({ color, icon, label, date }: {
  color: string; icon: React.ReactNode; label: string; date: string
}) {
  return (
    <div style={{ backgroundColor: color, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {icon}
      <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
        {formatJpDate(date)}
      </span>
    </div>
  )
}

function PracticeCard({ log }: { log: PracticeLog }) {
  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.08)', overflow: 'hidden' }}>
      <EntryHeader
        color={TERRACOTTA}
        date={log.date}
        label="練習"
        icon={
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        }
      />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: INK, lineHeight: 1.4, marginBottom: '6px' }}>
          {log.theme || '（テーマ未記入）'}
        </div>
        {log.good && (
          <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.65 }}>
            ✓ {log.good.slice(0, 60)}
          </div>
        )}
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${SAND_LIGHT}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {log.categories.length > 0 && (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {log.categories.map(cat => (
                <span key={cat} style={{
                  fontSize: '11px', color: TERRACOTTA,
                  backgroundColor: `${TERRACOTTA}12`, borderRadius: '4px',
                  padding: '2px 7px', fontWeight: 500,
                }}>
                  {CATEGORY_LABEL[cat]}
                </span>
              ))}
            </div>
          )}
          {log.theme && (
            <div style={{ fontSize: '12px', color: MUTED }}>
              <span style={{ fontWeight: 600, color: TERRACOTTA }}>テーマ</span>　{log.theme}
            </div>
          )}
          {log.next && (
            <div style={{ fontSize: '12px', color: FOREST_MID, fontWeight: 500, lineHeight: 1.5 }}>
              → 次回：{log.next.slice(0, 50)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RoundCard({ log }: { log: RoundLog }) {
  const stats = calcRoundStats(log)
  const items = [
    { label: 'スコア', value: String(stats.score), alert: false },
    { label: 'パット', value: String(stats.putts), alert: false },
    { label: 'OB',    value: String(stats.obs),    alert: stats.obs > 0 },
  ]
  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.08)', overflow: 'hidden' }}>
      <EntryHeader
        color={FOREST}
        date={log.date}
        label="ラウンド"
        icon={
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
        }
      />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: INK, lineHeight: 1.4, marginBottom: '4px' }}>
          {log.courseName || 'コース未記入'}
        </div>
        <div style={{ fontSize: '13px', color: MUTED, marginBottom: '10px' }}>
          スコア {stats.score}（{stats.diff >= 0 ? '+' : ''}{stats.diff}）
        </div>
        <div style={{ paddingTop: '10px', borderTop: `1px solid ${SAND_LIGHT}`, display: 'flex' }}>
          {items.map(({ label, value, alert }, i) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? `1px solid ${SAND_LIGHT}` : 'none' }}>
              <div style={{ fontSize: '10px', color: MUTED, marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: alert ? TERRACOTTA : INK }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BestShotCard({ log }: { log: BestShot }) {
  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.08)', overflow: 'hidden' }}>
      <EntryHeader
        color={GOLD_DARK}
        date={log.date}
        label="ベストショット"
        icon={
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="rgba(255,255,255,0.2)" />
          </svg>
        }
      />
      <div style={{ padding: '14px 16px', backgroundColor: `${GOLD}06` }}>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {log.mood && (
            <span style={{
              fontSize: '11px', fontWeight: 700, borderRadius: '4px', padding: '2px 7px',
              color: GOLD_DARK, backgroundColor: `${GOLD}20`,
            }}>
              {log.mood === '最高' ? '最高！' : log.mood}
            </span>
          )}
          {log.club && (
            <span style={{
              fontSize: '11px', color: MUTED, backgroundColor: CREAM,
              borderRadius: '4px', padding: '2px 7px', border: `1px solid ${SAND_LIGHT}`,
            }}>
              {log.club}
            </span>
          )}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: INK, lineHeight: 1.45, marginBottom: '8px' }}>
          {log.memo || '（メモなし）'}
        </div>
        <div style={{ paddingTop: '10px', borderTop: `1px solid rgba(201,168,36,0.2)`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {log.hole && (
            <div style={{ fontSize: '12px', color: MUTED }}>
              <span style={{ color: GOLD_DARK, fontWeight: 600 }}>ホール</span>　{log.hole}番
            </div>
          )}
          {log.courseName && (
            <div style={{ fontSize: '12px', color: MUTED }}>
              <span style={{ color: GOLD_DARK, fontWeight: 600 }}>コース</span>　{log.courseName}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TimelinePage() {
  const [mounted,      setMounted]      = useState(false)
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([])
  const [roundLogs,    setRoundLogs]    = useState<RoundLog[]>([])
  const [bestShots,    setBestShots]    = useState<BestShot[]>([])
  const [filter,       setFilter]       = useState<FilterType>('all')

  useEffect(() => {
    let practices: PracticeLog[] = []
    let rounds: RoundLog[]       = []
    let shots: BestShot[]        = []
    try {
      const p = localStorage.getItem(PRACTICE_KEY)
      const r = localStorage.getItem(ROUND_KEY)
      const b = localStorage.getItem(BEST_SHOT_KEY)
      if (p) practices = JSON.parse(p)
      if (r) rounds    = JSON.parse(r)
      if (b) shots     = JSON.parse(b)
    } catch {}
    startTransition(() => {
      setPracticeLogs(practices)
      setRoundLogs(rounds)
      setBestShots(shots)
      setMounted(true)
    })
  }, [])

  const entries: TimelineEntry[] = [
    ...practiceLogs.map(data => ({ type: 'practice' as const, data, sortKey: data.savedAt || data.date })),
    ...roundLogs.map(data    => ({ type: 'round'    as const, data, sortKey: data.savedAt || data.date })),
    ...bestShots.map(data    => ({ type: 'bestShot' as const, data, sortKey: data.savedAt || data.date })),
  ].sort((a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime())

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter)

  const filterConfig: { key: FilterType; label: string; color: string }[] = [
    { key: 'all',      label: 'すべて',        color: FOREST_MID },
    { key: 'practice', label: '練習',          color: TERRACOTTA },
    { key: 'round',    label: 'ラウンド',       color: FOREST },
    { key: 'bestShot', label: 'ベストショット', color: GOLD_DARK },
  ]

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', backgroundColor: CREAM }}>

      <header style={{ backgroundColor: FOREST, padding: '52px 20px 22px' }}>
        <div style={{ marginBottom: '10px' }}>
          <Link href="/" style={{
            color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
            fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
            ホーム
          </Link>
        </div>
        <h1 style={{
          color: '#FFFFFF', fontSize: '24px', fontWeight: 700, margin: '0',
          lineHeight: 1.2, letterSpacing: '0.08em',
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}>
          ゴルフ日記
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '5px 0 0', letterSpacing: '0.04em' }}>
          練習・ラウンド・ベストショットの記録
        </p>
      </header>

      {/* Filter tabs */}
      <div style={{ padding: '14px 16px 4px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
        {filterConfig.map(({ key, label, color }) => {
          const active = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: '20px', cursor: 'pointer',
                fontSize: '13px', fontWeight: active ? 700 : 500,
                border: active ? 'none' : `1.5px solid ${color}50`,
                backgroundColor: active ? color : 'transparent',
                color: active ? '#FFFFFF' : color,
                outline: 'none',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      <main style={{ padding: '10px 16px 100px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!mounted ? null : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: MUTED, fontSize: '14px', lineHeight: 1.8 }}>
            まだ記録がありません。<br />
            練習やラウンドを記録してみましょう。
          </div>
        ) : (
          filtered.map(entry => {
            if (entry.type === 'practice') {
              return <PracticeCard key={`p-${entry.data.id}`} log={entry.data} />
            }
            if (entry.type === 'round') {
              return <RoundCard key={`r-${entry.data.id}`} log={entry.data} />
            }
            return <BestShotCard key={`b-${entry.data.id}`} log={entry.data} />
          })
        )}
      </main>

      <BottomNav />
    </div>
  )
}
