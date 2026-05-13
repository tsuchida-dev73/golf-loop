'use client'

import { useState, useEffect, startTransition } from 'react'
import Link from 'next/link'
import BottomNav from '../components/BottomNav'

// ─── Design tokens ─────────────────────────────────────────────────────────
const FOREST     = '#1C4230'
const FOREST_MID = '#235C3E'
const FOREST_LIGHT = '#3A7D57'
const TERRACOTTA = '#C0522D'
const CREAM      = '#FAF8F0'
const SAND_LIGHT = '#E8DFCE'
const CARD       = '#FFFFFF'
const INK        = '#1C1C1C'
const MUTED      = '#6B7060'
const GOLD       = '#C9A824'
const BOGEY_AMB  = '#B06820'
const POND_BLUE  = '#1565C0'

// ─── Types ─────────────────────────────────────────────────────────────────
type Par      = 3 | 4 | 5
type TeeShot  = 'FW' | '左' | '右' | 'OB' | '池' | null

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
  holes: HoleData[]   // always 18 elements
  savedAt: string
}

const ROUND_KEY = 'golf-loop-round-logs'

// ─── Helpers ───────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(s: string) {
  const [y, m, d] = s.split('-')
  const wd = ['日', '月', '火', '水', '木', '金', '土']
  return `${Number(m)}月${Number(d)}日（${wd[new Date(+y, +m - 1, +d).getDay()]}）`
}

function diffColor(diff: number) {
  if (diff <= -2) return GOLD
  if (diff === -1) return FOREST_LIGHT
  if (diff === 0)  return MUTED
  if (diff === 1)  return BOGEY_AMB
  return TERRACOTTA
}

function diffLabel(score: number, par: number) {
  const d = score - par
  if (d === 0) return 'E'
  return d > 0 ? `+${d}` : `${d}`
}

function mkHoles(): HoleData[] {
  return Array.from({ length: 18 }, () => ({ par: 4 as Par, score: 4, putts: 2, teeShot: null, memo: '' }))
}

function stats(hs: HoleData[]) {
  return {
    score: hs.reduce((s, h) => s + h.score, 0),
    par:   hs.reduce((s, h) => s + h.par,   0),
    putts: hs.reduce((s, h) => s + h.putts,  0),
    fws:   hs.filter(h => h.teeShot === 'FW').length,
    obs:   hs.filter(h => h.teeShot === 'OB').length,
    ponds: hs.filter(h => h.teeShot === '池').length,
    lefts: hs.filter(h => h.teeShot === '左').length,
    rights:hs.filter(h => h.teeShot === '右').length,
  }
}

