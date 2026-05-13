'use client'

import { useState, useEffect, useRef, startTransition } from 'react'
import BottomNav from '../components/BottomNav'

// ─── Design tokens ──────────────────────────────────────────────────────────
const FOREST      = '#1C4230'
const FOREST_MID  = '#235C3E'
const FOREST_LIGHT= '#3A7D57'
const TERRACOTTA  = '#C0522D'
const CREAM       = '#FAF8F0'
const SAND_LIGHT  = '#E8DFCE'
const CARD        = '#FFFFFF'
const INK         = '#1C1C1C'
const MUTED       = '#6B7060'
const GOLD        = '#C9A824'

// ─── Types ──────────────────────────────────────────────────────────────────
type Club      = 'driver' | 'iron' | 'approach' | 'putter'
type Direction = '後方' | '正面' | '斜め'

type SwingVideo = {
  id:        string
  date:      string
  club:      Club
  direction: Direction
  fileName:  string
  fileSize:  string
  fileType:  string
  theme:     string
  good:      string
  fix:       string
  next:      string
  savedAt:   string
}

const SWING_KEY = 'golf-loop-swing-videos'

// ─── Club config ─────────────────────────────────────────────────────────────
const CLUB_CONFIG: Record<Club, { label: string; emoji: string; color: string; bg: string }> = {
  driver:   { label: 'ドライバー', emoji: '🏌️', color: FOREST,      bg: `${FOREST}12` },
  iron:     { label: 'アイアン',   emoji: '⛳',  color: FOREST_MID,  bg: `${FOREST_MID}12` },
  approach: { label: 'アプローチ', emoji: '🎯',  color: TERRACOTTA,  bg: `${TERRACOTTA}12` },
  putter:   { label: 'パター',     emoji: '🏁',  color: '#7A5800',   bg: '#7A580012' },
}

