'use client'

import { useState, useEffect, startTransition } from 'react'
import BottomNav from '../components/BottomNav'

const FOREST      = '#1C4230'
const FOREST_MID  = '#235C3E'
const TERRACOTTA  = '#C0522D'
const CREAM       = '#FAF8F0'
const SAND_LIGHT  = '#E8DFCE'
const CARD        = '#FFFFFF'
const INK         = '#1C1C1C'
const MUTED       = '#6B7060'

const CLUBS = [
  'ドライバー', '3W', '5W', '4U', '5U',
  '5I', '6I', '7I', '8I', '9I',
  'PW', 'AW', 'SW', 'PT',
] as const
type Club = typeof CLUBS[number]
type Skill = '得意' | '普通' | '苦手'

type ClubData = {
  carry: string
  total: string
  directionMemo: string
  skill: Skill | ''
  notes: string
  updatedAt: string
}
type ClubDistanceMap = Partial<Record<Club, ClubData>>

const STORAGE_KEY = 'golf-loop-club-distances'

const SKILL_STYLE: Record<Skill, { bg: string; color: string }> = {
  '得意': { bg: FOREST,     color: '#fff'  },
  '普通': { bg: SAND_LIGHT, color: MUTED   },
  '苦手': { bg: TERRACOTTA, color: '#fff'  },
}

function emptyForm() {
  return { carry: '', total: '', directionMemo: '', skill: '' as Skill | '', notes: '' }
}

