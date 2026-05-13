'use client'

import { useState, useEffect, useRef, startTransition } from 'react'
import Link from 'next/link'
import BottomNav from '../components/BottomNav'

// ─── Design tokens ─────────────────────────────────────────────────────────
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
const BOGEY_AMB    = '#B06820'
const POND_BLUE    = '#1565C0'

// ─── Types ─────────────────────────────────────────────────────────────────
type Par     = 3 | 4 | 5
type TeeShot = 'FW' | '左' | '右' | 'OB' | '池' | null

type LiveHoleData = {
  par: Par
  score: number
  putts: number
  teeShot: TeeShot
  bunker: number
  penalty: number
  memo: string
}

type LiveRound = {
  date: string
  courseName: string
  startedAt: string
  holes: LiveHoleData[]
  notes: string
}

type HoleData = {
  par: Par
  score: number
  putts: number
  teeShot: TeeShot
  memo: string
}

type RoundLog = {
  id: string
  date: string
  courseName: string
  weather: string
  targetScore: number
  holes: HoleData[]
  savedAt: string
}

const LIVE_KEY  = 'golf-loop-live-round'
const ROUND_KEY = 'golf-loop-round-logs'

// ─── Helpers ────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mkLiveHoles(): LiveHoleData[] {
  return Array.from({ length: 18 }, () => ({
    par: 4 as Par, score: 4, putts: 2, teeShot: null as TeeShot,
    bunker: 0, penalty: 0, memo: '',
  }))
}

function diffColor(diff: number) {
  if (diff <= -2) return GOLD
  if (diff === -1) return FOREST_LIGHT
  if (diff === 0)  return MUTED
  if (diff === 1)  return BOGEY_AMB
  return TERRACOTTA
}

function diffLabel(diff: number) {
  if (diff === 0) return 'E'
  return diff > 0 ? `+${diff}` : `${diff}`
}

function calcStats(holes: LiveHoleData[]) {
  const score      = holes.reduce((s, h) => s + h.score, 0)
  const par        = holes.reduce((s, h) => s + h.par,   0)
  const putts      = holes.reduce((s, h) => s + h.putts,  0)
  const fws        = holes.filter(h => h.teeShot === 'FW').length
  const obs        = holes.filter(h => h.teeShot === 'OB').length
  const rights     = holes.filter(h => h.teeShot === '右').length
  const lefts      = holes.filter(h => h.teeShot === '左').length
  const threePutts = holes.filter(h => h.putts >= 3).length
  const bunkers    = holes.reduce((s, h) => s + h.bunker, 0)
  const penalties  = holes.reduce((s, h) => s + h.penalty, 0)
  const front9diff = holes.slice(0, 9).reduce((s, h) => s + (h.score - h.par), 0)
  const back9diff  = holes.slice(9).reduce((s, h) => s + (h.score - h.par), 0)
  return { score, par, diff: score - par, putts, fws, obs, rights, lefts, threePutts, bunkers, penalties, front9diff, back9diff }
}

function findResumeHole(holes: LiveHoleData[]): number {
  for (let i = holes.length - 1; i >= 0; i--) {
    const h = holes[i]
    if (h.teeShot !== null || h.putts !== 2 || h.bunker > 0 || h.penalty > 0) {
      return Math.min(i + 1, 17)
    }
  }
  return 0
}

// ─── BigStepper ─────────────────────────────────────────────────────────────
function BigStepper({ label, value, min, max, onChange, diff }: {
  label: string; value: number; min: number; max: number
  onChange: (n: number) => void; diff?: number
}) {
  const btnBase: React.CSSProperties = {
    width: '58px', height: '58px', borderRadius: '14px', border: `2px solid ${SAND_LIGHT}`,
    fontSize: '28px', fontWeight: 300, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: FOREST, width: '46px' }}>{label}</span>
        {diff !== undefined && (
          <span style={{ fontSize: '14px', fontWeight: 700, color: diffColor(diff), minWidth: '28px' }}>
            {diffLabel(diff)}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{ ...btnBase, backgroundColor: CREAM, color: MUTED }}
          onTouchStart={e => { e.currentTarget.style.borderColor = FOREST_MID }}
          onTouchEnd={e => { e.currentTarget.style.borderColor = SAND_LIGHT }}
        >−</button>
        <span style={{ fontSize: '42px', fontWeight: 700, color: INK, minWidth: '50px', textAlign: 'center', lineHeight: 1 }}>
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{ ...btnBase, backgroundColor: `${FOREST}0C`, color: FOREST_MID }}
          onTouchStart={e => { e.currentTarget.style.borderColor = FOREST_MID; e.currentTarget.style.backgroundColor = `${FOREST}20` }}
          onTouchEnd={e => { e.currentTarget.style.borderColor = SAND_LIGHT; e.currentTarget.style.backgroundColor = `${FOREST}0C` }}
        >+</button>
      </div>
    </div>
  )
}

