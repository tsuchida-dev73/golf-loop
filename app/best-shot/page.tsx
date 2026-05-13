'use client'

import { useState, useEffect, useRef, startTransition } from 'react'
import Link from 'next/link'
import BottomNav from '../components/BottomNav'

// ─── Design tokens ───────────────────────────────────────────────────────────
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

// ─── Types ───────────────────────────────────────────────────────────────────
type ShotType = 'teeShot' | 'iron' | 'approach' | 'putter' | 'recovery'
type Mood     = '最高' | 'よかった' | '成長実感' | 'しびれた'

type BestShot = {
  id:             string
  date:           string
  courseName:     string
  hole:           string
  club:           string
  shotType:       ShotType | ''
  memo:           string
  whyGood:        string
  reproducePoint: string
  mood:           Mood | ''
  savedAt:        string
}

const BEST_SHOT_KEY = 'golf-loop-best-shots'

const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  teeShot:  'ティーショット',
  iron:     'アイアン',
  approach: 'アプローチ',
  putter:   'パター',
  recovery: 'リカバリー',
}

type MoodCfg = { label: string; color: string; bg: string }
const MOOD_CONFIG: Record<Mood, MoodCfg> = {
  '最高':    { label: '最高！',   color: GOLD,         bg: `${GOLD}18` },
  'よかった': { label: 'よかった', color: FOREST_LIGHT, bg: `${FOREST_LIGHT}18` },
  '成長実感': { label: '成長実感', color: FOREST_MID,   bg: `${FOREST_MID}15` },
  'しびれた': { label: 'しびれた', color: TERRACOTTA,   bg: `${TERRACOTTA}15` },
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

function topBarColor(mood: Mood | '') {
  if (mood === '最高')    return GOLD
  if (mood === 'しびれた') return TERRACOTTA
  if (mood === '成長実感') return FOREST_MID
  if (mood === 'よかった') return FOREST_LIGHT
  return SAND_LIGHT
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM,
  color: INK, fontSize: '14px', outline: 'none', fontFamily: 'inherit',
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: FOREST }}>{children}</span>
      {required && <span style={{ fontSize: '10px', color: TERRACOTTA, fontWeight: 600 }}>必須</span>}
    </div>
  )
}