export default function ClubDistancePage() {
  const [mounted,   setMounted]   = useState(false)
  const [distances, setDistances] = useState<ClubDistanceMap>({})
  const [editing,   setEditing]   = useState<Club | null>(null)
  const [form,      setForm]      = useState(emptyForm())

  useEffect(() => {
    let data: ClubDistanceMap = {}
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) data = JSON.parse(raw)
    } catch {}
    startTransition(() => {
      setDistances(data)
      setMounted(true)
    })
  }, [])

  function startEdit(club: Club) {
    if (editing === club) { setEditing(null); return }
    const existing = distances[club]
    setEditing(club)
    setForm(
      existing
        ? { carry: existing.carry, total: existing.total, directionMemo: existing.directionMemo, skill: existing.skill, notes: existing.notes }
        : emptyForm()
    )
  }

  function saveClub() {
    if (!editing) return
    const updated: ClubDistanceMap = {
      ...distances,
      [editing]: { ...form, updatedAt: new Date().toISOString() },
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch {}
    startTransition(() => { setDistances(updated); setEditing(null) })
  }

  function deleteClub() {
    if (!editing) return
    const updated = { ...distances }
    delete updated[editing]
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch {}
    startTransition(() => { setDistances(updated); setEditing(null) })
  }

  const registeredCount = Object.keys(distances).length

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', backgroundColor: CREAM }}>

      {/* Header */}
      <header style={{ backgroundColor: FOREST, padding: '52px 20px 20px' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', letterSpacing: '0.15em', marginBottom: '6px', fontWeight: 500 }}>
          GOLF LOOP
        </div>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
          番手別飛距離
        </h1>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', marginTop: '4px' }}>
          {mounted ? `${registeredCount} / ${CLUBS.length} 番手を登録済み` : '各クラブの飛距離を記録・管理'}
        </div>
      </header>

      {/* Usage hint */}
      <div style={{ padding: '10px 16px', backgroundColor: `${FOREST_MID}0D`, borderBottom: `1px solid ${SAND_LIGHT}` }}>
        <p style={{ margin: 0, fontSize: '12px', color: FOREST_MID, lineHeight: 1.6 }}>
          番手をタップして飛距離を入力してください。ラウンド準備に役立てましょう。
        </p>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '88px 1fr 1fr 60px',
        gap: '8px', padding: '7px 16px',
        backgroundColor: SAND_LIGHT,
        borderBottom: `1px solid #D8D0BE`,
      }}>
        {['番手', 'キャリー', 'トータル', '評価'].map((h, i) => (
          <div key={h} style={{ fontSize: '10px', color: MUTED, fontWeight: 700, letterSpacing: '0.06em', textAlign: i === 0 ? 'left' : 'center' }}>
            {h}
          </div>
        ))}
      </div>

      <main style={{ paddingBottom: '100px' }}>
        {CLUBS.map(club => {
          const data   = distances[club]
          const isEdit = editing === club
          const hasData = !!data && (!!data.carry || !!data.total || !!data.skill)

          return (
            <div key={club} style={{ borderBottom: `1px solid ${SAND_LIGHT}` }}>
              {/* Club row */}
              <button
                onClick={() => mounted && startEdit(club)}
                style={{
                  display: 'grid', gridTemplateColumns: '88px 1fr 1fr 60px',
                  gap: '8px', width: '100%', padding: '13px 16px',
                  backgroundColor: isEdit ? `${FOREST}08` : CARD,
                  border: 'none', cursor: 'pointer', alignItems: 'center',
                  textAlign: 'left',
                }}
              >
                {/* Club name */}
                <div style={{ fontSize: '15px', fontWeight: 700, color: isEdit ? FOREST : INK }}>
                  {club}
                </div>

                {/* Carry */}
                <div style={{ fontSize: '14px', fontWeight: 600, textAlign: 'center', color: data?.carry ? INK : MUTED }}>
                  {data?.carry ? `${data.carry}y` : '−'}
                </div>

                {/* Total */}
                <div style={{ fontSize: '14px', fontWeight: 600, textAlign: 'center', color: data?.total ? INK : MUTED }}>
                  {data?.total ? `${data.total}y` : '−'}
                </div>

                {/* Skill badge or chevron */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {data?.skill ? (
                    <span style={{
                      fontSize: '10px', fontWeight: 700, borderRadius: '4px', padding: '3px 7px',
                      letterSpacing: '0.03em', whiteSpace: 'nowrap',
                      backgroundColor: SKILL_STYLE[data.skill as Skill].bg,
                      color: SKILL_STYLE[data.skill as Skill].color,
                    }}>
                      {data.skill}
                    </span>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isEdit ? FOREST : MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points={isEdit ? '18,15 12,9 6,15' : '6,9 12,15 18,9'} />
                    </svg>
                  )}
                </div>
              </button>

              {/* Direction memo display (if set and not editing) */}
              {!isEdit && data?.directionMemo && (
                <div style={{ paddingLeft: '16px', paddingRight: '16px', paddingBottom: '10px', marginTop: '-4px', backgroundColor: CARD }}>
                  <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.5 }}>
                    {data.directionMemo}
                  </div>
                </div>
              )}

              {/* Inline edit form */}
              {isEdit && (
                <div style={{ backgroundColor: `${FOREST}05`, padding: '16px', borderTop: `1px solid ${SAND_LIGHT}` }}>

                  {/* Carry + Total */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '4px', fontWeight: 700, letterSpacing: '0.04em' }}>
                        キャリー距離 (y)
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={form.carry}
                        onChange={e => setForm(f => ({ ...f, carry: e.target.value }))}
                        placeholder="例: 185"
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: '8px',
                          border: `1.5px solid ${SAND_LIGHT}`, fontSize: '16px', fontWeight: 700,
                          color: INK, backgroundColor: CARD, boxSizing: 'border-box',
                          outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '4px', fontWeight: 700, letterSpacing: '0.04em' }}>
                        トータル距離 (y)
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={form.total}
                        onChange={e => setForm(f => ({ ...f, total: e.target.value }))}
                        placeholder="例: 205"
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: '8px',
                          border: `1.5px solid ${SAND_LIGHT}`, fontSize: '16px', fontWeight: 700,
                          color: INK, backgroundColor: CARD, boxSizing: 'border-box',
                          outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  </div>

                  {/* Direction memo */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: MUTED, marginBottom: '4px', fontWeight: 700, letterSpacing: '0.04em' }}>
                      方向性メモ
                    </div>
                    <input
                      type="text"
                      value={form.directionMemo}
                      onChange={e => setForm(f => ({ ...f, directionMemo: e.target.value }))}
                      placeholder="例: やや右に出る、フック系"
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        border: `1.5px solid ${SAND_LIGHT}`, fontSize: '14px',
                        color: INK, backgroundColor: CARD, boxSizing: 'border-box',
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  {/* Skill toggle */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: MUTED, marginBottom: '6px', fontWeight: 700, letterSpacing: '0.04em' }}>
                      得意 / 普通 / 苦手
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['得意', '普通', '苦手'] as Skill[]).map(s => {
                        const active = form.skill === s
                        return (
                          <button
                            key={s}
                            onClick={() => setForm(f => ({ ...f, skill: f.skill === s ? '' : s }))}
                            style={{
                              flex: 1, padding: '9px 0', borderRadius: '8px', border: 'none',
                              fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                              backgroundColor: active ? SKILL_STYLE[s].bg : SAND_LIGHT,
                              color: active ? SKILL_STYLE[s].color : MUTED,
                              transition: 'background 0.15s',
                            }}
                          >
                            {s}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', color: MUTED, marginBottom: '4px', fontWeight: 700, letterSpacing: '0.04em' }}>
                      備考
                    </div>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="例: 冬場は -10y、向かい風は -15y"
                      rows={2}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: '8px',
                        border: `1.5px solid ${SAND_LIGHT}`, fontSize: '14px',
                        color: INK, backgroundColor: CARD, boxSizing: 'border-box',
                        outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6,
                      }}
                    />
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={saveClub}
                      style={{
                        flex: 1, padding: '12px 0', borderRadius: '10px', border: 'none',
                        backgroundColor: FOREST, color: '#fff',
                        fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      保存
                    </button>
                    {hasData && (
                      <button
                        onClick={deleteClub}
                        style={{
                          padding: '12px 16px', borderRadius: '10px',
                          border: `1.5px solid ${SAND_LIGHT}`,
                          backgroundColor: CARD, color: TERRACOTTA,
                          fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        削除
                      </button>
                    )}
                    <button
                      onClick={() => setEditing(null)}
                      style={{
                        padding: '12px 14px', borderRadius: '10px',
                        border: `1.5px solid ${SAND_LIGHT}`,
                        backgroundColor: CARD, color: MUTED,
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </main>

      <BottomNav />
    </div>
  )
}