// ─── Direction config ─────────────────────────────────────────────────────────
const DIR_CONFIG: Record<Direction, { icon: string; color: string; bg: string }> = {
  '後方': { icon: '↑', color: FOREST_MID,  bg: `${FOREST_MID}12` },
  '正面': { icon: '→', color: '#1565C0',   bg: '#1565C012' },
  '斜め': { icon: '↗', color: '#7A5800',   bg: '#7A580012' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(s: string) {
  const [y, m, d] = s.split('-')
  const wd = ['日', '月', '火', '水', '木', '金', '土']
  return `${Number(m)}月${Number(d)}日（${wd[new Date(+y, +m - 1, +d).getDay()]}）`
}

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '–'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionCard({ accent, title, children }: {
  accent: string; title: string; children: React.ReactNode
}) {
  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)', overflow: 'hidden' }}>
      <div style={{ height: '3px', backgroundColor: accent }} />
      <div style={{ padding: '18px 16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, letterSpacing: '0.06em', marginBottom: '14px' }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function FieldWrap({ label, children, hint }: {
  label: string; children: React.ReactNode; hint?: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: FOREST }}>{label}</span>
        {hint && <span style={{ fontSize: '10px', color: MUTED }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const INPUT_S: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM,
  color: INK, fontSize: '14px', outline: 'none', fontFamily: 'inherit',
}

function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      style={INPUT_S}
      onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
      onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
  )
}

function AutoTA({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${ref.current.scrollHeight}px`
    }
  }, [value])
  return (
    <textarea ref={ref} rows={2} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...INPUT_S, minHeight: '68px', resize: 'none', lineHeight: 1.65, overflowY: 'hidden' }}
      onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
      onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
  )
}

// Club badge (read-only display)
function ClubBadge({ club }: { club: Club }) {
  const cfg = CLUB_CONFIG[club]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
      color: cfg.color, backgroundColor: cfg.bg, borderRadius: '5px', padding: '3px 8px' }}>
      <span style={{ fontSize: '12px' }}>{cfg.emoji}</span>{cfg.label}
    </span>
  )
}

// Direction badge (read-only display)
function DirBadge({ dir }: { dir: Direction }) {
  const cfg = DIR_CONFIG[dir]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
      color: cfg.color, backgroundColor: cfg.bg, borderRadius: '5px', padding: '3px 8px' }}>
      <span style={{ fontSize: '12px' }}>{cfg.icon}</span>{dir}
    </span>
  )
}

// Video file selector
function FilePicker({ fileName, onSelect }: {
  fileName: string
  onSelect: (name: string, size: string, type: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasFile = !!fileName

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onSelect(file.name, fmtBytes(file.size), file.type)
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="video/*,video/mp4,video/mov,video/quicktime"
        style={{ display: 'none' }} onChange={handleChange} />
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%', padding: '16px 14px', borderRadius: '10px',
          border: `2px dashed ${hasFile ? FOREST_LIGHT : SAND_LIGHT}`,
          backgroundColor: hasFile ? `${FOREST}07` : CREAM,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
          transition: 'all 0.15s',
        }}
      >
        <div style={{
          flexShrink: 0, width: '40px', height: '40px', borderRadius: '10px',
          backgroundColor: hasFile ? `${FOREST_LIGHT}20` : SAND_LIGHT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {hasFile ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={FOREST_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23,7 16,12 23,17 23,7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17,8 12,3 7,8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          {hasFile ? (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, color: FOREST, marginBottom: '2px' }}>{fileName}</div>
              <div style={{ fontSize: '11px', color: MUTED }}>タップして変更</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '13px', fontWeight: 600, color: INK, marginBottom: '2px' }}>動画を選択</div>
              <div style={{ fontSize: '11px', color: MUTED }}>MP4 / MOV 対応</div>
            </>
          )}
        </div>
        {hasFile && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FOREST_LIGHT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        )}
      </button>
      <div style={{ marginTop: '6px', fontSize: '10px', color: MUTED, paddingLeft: '2px' }}>
        ※ ファイル名・サイズのみ記録します。動画はデバイス内に保存されます。
      </div>
    </div>
  )
}

// History item
function SwingItem({ video, onDelete }: { video: SwingVideo; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const details = [
    { label: '今日のテーマ',   value: video.theme, mark: '📌' },
    { label: '良かった点',    value: video.good,  mark: '◎' },
    { label: '修正したい点',  value: video.fix,   mark: '△' },
    { label: '次回意識すること', value: video.next, mark: '▶' },
  ].filter(d => d.value)

  return (
    <div style={{ backgroundColor: CARD, borderRadius: '10px', border: `1px solid ${SAND_LIGHT}`, overflow: 'hidden' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', padding: '12px 14px', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '8px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges row */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '7px' }}>
            <ClubBadge club={video.club} />
            <DirBadge dir={video.direction} />
            {video.fileName && (
              <span style={{ fontSize: '10px', color: MUTED, backgroundColor: SAND_LIGHT, borderRadius: '4px', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23,7 16,12 23,17 23,7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                動画あり
              </span>
            )}
          </div>

          {/* Date + theme */}
          <div style={{ fontSize: '12px', fontWeight: 600, color: INK }}>{formatDate(video.date)}</div>
          {video.theme && (
            <div style={{ fontSize: '12px', color: MUTED, marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {video.theme}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginTop: '2px' }}>
          {details.length > 0 && (
            <span style={{ fontSize: '10px', color: MUTED }}>{details.length}項目</span>
          )}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </div>
      </button>

      {open && (
        <div style={{ padding: '12px 14px 14px', borderTop: `1px solid ${SAND_LIGHT}` }}>
          {/* File info */}
          {video.fileName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 10px', backgroundColor: `${FOREST}07`, borderRadius: '7px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FOREST_MID} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23,7 16,12 23,17 23,7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: FOREST_MID }}>{video.fileName}</div>
                {video.fileSize && <div style={{ fontSize: '10px', color: MUTED }}>{video.fileSize}</div>}
              </div>
            </div>
          )}

          {/* Memo fields */}
          {details.map(({ label, value, mark }) => (
            <div key={label} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                <span style={{ fontSize: '11px' }}>{mark}</span>
                <span style={{ fontSize: '10px', color: MUTED, fontWeight: 600 }}>{label}</span>
              </div>
              <div style={{ fontSize: '13px', color: INK, lineHeight: 1.65, paddingLeft: '16px' }}>{value}</div>
            </div>
          ))}

          <button onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{ marginTop: '4px', fontSize: '11px', color: TERRACOTTA, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            この記録を削除
          </button>
        </div>
      )}
    </div>
  )
}

// AI preview card
function AIPreviewCard() {
  const features = [
    { icon: '🎯', title: 'スイング軌道解析', desc: 'クラブヘッドの軌跡を自動トレース', soon: true },
    { icon: '⚡', title: 'インパクト瞬間検出', desc: '最重要フレームを自動クリップ', soon: true },
    { icon: '📊', title: 'フォームスコアリング', desc: '100点満点で毎回採点', soon: true },
    { icon: '🔄', title: 'ビフォーアフター比較', desc: '成長の変化をタイムラインで可視化', soon: true },
    { icon: '🏆', title: 'プロ比較モード', desc: 'アドレス・インパクト・フォローを重ね表示', soon: true },
  ]

  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 16px rgba(28,66,48,0.08)' }}>
      {/* Gradient header */}
      <div style={{ background: `linear-gradient(135deg, ${FOREST} 0%, #2D6B45 50%, ${FOREST_MID} 100%)`, padding: '18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>AI スイング解析</span>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: GOLD, backgroundColor: `${GOLD}25`, borderRadius: '20px', padding: '3px 10px', letterSpacing: '0.08em' }}>
            準備中
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.6 }}>
          動画を記録しておくと、AI解析機能のリリース時にすぐに活用できます。
        </p>
      </div>

      {/* Features list */}
      <div style={{ padding: '4px 0 4px' }}>
        {features.map(({ icon, title, desc }, i) => (
          <div key={title} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px',
            borderBottom: i < features.length - 1 ? `1px solid ${SAND_LIGHT}` : 'none',
            opacity: 0.75,
          }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9px', backgroundColor: `${FOREST}0A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: INK, marginBottom: '2px' }}>{title}</div>
              <div style={{ fontSize: '11px', color: MUTED }}>{desc}</div>
            </div>
            <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: MUTED, backgroundColor: SAND_LIGHT, borderRadius: '3px', padding: '2px 5px', letterSpacing: '0.06em' }}>
                SOON
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ margin: '0 16px 14px', padding: '10px 12px', backgroundColor: `${GOLD}0E`, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style={{ fontSize: '11px', color: '#7A5800', lineHeight: 1.5 }}>
          今から動画を記録しておくと、リリース時に過去データも一括解析できます。
        </span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SwingPage() {
  const [date,      setDate]      = useState(todayStr)
  const [club,      setClub]      = useState<Club>('driver')
  const [direction, setDirection] = useState<Direction>('後方')
  const [fileName,  setFileName]  = useState('')
  const [fileSize,  setFileSize]  = useState('')
  const [fileType,  setFileType]  = useState('')
  const [theme,     setTheme]     = useState('')
  const [good,      setGood]      = useState('')
  const [fix,       setFix]       = useState('')
  const [next,      setNext]      = useState('')
  const [videos,    setVideos]    = useState<SwingVideo[]>([])
  const [toast,     setToast]     = useState(false)
  const [error,     setError]     = useState('')
  const [formKey,   setFormKey]   = useState(0)

  useEffect(() => {
    let parsed: SwingVideo[] = []
    try {
      const raw = localStorage.getItem(SWING_KEY)
      if (raw) parsed = JSON.parse(raw)
    } catch {}
    startTransition(() => setVideos(parsed))
  }, [])

  function handleSave() {
    if (!theme && !good && !fix && !next && !fileName) {
      setError('テーマまたはメモを少なくとも1項目入力してください')
      return
    }
    setError('')

    const entry: SwingVideo = {
      id: `${Date.now()}`, date, club, direction,
      fileName, fileSize, fileType, theme, good, fix, next,
      savedAt: new Date().toISOString(),
    }
    const updated = [entry, ...videos]
    setVideos(updated)
    localStorage.setItem(SWING_KEY, JSON.stringify(updated))

    setDate(todayStr()); setClub('driver'); setDirection('後方')
    setFileName(''); setFileSize(''); setFileType('')
    setTheme(''); setGood(''); setFix(''); setNext('')
    setFormKey(k => k + 1)
    setToast(true)
    setTimeout(() => setToast(false), 2500)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleDelete(id: string) {
    const updated = videos.filter(v => v.id !== id)
    setVideos(updated)
    localStorage.setItem(SWING_KEY, JSON.stringify(updated))
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', backgroundColor: CREAM }}>

      {/* Header */}
      <header style={{ backgroundColor: FOREST, padding: '52px 20px 22px' }}>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', letterSpacing: '0.28em', marginBottom: '8px', fontWeight: 400, fontFamily: "Georgia, 'Times New Roman', serif" }}>GOLF LOOP</div>
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>スイング</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', margin: '4px 0 0' }}>動画記録とフォーム改善メモ</p>
      </header>

      {/* Toast */}
      <div style={{
        position: 'fixed', top: toast ? '16px' : '-60px', left: '50%',
        transform: 'translateX(-50%)', zIndex: 100, backgroundColor: FOREST,
        color: '#fff', fontSize: '13px', fontWeight: 500, borderRadius: '24px',
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)', transition: 'top 0.3s ease', whiteSpace: 'nowrap',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7ECB9E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20,6 9,17 4,12" />
        </svg>
        スイング記録を保存しました
      </div>

      <main style={{ padding: '18px 16px 110px', display: 'flex', flexDirection: 'column', gap: '14px' }} key={formKey}>

        {/* ─── Section 1: 撮影情報 ─── */}
        <SectionCard accent={FOREST} title="撮影情報">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Date */}
            <FieldWrap label="撮影日">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={INPUT_S}
                onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
            </FieldWrap>

            {/* Club */}
            <FieldWrap label="クラブ">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(Object.entries(CLUB_CONFIG) as [Club, typeof CLUB_CONFIG[Club]][]).map(([id, cfg]) => {
                  const active = club === id
                  return (
                    <button key={id} onClick={() => setClub(id)} style={{
                      padding: '10px', borderRadius: '10px',
                      border: `1.5px solid ${active ? cfg.color : SAND_LIGHT}`,
                      backgroundColor: active ? cfg.bg : CARD,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: '18px' }}>{cfg.emoji}</span>
                      <span style={{ fontSize: '12px', fontWeight: active ? 700 : 400, color: active ? cfg.color : INK }}>{cfg.label}</span>
                      {active && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                          <polyline points="20,6 9,17 4,12" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </FieldWrap>

            {/* Direction */}
            <FieldWrap label="撮影方向">
              <div style={{ display: 'flex', gap: '8px' }}>
                {(Object.entries(DIR_CONFIG) as [Direction, typeof DIR_CONFIG[Direction]][]).map(([id, cfg]) => {
                  const active = direction === id
                  return (
                    <button key={id} onClick={() => setDirection(id)} style={{
                      flex: 1, padding: '10px 6px', borderRadius: '10px',
                      border: `1.5px solid ${active ? cfg.color : SAND_LIGHT}`,
                      backgroundColor: active ? cfg.bg : CARD,
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'all 0.15s',
                    }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: active ? cfg.color : SAND_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: active ? '#fff' : MUTED }}>{cfg.icon}</span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: active ? 700 : 400, color: active ? cfg.color : INK }}>{id}</span>
                    </button>
                  )
                })}
              </div>
            </FieldWrap>

            {/* File picker */}
            <FieldWrap label="動画ファイル" hint="（任意）">
              <FilePicker
                fileName={fileName}
                onSelect={(name, size, type) => { setFileName(name); setFileSize(size); setFileType(type) }}
              />
            </FieldWrap>
          </div>
        </SectionCard>

        {/* ─── Section 2: フォームメモ ─── */}
        <SectionCard accent={TERRACOTTA} title="フォーム改善メモ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && (
              <div style={{ fontSize: '12px', color: TERRACOTTA, padding: '8px 12px', backgroundColor: `${TERRACOTTA}10`, borderRadius: '7px' }}>
                {error}
              </div>
            )}

            <FieldWrap label="今日のフォームテーマ">
              <TextInput value={theme} onChange={setTheme} placeholder="例：下半身リード、テイクバックを低く" />
            </FieldWrap>

            <FieldWrap label="良かった点">
              <AutoTA value={good} onChange={setGood} placeholder="例：インパクトの手の形が安定していた" />
            </FieldWrap>

            <FieldWrap label="修正したい点">
              <AutoTA value={fix} onChange={setFix} placeholder="例：バックスイングで右肘が外れる" />
            </FieldWrap>

            <FieldWrap label="次回意識すること">
              <AutoTA value={next} onChange={setNext} placeholder="例：右膝を内側に保ちながら回転する" />
            </FieldWrap>
          </div>
        </SectionCard>

        {/* ─── Save button ─── */}
        <button onClick={handleSave} style={{
          width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
          backgroundColor: FOREST, color: '#fff', fontSize: '15px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px', letterSpacing: '0.04em', boxShadow: `0 4px 16px ${FOREST}40`,
        }}
          onMouseDown={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseUp={(e)   => (e.currentTarget.style.opacity = '1')}
          onTouchStart={(e)=> (e.currentTarget.style.opacity = '0.85')}
          onTouchEnd={(e)  => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
          </svg>
          保存する
        </button>

        {/* ─── AI Preview ─── */}
        <AIPreviewCard />

        {/* ─── History ─── */}
        {videos.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '10px', padding: '0 2px' }}>
              スイング記録
              <span style={{ fontSize: '11px', color: MUTED, fontWeight: 400, marginLeft: '6px' }}>全{videos.length}件</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {videos.slice(0, 5).map(v => (
                <SwingItem key={v.id} video={v} onDelete={() => handleDelete(v.id)} />
              ))}
            </div>
            {videos.length > 5 && (
              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: MUTED }}>
                他 {videos.length - 5} 件の記録
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {videos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: MUTED }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎬</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>まだ記録がありません</div>
            <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
              スイング動画のファイル名と改善メモを記録して<br />フォーム改善サイクルを始めましょう
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