function AutoTA({ value, onChange, placeholder, rows = 2 }: {
  value: string; onChange: (v: string) => void; placeholder: string; rows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${ref.current.scrollHeight}px`
    }
  }, [value])
  return (
    <textarea ref={ref} rows={rows} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...INPUT_STYLE, minHeight: `${rows * 36}px`, resize: 'none', lineHeight: 1.65, overflowY: 'hidden' }}
      onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
      onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
  )
}

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

function ShotCard({ shot, onDelete }: { shot: BestShot; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const moodCfg = shot.mood ? MOOD_CONFIG[shot.mood as Mood] : null

  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', border: `1px solid ${SAND_LIGHT}`, overflow: 'hidden' }}>
      <div style={{ height: '3px', backgroundColor: topBarColor(shot.mood as Mood | '') }} />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '7px' }}>
              {moodCfg && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: moodCfg.color,
                  backgroundColor: moodCfg.bg, borderRadius: '4px', padding: '2px 7px' }}>
                  {moodCfg.label}
                </span>
              )}
              {shot.shotType && (
                <span style={{ fontSize: '11px', color: FOREST_MID, backgroundColor: `${FOREST}0D`,
                  borderRadius: '4px', padding: '2px 7px', fontWeight: 500 }}>
                  {SHOT_TYPE_LABELS[shot.shotType as ShotType]}
                </span>
              )}
              {shot.club && (
                <span style={{ fontSize: '11px', color: MUTED, backgroundColor: CREAM,
                  borderRadius: '4px', padding: '2px 7px', border: `1px solid ${SAND_LIGHT}` }}>
                  {shot.club}
                </span>
              )}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: INK, lineHeight: 1.5, marginBottom: '4px' }}>
              {shot.memo || '（メモなし）'}
            </div>
            <div style={{ fontSize: '11px', color: MUTED }}>
              {formatDate(shot.date)}
              {shot.courseName ? `　${shot.courseName}` : ''}
              {shot.hole ? `　${shot.hole}H` : ''}
            </div>
          </div>
          <button onClick={() => setConfirm(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
              <path d="M10,11v6"/><path d="M14,11v6"/>
            </svg>
          </button>
        </div>

        {shot.whyGood && (
          <div style={{ fontSize: '13px', color: FOREST_MID, lineHeight: 1.6, marginTop: '6px' }}>
            ✓ {shot.whyGood}
          </div>
        )}
        {shot.reproducePoint && (
          <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6,
            borderTop: `1px solid ${SAND_LIGHT}`, paddingTop: '8px', marginTop: '8px' }}>
            再現：{shot.reproducePoint}
          </div>
        )}

        {confirm && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: `${TERRACOTTA}08`,
            borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: TERRACOTTA, flex: 1 }}>このショットを削除しますか？</span>
            <button onClick={onDelete} style={{
              fontSize: '12px', fontWeight: 700, color: '#fff',
              backgroundColor: TERRACOTTA, border: 'none', borderRadius: '6px',
              padding: '5px 12px', cursor: 'pointer',
            }}>削除</button>
            <button onClick={() => setConfirm(false)} style={{
              fontSize: '12px', color: MUTED, background: 'none', border: 'none', cursor: 'pointer',
            }}>キャンセル</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function BestShotPage() {
  const [date,           setDate]           = useState(todayStr)
  const [courseName,     setCourseName]     = useState('')
  const [hole,           setHole]           = useState('')
  const [club,           setClub]           = useState('')
  const [shotType,       setShotType]       = useState<ShotType | ''>('')
  const [memo,           setMemo]           = useState('')
  const [whyGood,        setWhyGood]        = useState('')
  const [reproducePoint, setReproducePoint] = useState('')
  const [mood,           setMood]           = useState<Mood | ''>('')
  const [shots,          setShots]          = useState<BestShot[]>([])
  const [successSheet,   setSuccessSheet]   = useState(false)

  useEffect(() => {
    let parsed: BestShot[] = []
    try {
      const raw = localStorage.getItem(BEST_SHOT_KEY)
      if (raw) parsed = JSON.parse(raw)
    } catch {}
    startTransition(() => setShots(parsed))
  }, [])

  function resetForm() {
    setDate(todayStr())
    setCourseName(''); setHole(''); setClub(''); setShotType('')
    setMemo(''); setWhyGood(''); setReproducePoint(''); setMood('')
  }

  function handleSave() {
    if (!memo.trim()) return
    const entry: BestShot = {
      id: `${Date.now()}`,
      date, courseName, hole, club, shotType, memo, whyGood, reproducePoint, mood,
      savedAt: new Date().toISOString(),
    }
    const updated = [entry, ...shots]
    setShots(updated)
    localStorage.setItem(BEST_SHOT_KEY, JSON.stringify(updated))
    resetForm()
    setSuccessSheet(true)
  }

  function handleDelete(id: string) {
    const updated = shots.filter(s => s.id !== id)
    setShots(updated)
    localStorage.setItem(BEST_SHOT_KEY, JSON.stringify(updated))
  }

  const canSave = memo.trim().length > 0

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', backgroundColor: CREAM }}>

      {/* Header */}
      <header style={{ backgroundColor: FOREST, padding: '52px 20px 22px' }}>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', letterSpacing: '0.28em', marginBottom: '8px', fontFamily: "Georgia, 'Times New Roman', serif" }}>
          GOLF LOOP
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: `${GOLD}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
            </svg>
          </div>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
            ベストショット記録
          </h1>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', margin: 0 }}>
          良かったショットと気づきを残す
        </p>
      </header>

      {/* Success Sheet */}
      {successSheet && (
        <>
          <div onClick={() => setSuccessSheet(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '480px', zIndex: 201,
            backgroundColor: CARD, borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px', boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%',
                backgroundColor: `${GOLD}18`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                </svg>
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: INK }}>保存しました！</div>
              <div style={{ fontSize: '13px', color: MUTED, marginTop: '4px' }}>良いショットが積み重なっています</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => setSuccessSheet(false)} style={{
                padding: '14px', borderRadius: '12px', border: 'none',
                background: `linear-gradient(135deg, ${FOREST}, ${FOREST_MID})`,
                color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              }}>
                続けて記録する
              </button>
              <Link href="/" onClick={() => setSuccessSheet(false)} style={{
                display: 'block', textAlign: 'center', padding: '13px', borderRadius: '12px',
                border: `1.5px solid ${SAND_LIGHT}`, color: MUTED, fontSize: '14px', textDecoration: 'none',
              }}>
                ホームへ戻る
              </Link>
            </div>
          </div>
        </>
      )}

      <main style={{ padding: '18px 16px 110px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ─── ショット情報 ─── */}
        <SectionCard accent={GOLD} title="ショット情報">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <FieldLabel required>日付</FieldLabel>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 2 }}>
                <FieldLabel>コース名</FieldLabel>
                <input type="text" value={courseName} placeholder="例：太平洋クラブ"
                  onChange={(e) => setCourseName(e.target.value)} style={INPUT_STYLE}
                  onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>ホール</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <input type="number" value={hole} min={1} max={18} placeholder="1-18"
                    onChange={(e) => setHole(e.target.value)}
                    style={{ ...INPUT_STYLE, borderRadius: '8px 0 0 8px', textAlign: 'center', flex: 1 }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                    onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
                  <div style={{
                    padding: '0 8px', backgroundColor: SAND_LIGHT, border: `1.5px solid ${SAND_LIGHT}`,
                    borderLeft: 'none', display: 'flex', alignItems: 'center',
                    fontSize: '12px', color: MUTED, borderRadius: '0 8px 8px 0',
                  }}>H</div>
                </div>
              </div>
            </div>

            <div>
              <FieldLabel>クラブ</FieldLabel>
              <input type="text" value={club} placeholder="例：7番アイアン、ドライバー"
                onChange={(e) => setClub(e.target.value)} style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
            </div>

            <div>
              <FieldLabel>ショット種類</FieldLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(Object.entries(SHOT_TYPE_LABELS) as [ShotType, string][]).map(([key, label]) => {
                  const active = shotType === key
                  return (
                    <button key={key} onClick={() => setShotType(active ? '' : key)} style={{
                      padding: '7px 12px', borderRadius: '8px', fontSize: '12px',
                      fontWeight: active ? 700 : 400,
                      color: active ? '#fff' : INK,
                      backgroundColor: active ? FOREST_MID : CREAM,
                      border: `1.5px solid ${active ? FOREST_MID : SAND_LIGHT}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ─── ショットの詳細 ─── */}
        <SectionCard accent={FOREST} title="ショットの詳細">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <FieldLabel required>内容メモ</FieldLabel>
              <AutoTA value={memo} onChange={setMemo}
                placeholder="例：7Iでピン横2mにつけた、ドライバーで280yのフェアウェイ" />
            </div>
            <div>
              <FieldLabel>なぜ良かったか</FieldLabel>
              <AutoTA value={whyGood} onChange={setWhyGood}
                placeholder="例：力まず振れた、アライメントが良かった、リズムが良かった" />
            </div>
            <div>
              <FieldLabel>再現ポイント</FieldLabel>
              <AutoTA value={reproducePoint} onChange={setReproducePoint}
                placeholder="例：深呼吸してから打つ、フェース向きを確認する" />
            </div>
          </div>
        </SectionCard>

        {/* ─── 気分 ─── */}
        <SectionCard accent={TERRACOTTA} title="気分">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(Object.entries(MOOD_CONFIG) as [Mood, MoodCfg][]).map(([key, cfg]) => {
              const active = mood === key
              return (
                <button key={key} onClick={() => setMood(active ? '' : key)} style={{
                  flex: 1, minWidth: '80px', padding: '12px 8px', borderRadius: '10px',
                  border: `2px solid ${active ? cfg.color : SAND_LIGHT}`,
                  backgroundColor: active ? cfg.bg : CREAM,
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: active ? cfg.color : INK }}>
                    {cfg.label}
                  </div>
                </button>
              )
            })}
          </div>
        </SectionCard>

        {/* ─── Save button ─── */}
        <button onClick={handleSave} disabled={!canSave} style={{
          width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
          background: canSave ? `linear-gradient(135deg, ${GOLD}, #A08018)` : SAND_LIGHT,
          color: canSave ? '#fff' : MUTED,
          fontSize: '15px', fontWeight: 700,
          cursor: canSave ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          boxShadow: canSave ? `0 4px 20px ${GOLD}45` : 'none',
          letterSpacing: '0.04em',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
          </svg>
          ベストショットを保存する
        </button>

        {/* ─── History ─── */}
        {shots.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '10px', padding: '0 2px' }}>
              記録済みベストショット
              <span style={{ fontSize: '11px', color: MUTED, fontWeight: 400, marginLeft: '6px' }}>
                全{shots.length}件
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {shots.map(shot => (
                <ShotCard key={shot.id} shot={shot} onDelete={() => handleDelete(shot.id)} />
              ))}
            </div>
          </div>
        )}

        {shots.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '28px 20px',
            backgroundColor: CARD, borderRadius: '12px', border: `1.5px dashed ${SAND_LIGHT}`,
          }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: `${GOLD}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
              </svg>
            </div>
            <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.7 }}>
              ナイスショットの瞬間を記録しましょう。<br/>
              再現ポイントを残すことで次のラウンドでも活かせます。
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