// ─── Stepper ───────────────────────────────────────────────────────────────
function Stepper({ value, min, max, onChange }: {
  value: number; min: number; max: number; onChange: (n: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
      <button onClick={() => onChange(Math.max(min, value - 1))}
        style={{ width: '26px', height: '26px', borderRadius: '50%', border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM, cursor: 'pointer', color: MUTED, fontSize: '15px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        −
      </button>
      <span style={{ width: '26px', textAlign: 'center', fontSize: '15px', fontWeight: 700, color: INK }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))}
        style={{ width: '26px', height: '26px', borderRadius: '50%', border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM, cursor: 'pointer', color: MUTED, fontSize: '15px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        +
      </button>
    </div>
  )
}

// ─── Par selector ──────────────────────────────────────────────────────────
function ParSelector({ value, onChange }: { value: Par; onChange: (p: Par) => void }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {([3, 4, 5] as Par[]).map(p => (
        <button key={p} onClick={() => onChange(p)} style={{
          width: '22px', height: '22px', borderRadius: '4px', fontSize: '11px',
          fontWeight: value === p ? 700 : 400,
          color: value === p ? '#fff' : MUTED,
          backgroundColor: value === p ? FOREST_MID : 'transparent',
          border: `1px solid ${value === p ? FOREST_MID : SAND_LIGHT}`,
          cursor: 'pointer', lineHeight: 1,
        }}>{p}</button>
      ))}
    </div>
  )
}

// ─── Tee shot selector ─────────────────────────────────────────────────────
const TEE_OPTS: { id: Exclude<TeeShot, null>; color: string }[] = [
  { id: 'FW',  color: FOREST_MID },
  { id: '左',  color: BOGEY_AMB },
  { id: '右',  color: BOGEY_AMB },
  { id: 'OB',  color: TERRACOTTA },
  { id: '池',  color: POND_BLUE },
]

function TeeShotSel({ value, onChange }: { value: TeeShot; onChange: (t: TeeShot) => void }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {TEE_OPTS.map(({ id, color }) => {
        const on = value === id
        return (
          <button key={id} onClick={() => onChange(on ? null : id)} style={{
            padding: '3px 8px', borderRadius: '5px', fontSize: '11px',
            fontWeight: on ? 700 : 500,
            color: on ? '#fff' : color,
            backgroundColor: on ? color : `${color}12`,
            border: `1px solid ${color}50`,
            cursor: 'pointer',
          }}>{id}</button>
        )
      })}
    </div>
  )
}

// ─── Hole card ─────────────────────────────────────────────────────────────
function HoleCard({ hole, idx, onChange }: {
  hole: HoleData; idx: number; onChange: (h: HoleData) => void
}) {
  const [memoOpen, setMemoOpen] = useState(false)
  const diff = hole.score - hole.par
  const dc   = diffColor(diff)

  return (
    <div style={{ backgroundColor: CARD, borderRadius: '10px', border: `1px solid ${SAND_LIGHT}`, overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', backgroundColor: `${FOREST}07`, borderBottom: `1px solid ${SAND_LIGHT}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: FOREST, minWidth: '26px' }}>H{idx + 1}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '10px', color: MUTED }}>Par</span>
            <ParSelector value={hole.par} onChange={(p) => onChange({ ...hole, par: p })} />
          </div>
        </div>
        <div style={{ backgroundColor: `${dc}1A`, borderRadius: '6px', padding: '2px 9px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: dc }}>{diffLabel(hole.score, hole.par)}</span>
        </div>
      </div>

      {/* Inputs */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: MUTED, width: '36px' }}>スコア</span>
            <Stepper value={hole.score} min={1} max={14} onChange={(n) => onChange({ ...hole, score: n })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: MUTED, width: '30px' }}>パット</span>
            <Stepper value={hole.putts} min={0} max={6} onChange={(n) => onChange({ ...hole, putts: n })} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: MUTED, width: '36px', flexShrink: 0 }}>ティー</span>
          <TeeShotSel value={hole.teeShot} onChange={(t) => onChange({ ...hole, teeShot: t })} />
        </div>

        {memoOpen ? (
          <input type="text" placeholder="ホールメモ（任意）" value={hole.memo}
            onChange={(e) => onChange({ ...hole, memo: e.target.value })}
            style={{ marginTop: '8px', width: '100%', padding: '7px 10px', borderRadius: '6px', border: `1px solid ${SAND_LIGHT}`, backgroundColor: CREAM, fontSize: '12px', color: INK, outline: 'none', fontFamily: 'inherit' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
            onBlur={(e) => (e.currentTarget.style.borderColor = SAND_LIGHT)}
          />
        ) : (
          <button onClick={() => setMemoOpen(true)}
            style={{ marginTop: '7px', fontSize: '11px', color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            + メモを追加
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Live score summary ────────────────────────────────────────────────────
function ScoreSummary({ holes, target }: { holes: HoleData[]; target: number }) {
  const front = stats(holes.slice(0, 9))
  const back  = stats(holes.slice(9))
  const all   = stats(holes)
  const diff  = all.score - all.par

  return (
    <div style={{ backgroundColor: FOREST, borderRadius: '12px', padding: '16px', boxShadow: `0 4px 16px ${FOREST}45` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '14px' }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', letterSpacing: '0.1em', marginBottom: '4px' }}>合計スコア</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '42px', fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>{all.score}</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: diffColor(diff) }}>{diffLabel(all.score, all.par)}</span>
          </div>
          {target > 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>
              目標 {target}　{all.score <= target ? '✓ 達成' : `あと ${all.score - target} 打`}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '18px' }}>
          {[
            { label: 'パット', v: all.putts, warn: false },
            { label: 'FW',    v: all.fws,   warn: false },
            { label: 'OB',    v: all.obs,   warn: all.obs > 0 },
          ].map(({ label, v, warn }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '21px', fontWeight: 700, color: warn ? '#FFA5A5' : 'rgba(255,255,255,0.95)' }}>{v}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '1px' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {[
          { label: '前半 1–9H', s: front },
          { label: '後半 10–18H', s: back },
        ].map(({ label, s }) => {
          const d = s.score - s.par
          return (
            <div key={label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '9px 10px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{s.score}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: diffColor(d) }}>{diffLabel(s.score, s.par)}</span>
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                {s.putts}パット · FW {s.fws}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Scorecard table (used in history) ─────────────────────────────────────
function Scorecard({ holes, range }: { holes: HoleData[]; range: [number, number] }) {
  const slice = holes.slice(range[0], range[1])
  const totalPar   = slice.reduce((s, h) => s + h.par,   0)
  const totalScore = slice.reduce((s, h) => s + h.score, 0)

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '11px', minWidth: '100%' }}>
        <thead>
          <tr>
            <th style={{ padding: '3px 6px', color: MUTED, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>H</th>
            {slice.map((_, i) => (
              <th key={i} style={{ padding: '3px 5px', color: MUTED, fontWeight: 600, textAlign: 'center', minWidth: '22px' }}>
                {range[0] + i + 1}
              </th>
            ))}
            <th style={{ padding: '3px 5px', color: MUTED, fontWeight: 700, textAlign: 'center' }}>計</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '3px 6px', color: MUTED, fontWeight: 600, whiteSpace: 'nowrap' }}>Par</td>
            {slice.map((h, i) => (
              <td key={i} style={{ padding: '3px 5px', textAlign: 'center', color: MUTED }}>{h.par}</td>
            ))}
            <td style={{ padding: '3px 5px', textAlign: 'center', color: MUTED, fontWeight: 700 }}>{totalPar}</td>
          </tr>
          <tr style={{ backgroundColor: `${FOREST}08` }}>
            <td style={{ padding: '3px 6px', color: FOREST, fontWeight: 700, whiteSpace: 'nowrap' }}>Score</td>
            {slice.map((h, i) => {
              const d = h.score - h.par
              return (
                <td key={i} style={{ padding: '3px 5px', textAlign: 'center', fontWeight: 700, color: diffColor(d) }}>
                  {h.score}
                </td>
              )
            })}
            <td style={{ padding: '3px 5px', textAlign: 'center', fontWeight: 700, color: FOREST }}>{totalScore}</td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', color: MUTED, fontWeight: 600, whiteSpace: 'nowrap' }}>Putt</td>
            {slice.map((h, i) => (
              <td key={i} style={{ padding: '3px 5px', textAlign: 'center', color: MUTED }}>{h.putts}</td>
            ))}
            <td style={{ padding: '3px 5px', textAlign: 'center', color: MUTED, fontWeight: 600 }}>
              {slice.reduce((s, h) => s + h.putts, 0)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '3px 6px', color: MUTED, fontWeight: 600, whiteSpace: 'nowrap' }}>Tee</td>
            {slice.map((h, i) => {
              const ts = h.teeShot
              const c = ts === 'FW' ? FOREST_MID : ts === 'OB' || ts === '池' ? TERRACOTTA : ts ? BOGEY_AMB : MUTED
              return (
                <td key={i} style={{ padding: '3px 5px', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: c }}>
                  {ts ?? '–'}
                </td>
              )
            })}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Tee shot tendency chart ───────────────────────────────────────────────
function TeeShotChart({ holes }: { holes: HoleData[] }) {
  const total18 = holes.length
  const counts: Record<string, number> = { FW: 0, '左': 0, '右': 0, OB: 0, '池': 0 }
  holes.forEach(h => { if (h.teeShot) counts[h.teeShot]++ })
  const noShot = holes.filter(h => !h.teeShot).length

  const items = [
    { id: 'FW',  color: FOREST_MID, label: 'FW' },
    { id: '左',  color: BOGEY_AMB,  label: '左' },
    { id: '右',  color: BOGEY_AMB,  label: '右' },
    { id: 'OB',  color: TERRACOTTA, label: 'OB' },
    { id: '池',  color: POND_BLUE,  label: '池' },
  ]

  return (
    <div style={{ backgroundColor: `${FOREST}07`, borderRadius: '8px', padding: '11px 12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: FOREST, marginBottom: '10px' }}>ティーショット傾向</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {items.map(({ id, color, label }) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: `${color}12`, borderRadius: '6px', padding: '5px 10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color }}>{label}</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: INK }}>{counts[id]}</span>
            <span style={{ fontSize: '10px', color: MUTED }}>回</span>
          </div>
        ))}
        {noShot > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: `${MUTED}12`, borderRadius: '6px', padding: '5px 10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: MUTED }}>未記録</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: MUTED }}>{noShot}</span>
          </div>
        )}
      </div>

      {/* FW bar */}
      {total18 > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: MUTED, marginBottom: '4px' }}>
            <span>FW キープ率</span>
            <span style={{ fontWeight: 700, color: FOREST }}>{Math.round((counts['FW'] / total18) * 100)}%</span>
          </div>
          <div style={{ height: '5px', backgroundColor: SAND_LIGHT, borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(counts['FW'] / total18) * 100}%`, backgroundColor: FOREST_MID, borderRadius: '3px' }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── History item ──────────────────────────────────────────────────────────
function HistoryItem({ log, onDelete }: { log: RoundLog; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const all   = stats(log.holes)
  const diff  = all.score - all.par
  const vsTarget = all.score - log.targetScore

  const statCols = [
    { label: '目標比',  value: `${vsTarget >= 0 ? '+' : ''}${vsTarget}` },
    { label: 'パット',  value: String(all.putts) },
    { label: 'OB',      value: String(all.obs) },
    { label: 'FW率',    value: `${Math.round((all.fws / 18) * 100)}%` },
  ]

  return (
    <div style={{ backgroundColor: CARD, borderRadius: '10px', border: `1px solid ${SAND_LIGHT}`, overflow: 'hidden' }}>
      {/* Top: course + score */}
      <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: INK, marginBottom: '3px' }}>
            {log.courseName || 'コース未記入'}
          </div>
          <div style={{ fontSize: '12px', color: MUTED }}>
            {formatDate(log.date)}{log.weather ? `　${log.weather}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: FOREST, lineHeight: 1 }}>{all.score}</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: diffColor(diff), marginTop: '2px' }}>
            {diffLabel(all.score, all.par)}
          </div>
        </div>
      </div>

      {/* Stats row (always visible) */}
      <div style={{ display: 'flex', borderTop: `1px solid ${SAND_LIGHT}` }}>
        {statCols.map(({ label, value }, i) => (
          <div key={label} style={{ flex: 1, textAlign: 'center', padding: '9px 4px', borderLeft: i > 0 ? `1px solid ${SAND_LIGHT}` : 'none' }}>
            <div style={{ fontSize: '10px', color: MUTED, marginBottom: '2px' }}>{label}</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: INK }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: open ? `${FOREST}07` : 'none', border: 'none', borderTop: `1px solid ${SAND_LIGHT}`, cursor: 'pointer', color: MUTED, fontSize: '11px' }}
      >
        {open ? 'スコアカードを閉じる' : 'スコアカードを見る'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {/* Expanded: scorecard + tendency + delete */}
      {open && (
        <div style={{ padding: '14px', borderTop: `1px solid ${SAND_LIGHT}` }}>
          <div style={{ marginBottom: '5px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.05em', marginBottom: '7px' }}>前半</div>
            <Scorecard holes={log.holes} range={[0, 9]} />
          </div>
          <div style={{ marginTop: '12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.05em', marginBottom: '7px' }}>後半</div>
            <Scorecard holes={log.holes} range={[9, 18]} />
          </div>
          <TeeShotChart holes={log.holes} />
          <button onClick={onDelete}
            style={{ marginTop: '12px', fontSize: '11px', color: TERRACOTTA, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            この記録を削除
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Input field helper ────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: FOREST }}>{label}</span>
        {required && <span style={{ fontSize: '10px', color: TERRACOTTA, fontWeight: 600 }}>必須</span>}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM,
  color: INK, fontSize: '14px', outline: 'none', fontFamily: 'inherit',
}

// ─── Divider ───────────────────────────────────────────────────────────────
function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 2px' }}>
      <div style={{ flex: 1, height: '1px', backgroundColor: SAND_LIGHT }} />
      <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: '1px', backgroundColor: SAND_LIGHT }} />
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function RoundPage() {
  const [formKey, setFormKey]       = useState(0)
  const [date, setDate]             = useState(todayStr)
  const [courseName, setCourseName] = useState('')
  const [weather, setWeather]       = useState('')
  const [target, setTarget]         = useState(90)
  const [holes, setHoles]           = useState<HoleData[]>(mkHoles)
  const [logs, setLogs]             = useState<RoundLog[]>([])
  const [successSheet, setSuccessSheet] = useState(false)

  useEffect(() => {
    let parsed: RoundLog[] = []
    try {
      const raw = localStorage.getItem(ROUND_KEY)
      if (raw) parsed = JSON.parse(raw)
    } catch {}
    startTransition(() => setLogs(parsed))
  }, [])

  function updateHole(i: number, h: HoleData) {
    setHoles(prev => { const next = [...prev]; next[i] = h; return next })
  }

  function save() {
    const entry: RoundLog = {
      id: `${Date.now()}`, date, courseName, weather, targetScore: target,
      holes, savedAt: new Date().toISOString(),
    }
    const updated = [entry, ...logs]
    setLogs(updated)
    localStorage.setItem(ROUND_KEY, JSON.stringify(updated))

    setDate(todayStr()); setCourseName(''); setWeather(''); setTarget(90)
    setHoles(mkHoles()); setFormKey(k => k + 1)
    setSuccessSheet(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function del(id: string) {
    const updated = logs.filter(l => l.id !== id)
    setLogs(updated); localStorage.setItem(ROUND_KEY, JSON.stringify(updated))
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', backgroundColor: CREAM }}>

      {/* Header */}
      <header style={{ backgroundColor: FOREST, padding: '52px 20px 22px' }}>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', letterSpacing: '0.28em', marginBottom: '8px', fontWeight: 400, fontFamily: "Georgia, 'Times New Roman', serif" }}>GOLF LOOP</div>
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>ラウンド記録</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', margin: '4px 0 0' }}>18ホールのスコアを記録する</p>
      </header>

      {/* Success Sheet */}
      {successSheet && (
        <>
          <div onClick={() => setSuccessSheet(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '480px', zIndex: 201,
            backgroundColor: '#FFFFFF', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px', boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: `${FOREST}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#1C1C1C' }}>ラウンドを保存しました</div>
              <div style={{ fontSize: '13px', color: '#6B7060', marginTop: '4px' }}>続けて何をしますか？</div>
            </div>
            <Link href="/analysis" onClick={() => setSuccessSheet(false)} style={{
              display: 'block', textAlign: 'center', padding: '14px', borderRadius: '12px',
              backgroundColor: TERRACOTTA, color: '#fff', fontSize: '14px', fontWeight: 700,
              textDecoration: 'none', marginBottom: '16px',
            }}>今日の課題を見る</Link>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B7060', letterSpacing: '0.08em', marginBottom: '10px' }}>次のステップ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { href: '/analysis', label: 'スコアを分析する', sub: 'データから課題と改善ポイントを確認',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7A5800" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
                { href: '/practice', label: '練習ログを記録する', sub: '課題に向けた練習テーマを残す',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg> },
              ].map(({ href, label, sub, icon }) => (
                <Link key={href} href={href} onClick={() => setSuccessSheet(false)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                  backgroundColor: '#FAF8F0', borderRadius: '12px', textDecoration: 'none',
                  border: `1px solid #E8DFCE`,
                }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(28,66,48,0.1)' }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1C1C1C' }}>{label}</div>
                    <div style={{ fontSize: '12px', color: '#6B7060', marginTop: '2px' }}>{sub}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9,18 15,12 9,6" />
                  </svg>
                </Link>
              ))}
            </div>
            <button onClick={() => setSuccessSheet(false)} style={{
              marginTop: '14px', width: '100%', padding: '13px', borderRadius: '12px',
              border: `1.5px solid #E8DFCE`, background: 'none',
              fontSize: '14px', color: '#6B7060', cursor: 'pointer',
            }}>
              閉じる
            </button>
          </div>
        </>
      )}

      <main style={{ padding: '18px 16px 110px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Round info */}
        <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)', overflow: 'hidden' }}>
          <div style={{ height: '3px', backgroundColor: FOREST }} />
          <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, letterSpacing: '0.06em' }}>ラウンド情報</div>

            <Field label="ラウンド日" required>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                onBlur={(e) => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
            </Field>

            <Field label="コース名">
              <input type="text" placeholder="例：東急セブンハンドレッドクラブ" value={courseName}
                onChange={(e) => setCourseName(e.target.value)} style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                onBlur={(e) => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
            </Field>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <Field label="天気メモ">
                  <input type="text" placeholder="例：晴れ・微風" value={weather}
                    onChange={(e) => setWeather(e.target.value)} style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
                </Field>
              </div>
              <div style={{ width: '96px' }}>
                <Field label="目標スコア">
                  <input type="number" value={target} min={60} max={150}
                    onChange={(e) => setTarget(Number(e.target.value))}
                    style={{ ...inputStyle, textAlign: 'center' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* Live summary */}
        <ScoreSummary holes={holes} target={target} />

        {/* Front 9 */}
        <Divider label="前半　1〜9 ホール" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {holes.slice(0, 9).map((hole, i) => (
            <HoleCard key={`f${i}-${formKey}`} hole={hole} idx={i} onChange={(h) => updateHole(i, h)} />
          ))}
        </div>

        {/* Back 9 */}
        <Divider label="後半　10〜18 ホール" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {holes.slice(9).map((hole, i) => (
            <HoleCard key={`b${i}-${formKey}`} hole={hole} idx={i + 9} onChange={(h) => updateHole(i + 9, h)} />
          ))}
        </div>

        {/* Save */}
        <button onClick={save} style={{
          width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
          backgroundColor: FOREST, color: '#fff', fontSize: '15px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px', letterSpacing: '0.04em', boxShadow: `0 4px 16px ${FOREST}40`,
        }}
          onMouseDown={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseUp={(e) => (e.currentTarget.style.opacity = '1')}
          onTouchStart={(e) => (e.currentTarget.style.opacity = '0.85')}
          onTouchEnd={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
          </svg>
          ラウンドを保存する
        </button>

        {/* History */}
        {logs.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '10px', padding: '0 2px' }}>
              最近のラウンド
              <span style={{ fontSize: '11px', color: MUTED, fontWeight: 400, marginLeft: '6px' }}>全{logs.length}件</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {logs.slice(0, 3).map(log => (
                <HistoryItem key={log.id} log={log} onDelete={() => del(log.id)} />
              ))}
            </div>
            {logs.length > 3 && (
              <div style={{ marginTop: '10px', textAlign: 'center', fontSize: '12px', color: MUTED }}>
                他 {logs.length - 3} 件のラウンド記録
              </div>
            )}
          </div>
        )}

        {logs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: MUTED }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>⛳</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>まだ記録がありません</div>
            <div style={{ fontSize: '12px' }}>上のフォームからラウンドスコアを記録しましょう</div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