// ─── SmallStepper ───────────────────────────────────────────────────────────
function SmallStepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: `${FOREST}07`, borderRadius: '12px', padding: '10px 12px',
    }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: MUTED }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{
            width: '34px', height: '34px', borderRadius: '8px',
            border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CARD,
            fontSize: '18px', color: MUTED, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >−</button>
        <span style={{ fontSize: '20px', fontWeight: 700, color: INK, minWidth: '22px', textAlign: 'center' }}>{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{
            width: '34px', height: '34px', borderRadius: '8px',
            border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CARD,
            fontSize: '18px', color: FOREST_MID, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >+</button>
      </div>
    </div>
  )
}

// ─── ParSelector ────────────────────────────────────────────────────────────
function ParSelector({ value, onChange }: { value: Par; onChange: (p: Par) => void }) {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {([3, 4, 5] as Par[]).map(p => (
        <button key={p} onClick={() => onChange(p)} style={{
          flex: 1, height: '40px', borderRadius: '10px', fontSize: '14px',
          fontWeight: value === p ? 700 : 500,
          color: value === p ? '#fff' : MUTED,
          backgroundColor: value === p ? FOREST_MID : 'transparent',
          border: `1.5px solid ${value === p ? FOREST_MID : SAND_LIGHT}`,
          cursor: 'pointer',
        }}>Par {p}</button>
      ))}
    </div>
  )
}

// ─── TeeShot buttons ────────────────────────────────────────────────────────
const TEE_OPTS: { id: Exclude<TeeShot, null>; label: string; color: string }[] = [
  { id: 'FW',  label: 'FW',   color: FOREST_MID },
  { id: '左',  label: '左',   color: BOGEY_AMB },
  { id: '右',  label: '右',   color: BOGEY_AMB },
  { id: 'OB',  label: 'OB',   color: TERRACOTTA },
  { id: '池',  label: '池',   color: POND_BLUE },
]

function TeeShotBig({ value, onChange }: { value: TeeShot; onChange: (t: TeeShot) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
      {TEE_OPTS.map(({ id, label, color }) => {
        const on = value === id
        return (
          <button key={id} onClick={() => onChange(on ? null : id)} style={{
            height: '52px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
            color: on ? '#fff' : color,
            backgroundColor: on ? color : `${color}14`,
            border: `2px solid ${on ? color : `${color}40`}`,
            cursor: 'pointer',
          }}>{label}</button>
        )
      })}
    </div>
  )
}

// ─── Modal backdrop ─────────────────────────────────────────────────────────
function ModalSheet({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', zIndex: 301,
        backgroundColor: CARD, borderRadius: '20px 20px 0 0',
        padding: '24px 20px', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
      }}>
        {children}
      </div>
    </>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function RoundLivePage() {
  const [mounted,     setMounted]     = useState(false)
  const [currentHole, setCurrentHole] = useState(0)
  const [holes,       setHoles]       = useState<LiveHoleData[]>(mkLiveHoles)
  const [courseName,  setCourseName]  = useState('')
  const [notes,       setNotes]       = useState('')
  const [startedAt,   setStartedAt]   = useState('')
  const [showResume,  setShowResume]  = useState(false)
  const [showSave,    setShowSave]    = useState(false)
  const [savedOk,     setSavedOk]     = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)

  // Load from localStorage
  useEffect(() => {
    let hasData = false
    try {
      const raw = localStorage.getItem(LIVE_KEY)
      if (raw) {
        const data: LiveRound = JSON.parse(raw)
        hasData = true
        startTransition(() => {
          const h = data.holes.length === 18 ? data.holes : mkLiveHoles()
          setHoles(h)
          setCourseName(data.courseName ?? '')
          setNotes(data.notes ?? '')
          setStartedAt(data.startedAt ?? new Date().toISOString())
          setCurrentHole(findResumeHole(h))
          setShowResume(true)
        })
      }
    } catch {}
    if (!hasData) setStartedAt(new Date().toISOString())
    startTransition(() => setMounted(true))
  }, [])

  // Auto-save on every change
  useEffect(() => {
    if (!mounted) return
    const data: LiveRound = {
      date: todayStr(), courseName,
      startedAt: startedAt || new Date().toISOString(),
      holes, notes,
    }
    try { localStorage.setItem(LIVE_KEY, JSON.stringify(data)) } catch {}
  }, [holes, courseName, notes, mounted, startedAt])

  // Scroll hole strip to keep active hole visible
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const btn = strip.children[currentHole] as HTMLElement | undefined
    if (btn) btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [currentHole])

  function updateHole(patch: Partial<LiveHoleData>) {
    setHoles(prev => {
      const next = [...prev]
      next[currentHole] = { ...next[currentHole], ...patch }
      return next
    })
  }

  function goHole(n: number) { setCurrentHole(Math.max(0, Math.min(17, n))) }

  function startFresh() {
    const fresh = mkLiveHoles()
    setHoles(fresh); setCourseName(''); setNotes('')
    setStartedAt(new Date().toISOString()); setCurrentHole(0)
    setShowResume(false)
    try { localStorage.removeItem(LIVE_KEY) } catch {}
  }

  function saveRound() {
    try {
      const rawLogs = localStorage.getItem(ROUND_KEY)
      const logs: RoundLog[] = rawLogs ? JSON.parse(rawLogs) : []
      const holeData: HoleData[] = holes.map(h => ({
        par: h.par, score: h.score, putts: h.putts, teeShot: h.teeShot,
        memo: [
          h.bunker > 0   ? `バンカー${h.bunker}` : '',
          h.penalty > 0  ? `ペナルティ${h.penalty}` : '',
          h.memo,
        ].filter(Boolean).join(' '),
      }))
      const entry: RoundLog = {
        id: String(Date.now()), date: todayStr(), courseName,
        weather: '', targetScore: 0, holes: holeData,
        savedAt: new Date().toISOString(),
      }
      localStorage.setItem(ROUND_KEY, JSON.stringify([entry, ...logs]))
      localStorage.removeItem(LIVE_KEY)
      setShowSave(false)
      setSavedOk(true)
    } catch {}
  }

  const hole  = holes[currentHole]
  const diff  = hole.score - hole.par
  const stats = calcStats(holes)
  const collapseTrend = stats.back9diff - stats.front9diff >= 4

  const statBadges = [
    { label: '右ミス', count: stats.rights,     color: BOGEY_AMB },
    { label: '左ミス', count: stats.lefts,      color: BOGEY_AMB },
    { label: 'OB',    count: stats.obs,         color: TERRACOTTA },
    { label: '3パット', count: stats.threePutts, color: TERRACOTTA },
    { label: 'バンカー', count: stats.bunkers,   color: MUTED },
    { label: 'ペナルティ', count: stats.penalties, color: MUTED },
  ].filter(b => b.count > 0)

  const hasBadges = statBadges.length > 0 || collapseTrend
  const bottomPanelHeight = (hasBadges ? 48 : 0) + 52 + 16

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', backgroundColor: CREAM }}>

      {/* Resume sheet */}
      {showResume && (
        <ModalSheet>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: INK, marginBottom: '6px' }}>
              ラウンドを再開しますか？
            </div>
            <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>
              前回の入力データが残っています<br />
              <span style={{ fontWeight: 700, color: FOREST }}>現在スコア: {stats.score}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => setShowResume(false)} style={{
              width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
              backgroundColor: FOREST, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}>前回から続ける</button>
            <button onClick={startFresh} style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              border: `1.5px solid ${SAND_LIGHT}`, background: 'none',
              fontSize: '14px', color: MUTED, cursor: 'pointer',
            }}>新しいラウンドを開始</button>
          </div>
        </ModalSheet>
      )}

      {/* Save sheet */}
      {showSave && (
        <ModalSheet onClose={() => setShowSave(false)}>
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <div style={{ fontSize: '48px', fontWeight: 700, color: FOREST, lineHeight: 1 }}>{stats.score}</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: diffColor(stats.diff), marginTop: '4px' }}>
              {diffLabel(stats.diff)}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: INK, marginTop: '14px' }}>ラウンドを保存する</div>
            <div style={{ fontSize: '13px', color: MUTED, marginTop: '4px' }}>スコア記録・分析に追加されます</div>
          </div>
          <input
            type="text" placeholder="コース名（任意）" value={courseName}
            onChange={e => setCourseName(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: '10px', marginBottom: '14px',
              border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM,
              fontSize: '14px', color: INK, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={saveRound} style={{
              width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
              backgroundColor: TERRACOTTA, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}>保存する</button>
            <button onClick={() => setShowSave(false)} style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              border: `1.5px solid ${SAND_LIGHT}`, background: 'none',
              fontSize: '14px', color: MUTED, cursor: 'pointer',
            }}>キャンセル</button>
          </div>
        </ModalSheet>
      )}

      {/* Success sheet */}
      {savedOk && (
        <ModalSheet>
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', backgroundColor: `${FOREST}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: INK }}>保存しました！</div>
            <div style={{ fontSize: '13px', color: MUTED, marginTop: '4px' }}>ラウンドデータを記録しました</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link href="/analysis" style={{
              display: 'block', textAlign: 'center', padding: '16px', borderRadius: '12px',
              backgroundColor: FOREST, color: '#fff', fontSize: '15px', fontWeight: 700, textDecoration: 'none',
            }}>分析を見る</Link>
            <Link href="/" style={{
              display: 'block', textAlign: 'center', padding: '14px', borderRadius: '12px',
              border: `1.5px solid ${SAND_LIGHT}`, color: MUTED, fontSize: '14px', textDecoration: 'none',
            }}>ホームへ戻る</Link>
          </div>
        </ModalSheet>
      )}

      {/* ── Sticky header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        backgroundColor: FOREST,
        paddingTop: 'max(env(safe-area-inset-top, 0px), 14px)',
      }}>
        {/* Title + live score */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', letterSpacing: '0.2em', fontFamily: "Georgia,'Times New Roman',serif" }}>
              GOLF LOOP
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              backgroundColor: TERRACOTTA, borderRadius: '10px', padding: '3px 9px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#fff', display: 'inline-block' }} />
              <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em' }}>LIVE</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '28px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{stats.score}</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: diffColor(stats.diff) }}>{diffLabel(stats.diff)}</span>
          </div>
        </div>

        {/* Hole strip */}
        <div ref={stripRef} style={{
          display: 'flex', gap: '4px', overflowX: 'auto',
          padding: '0 12px 12px', scrollbarWidth: 'none',
        }}>
          {holes.map((h, i) => {
            const active   = i === currentHole
            const hDiff    = h.score - h.par
            const hasData  = h.teeShot !== null || h.putts !== 2 || h.bunker > 0 || h.penalty > 0
            return (
              <button key={i} onClick={() => goHole(i)} style={{
                flexShrink: 0, width: '36px', height: '36px', borderRadius: '9px',
                fontSize: '12px', fontWeight: active ? 700 : 500, cursor: 'pointer', border: 'none',
                backgroundColor: active ? '#fff' : hasData ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                color: active ? FOREST : hasData ? diffColor(hDiff) : 'rgba(255,255,255,0.55)',
              }}>{i + 1}</button>
            )
          })}
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={{ padding: '14px 14px', paddingBottom: `${bottomPanelHeight + 72}px`, display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Hole navigation + PAR */}
        <div style={{ backgroundColor: CARD, borderRadius: '16px', padding: '16px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <button onClick={() => goHole(currentHole - 1)} disabled={currentHole === 0} style={{
              width: '52px', height: '52px', borderRadius: '14px',
              border: `2px solid ${currentHole === 0 ? SAND_LIGHT : FOREST_MID}`,
              backgroundColor: currentHole === 0 ? CREAM : `${FOREST}0F`,
              color: currentHole === 0 ? SAND_LIGHT : FOREST,
              fontSize: '18px', cursor: currentHole === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>◀</button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.18em', marginBottom: '2px' }}>HOLE</div>
              <div style={{ fontSize: '52px', fontWeight: 700, color: FOREST, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {currentHole + 1}
              </div>
              <div style={{ fontSize: '11px', color: MUTED, marginTop: '1px' }}>
                {currentHole < 9 ? '前半' : '後半'}
              </div>
            </div>

            <button onClick={() => goHole(currentHole + 1)} disabled={currentHole === 17} style={{
              width: '52px', height: '52px', borderRadius: '14px',
              border: `2px solid ${currentHole === 17 ? SAND_LIGHT : FOREST_MID}`,
              backgroundColor: currentHole === 17 ? CREAM : `${FOREST}0F`,
              color: currentHole === 17 ? SAND_LIGHT : FOREST,
              fontSize: '18px', cursor: currentHole === 17 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>▶</button>
          </div>

          <ParSelector value={hole.par} onChange={p => updateHole({ par: p, score: p })} />
        </div>

        {/* Score + Putts */}
        <div style={{ backgroundColor: CARD, borderRadius: '16px', padding: '18px 14px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <BigStepper label="スコア" value={hole.score} min={1} max={15} onChange={n => updateHole({ score: n })} diff={diff} />
          <div style={{ height: '1px', backgroundColor: SAND_LIGHT }} />
          <BigStepper label="パット" value={hole.putts} min={0} max={6} onChange={n => updateHole({ putts: n })} />
        </div>

        {/* Tee shot */}
        <div style={{ backgroundColor: CARD, borderRadius: '16px', padding: '14px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, marginBottom: '10px', letterSpacing: '0.06em' }}>ティーショット</div>
          <TeeShotBig value={hole.teeShot} onChange={t => updateHole({ teeShot: t })} />
        </div>

        {/* Bunker + Penalty */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <SmallStepper label="バンカー" value={hole.bunker} min={0} max={5} onChange={n => updateHole({ bunker: n })} />
          <SmallStepper label="ペナルティ" value={hole.penalty} min={0} max={5} onChange={n => updateHole({ penalty: n })} />
        </div>

        {/* Per-hole memo */}
        <input
          type="text"
          placeholder="ホールメモ（例：右プッシュ、グリーン奥など）"
          value={hole.memo}
          onChange={e => updateHole({ memo: e.target.value })}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px',
            border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CARD,
            fontSize: '14px', color: INK, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = FOREST_MID)}
          onBlur={e => (e.currentTarget.style.borderColor = SAND_LIGHT)}
        />

        {/* Round notes */}
        <div style={{ backgroundColor: CARD, borderRadius: '16px', padding: '14px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, marginBottom: '8px', letterSpacing: '0.06em' }}>
            ラウンドメモ
          </div>
          <textarea
            placeholder={'例：右プッシュ多い\nパターショート\n風が強い'}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM,
              fontSize: '13px', color: INK, outline: 'none', fontFamily: 'inherit',
              resize: 'none', lineHeight: 1.65, boxSizing: 'border-box',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = FOREST_MID)}
            onBlur={e => (e.currentTarget.style.borderColor = SAND_LIGHT)}
          />
        </div>
      </main>

      {/* ── Fixed bottom panel (stats + save) ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', zIndex: 40,
        backgroundColor: CARD, borderTop: `1px solid ${SAND_LIGHT}`,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 58px)',
      }}>
        {/* Stat badges */}
        {hasBadges && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', padding: '8px 12px 4px' }}>
            {statBadges.map(({ label, count, color }) => (
              <span key={label} style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                backgroundColor: `${color}14`, borderRadius: '20px', padding: '3px 9px',
                fontSize: '11px', fontWeight: 700, color,
              }}>{label} {count}回</span>
            ))}
            {collapseTrend && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                backgroundColor: `${TERRACOTTA}14`, borderRadius: '20px', padding: '3px 9px',
                fontSize: '11px', fontWeight: 700, color: TERRACOTTA,
              }}>後半崩れ傾向</span>
            )}
          </div>
        )}
        {/* Save button */}
        <div style={{ padding: hasBadges ? '4px 12px 8px' : '8px 12px 8px' }}>
          <button onClick={() => setShowSave(true)} style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            backgroundColor: TERRACOTTA, color: '#fff', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.03em',
          }}
            onTouchStart={e => (e.currentTarget.style.opacity = '0.85')}
            onTouchEnd={e => (e.currentTarget.style.opacity = '1')}
          >
            ラウンドを保存する
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
