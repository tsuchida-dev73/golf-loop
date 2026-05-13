'use client'

import { useState, useEffect, useRef, startTransition } from 'react'
import Link from 'next/link'
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
type Strategy = {
  attack:      string  // 今日の攻め方
  teeShot:     string  // ティーショット方針
  aroundGreen: string  // グリーン周りの注意
  windAdjust:  string  // 番手調整
  mental:      string  // メンタルテーマ
  oneWord:     string  // 今日の一言
}

type RoundPlan = {
  id:           string
  date:         string
  courseName:   string
  startTime:    string
  weather:      string
  windSpeed:    string
  temperature:  string
  targetScore:  number
  cautions:     string
  recentIssues: string
  strategy:     Strategy
  savedAt:      string
}

const PLAN_KEY          = 'golf-loop-round-plans'
const CLUB_DISTANCE_KEY = 'golf-loop-club-distances'

// ─── Club distance types & helpers ──────────────────────────────────────────
type Skill    = '得意' | '普通' | '苦手'
type ClubData = {
  carry: string; total: string; directionMemo: string
  skill: Skill | ''; notes: string; updatedAt: string
}
type ClubDistanceMap = Partial<Record<string, ClubData>>
type ClubEntry = { club: string; carry: number; total: number; skill: Skill | '' }

function getSortedClubs(map: ClubDistanceMap): ClubEntry[] {
  return Object.entries(map)
    .filter(([, d]) => d?.carry)
    .map(([club, d]) => ({
      club,
      carry: Number(d!.carry),
      total: Number(d!.total) || Number(d!.carry),
      skill: (d!.skill || '') as Skill | '',
    }))
    .sort((a, b) => b.carry - a.carry)
}

function findClubForDist(yards: number, entries: ClubEntry[]): ClubEntry | null {
  if (!entries.length) return null
  const covering = entries.filter(e => e.carry >= yards)
  return covering.length ? covering[covering.length - 1] : entries[entries.length - 1]
}

function windAdjY(n: number): number {
  return n >= 10 ? 25 : n >= 6 ? 15 : n >= 3 ? 7 : 0
}

// ─── Strategy generation ────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function generateStrategy(p: Omit<RoundPlan, 'id' | 'savedAt' | 'strategy'>): Strategy {
  const windNum = parseFloat(p.windSpeed)  || 0
  const tempNum = parseFloat(p.temperature) || 15
  const isRainy     = p.weather.includes('雨')
  const isWindy     = windNum >= 6
  const isVeryWindy = windNum >= 10
  const isCold      = tempNum <= 10
  const issues = p.recentIssues
  const cauts  = p.cautions

  // ── 今日の攻め方 ────────────────────────────────────────────────────────
  let attack = ''
  if (p.targetScore <= 80) {
    attack = `目標${p.targetScore}は高い設定です。バーディを狙いすぎず、ボギーオンからの1パット奪取を繰り返して積み上げましょう。`
  } else if (p.targetScore <= 90) {
    attack = `目標${p.targetScore}を達成するには、ダブルボギー以上を2回以内に抑えることが最大のポイントです。`
  } else if (p.targetScore <= 100) {
    attack = `目標${p.targetScore}は着実な守りのゴルフで届きます。リスクを冒さず、フェアウェイとグリーンを丁寧に刻みましょう。`
  } else {
    attack = `目標${p.targetScore}はまず「毎ホール確実にボールを前に進める」ことから。ダボを叩かないことが最優先です。`
  }
  if (isRainy) attack += ' 雨でグリーンが止まりやすいため、ピンを積極的に狙える場面が増えます。フルショットを信じて。'
  if (cauts) attack += ` 特に「${cauts.slice(0, 22)}」を最優先で意識して立ち回りましょう。`

  // ── ティーショット方針 ──────────────────────────────────────────────────
  let teeShot = ''
  if (isVeryWindy) {
    teeShot = `風速${windNum}m超の強風日。ドライバーは封印し、3番ウッドかユーティリティで低い弾道を最優先に。フェアウェイに置くことだけを考えましょう。`
  } else if (isWindy) {
    teeShot = `風速${windNum}m前後の風あり。3/4スイングでコンパクトに振り抜き、弾道を抑えてフェアウェイキープを最優先に。距離は二の次です。`
  } else {
    teeShot = 'コンディション良好。ルーティーンを徹底し、フェアウェイの広い側をターゲットにしましょう。リズム重視で。'
  }
  const hasObIssue = issues.includes('OB') || issues.includes('ob') || issues.includes('方向') || cauts.includes('OB')
  if (hasObIssue) teeShot += ' 最近OB傾向あり。安全な方向に向けて3/4スイングで確実にフェアウェイへ置く意識を。'

  // ── グリーン周りの注意 ──────────────────────────────────────────────────
  let aroundGreen = ''
  const hasApproachIssue = issues.includes('アプローチ') || issues.includes('ショート') || cauts.includes('アプローチ')
  if (isRainy) {
    aroundGreen = '雨でグリーンが柔らかくボールが止まりやすい。普段より1番手下でキャリーを増やす選択も有効です。バンカーは砂が重くなるため、フェースを開き気味に。'
  } else {
    aroundGreen = '転がしアプローチを基本戦略に。「ピン奥に外すより手前に外す」を鉄則とし、まずグリーンに乗せることを最優先にしましょう。'
  }
  if (hasApproachIssue) aroundGreen += ' アプローチが最近の課題。距離感より先に「方向とランディングスポット」を決めてから振りましょう。'

  // ── 番手調整 ────────────────────────────────────────────────────────────
  let windAdjust = ''
  if (isVeryWindy) {
    windAdjust = `風速${windNum}m超：向かい風は2〜3番手上げ（5番→3番相当）、追い風は2番手下げで。横風はフェードを使って風に乗せる意識で弾道を低く保つことが鉄則です。`
  } else if (isWindy) {
    windAdjust = `風速${windNum}m前後：向かい風は1〜2番手上げ、追い風は1番手下げが目安。ハーフショット気味に振ることで弾道を低く抑えられます。`
  } else if (windNum > 0) {
    windAdjust = `微風（${windNum}m）：基本は通常番手で問題なし。向かい・追いで半番手分の意識を持つ程度で十分です。`
  } else {
    windAdjust = '無風コンディション。打ち上げは1番手上、打ち下ろしは1番手下の調整のみ意識すれば問題ありません。'
  }
  if (isCold) windAdjust += ` 気温${tempNum}℃と低め。ボールの飛距離が通常より5〜10%減少します。全番手1クラブ上を意識してください。`

  // ── メンタルテーマ ──────────────────────────────────────────────────────
  let mental = ''
  const hasMentalIssue = issues.includes('メンタル') || issues.includes('集中') || issues.includes('後半') || cauts.includes('メンタル')
  if (hasMentalIssue) {
    mental = '1ホールごとに完全リセット。ミスホールの後こそ深呼吸し「前のホールは終わった」を合言葉に。後半に入ったら「ここから新しいゲームが始まる」と意識的にスイッチを切り替えましょう。'
  } else if (issues) {
    mental = `「${issues.slice(0, 25)}」という課題を持ちながらも、今日はプロセスへの集中を最大の武器にします。ショット結果より自分のルーティーンと準備に意識を向けましょう。`
  } else {
    mental = '楽しむことが最強のメンタル管理。ナイスショットを1本でも多く出すことだけを考え、コースとの対話を楽しんでください。スコアは後から付いてきます。'
  }

  // ── 今日の一言 ──────────────────────────────────────────────────────────
  const oneWords = [
    '良い準備が良いスコアを生む。',
    'フェアウェイが友達、グリーンが目的地。',
    '1打1打に全集中。',
    '今日の自分のベストを出すだけ。',
    'ボギーも友達、諦めないゴルフを。',
    '楽しいゴルフが一番のスコアを生む。',
    'プロセスに集中すれば結果は付いてくる。',
  ]
  const seed = hashStr(p.date + p.courseName + String(p.targetScore))
  const baseWord = oneWords[seed % oneWords.length]
  const oneWord = isVeryWindy
    ? `風は全員に平等。${baseWord}`
    : isRainy
      ? `雨の日こそ真価が問われる。${baseWord}`
      : baseWord

  return { attack, teeShot, aroundGreen, windAdjust, mental, oneWord }
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

function FieldWrap({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
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

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM,
  color: INK, fontSize: '14px', outline: 'none', fontFamily: 'inherit',
}

function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} style={INPUT_STYLE}
      onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
      onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
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

// Strategy card row
function StratRow({ accent, icon, label, text }: {
  accent: string; icon: React.ReactNode; label: string; text: string
}) {
  return (
    <div style={{ display: 'flex', gap: '11px', paddingTop: '14px' }}>
      <div style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '8px',
        backgroundColor: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: accent, letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '13px', color: INK, lineHeight: 1.75 }}>{text}</div>
      </div>
    </div>
  )
}

// ─── Club advice section (inside strategy card) ──────────────────────────────
function ClubAdviceSection({ entries, windNum, tempNum }: {
  entries: ClubEntry[]; windNum: number; tempNum: number
}) {
  const KEY_DIST = [100, 130, 150, 170, 200]
  const windY    = windAdjY(windNum)
  const isCold   = tempNum <= 10
  const coldMult = isCold ? 1.07 : 1.0
  const isAdj    = windY > 0 || isCold

  const clubIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FOREST_MID} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="22" x2="19" y2="2" />
      <line x1="15" y1="22" x2="19" y2="22" />
      <line x1="19" y1="17" x2="19" y2="22" />
    </svg>
  )

  if (!entries.length) {
    return (
      <div style={{ display: 'flex', gap: '11px', paddingTop: '14px' }}>
        <div style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '8px', backgroundColor: `${MUTED}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {clubIcon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, letterSpacing: '0.06em', marginBottom: '5px' }}>
            推奨番手（未登録）
          </div>
          <Link href="/club-distance" style={{ fontSize: '12px', color: FOREST, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            番手別飛距離を登録すると自動で推奨番手が表示されます
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9,18 15,12 9,6" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  const recs = KEY_DIST.map(y => {
    const eff = Math.round((y + windY) * coldMult)
    const rec = findClubForDist(eff, entries)
    return rec ? { y, ...rec } : null
  }).filter(Boolean) as (ClubEntry & { y: number })[]

  const hasGood = recs.some(r => r.skill === '得意')
  const hasBad  = recs.some(r => r.skill === '苦手')

  return (
    <div style={{ display: 'flex', gap: '11px', paddingTop: '14px' }}>
      <div style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '8px', backgroundColor: `${FOREST_MID}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {clubIcon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: FOREST_MID, letterSpacing: '0.06em', marginBottom: '7px', display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
          推奨番手（あなたの飛距離データ）
          {isAdj && (
            <span style={{ fontSize: '9px', fontWeight: 600, color: windNum >= 6 ? TERRACOTTA : MUTED, backgroundColor: windNum >= 6 ? `${TERRACOTTA}12` : `${SAND_LIGHT}CC`, borderRadius: '3px', padding: '1px 6px' }}>
              {windNum >= 6 ? `向かい風+${windY}y補正済み` : '気温補正済み'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '7px' }}>
          {recs.map(rec => {
            const good = rec.skill === '得意'
            const bad  = rec.skill === '苦手'
            return (
              <div key={rec.y} style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '5px 9px', borderRadius: '7px',
                backgroundColor: good ? `${FOREST}0F` : bad ? `${TERRACOTTA}0F` : `${SAND_LIGHT}80`,
                border: `1px solid ${good ? FOREST + '28' : bad ? TERRACOTTA + '30' : SAND_LIGHT}`,
              }}>
                <span style={{ fontSize: '10px', color: MUTED }}>{rec.y}y</span>
                <span style={{ fontSize: '10px', color: MUTED, margin: '0 1px' }}>→</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: good ? FOREST : bad ? TERRACOTTA : INK }}>
                  {rec.club}
                </span>
                {good && <span style={{ fontSize: '10px', color: FOREST_LIGHT }}>◎</span>}
                {bad  && <span style={{ fontSize: '10px', color: TERRACOTTA }}>△</span>}
              </div>
            )
          })}
        </div>

        {(hasGood || hasBad) && (
          <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.6 }}>
            {hasGood && <span style={{ color: FOREST_LIGHT }}>◎得意クラブは積極的に選択。</span>}
            {hasGood && hasBad && '　'}
            {hasBad  && <span style={{ color: TERRACOTTA }}>△苦手クラブは前後番手への変更も検討してください。</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// History item
function HistoryItem({ plan }: { plan: RoundPlan }) {
  const [open, setOpen] = useState(false)
  const windNum = parseFloat(plan.windSpeed) || 0
  return (
    <div style={{ backgroundColor: CARD, borderRadius: '10px', border: `1px solid ${SAND_LIGHT}`, overflow: 'hidden' }}>
      <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '3px' }}>
            {plan.courseName || 'コース未記入'}
          </div>
          <div style={{ fontSize: '11px', color: MUTED }}>
            {formatDate(plan.date)}{plan.startTime ? `　${plan.startTime}スタート` : ''}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            {plan.weather && (
              <span style={{ fontSize: '11px', color: FOREST_MID, backgroundColor: `${FOREST}0D`, borderRadius: '4px', padding: '2px 7px', fontWeight: 500 }}>
                {plan.weather}
              </span>
            )}
            {windNum > 0 && (
              <span style={{ fontSize: '11px', color: MUTED, backgroundColor: SAND_LIGHT, borderRadius: '4px', padding: '2px 7px' }}>
                風{plan.windSpeed}m
              </span>
            )}
            <span style={{ fontSize: '11px', color: FOREST, backgroundColor: `${FOREST}0D`, borderRadius: '4px', padding: '2px 7px', fontWeight: 600 }}>
              目標{plan.targetScore}
            </span>
          </div>
        </div>
        <button onClick={() => setOpen(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6,9 12,15 18,9" />
          </svg>
        </button>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${SAND_LIGHT}`, padding: '12px 14px 14px' }}>
          {/* One word */}
          <div style={{ fontSize: '13px', fontWeight: 700, color: FOREST, fontStyle: 'italic', marginBottom: '12px', padding: '8px 12px', backgroundColor: `${FOREST}08`, borderRadius: '7px', borderLeft: `3px solid ${FOREST}` }}>
            「{plan.strategy.oneWord}」
          </div>
          {[
            { label: '今日の攻め方',        text: plan.strategy.attack },
            { label: 'ティーショット方針',   text: plan.strategy.teeShot },
            { label: 'グリーン周りの注意',   text: plan.strategy.aroundGreen },
          ].map(({ label, text }) => (
            <div key={label} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: MUTED, fontWeight: 600, marginBottom: '3px' }}>{label}</div>
              <div style={{ fontSize: '12px', color: INK, lineHeight: 1.6 }}>{text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const WEATHER_PRESETS = [
  { id: '☀️ 晴れ',        val: '晴れ' },
  { id: '🌤 晴れ曇り',    val: '晴れ時々曇り' },
  { id: '☁️ 曇り',        val: '曇り' },
  { id: '🌦 小雨',        val: '小雨' },
  { id: '🌧 雨',          val: '雨' },
]

export default function RoundPlanPage() {
  const [date,         setDate]         = useState(todayStr)
  const [courseName,   setCourseName]   = useState('')
  const [startTime,    setStartTime]    = useState('')
  const [weather,      setWeather]      = useState('')
  const [windSpeed,    setWindSpeed]    = useState('')
  const [temperature,  setTemperature]  = useState('')
  const [targetScore,  setTargetScore]  = useState(90)
  const [cautions,     setCautions]     = useState('')
  const [recentIssues, setRecentIssues] = useState('')
  const [strategy,     setStrategy]     = useState<Strategy | null>(null)
  const [generating,   setGenerating]   = useState(false)
  const [plans,        setPlans]        = useState<RoundPlan[]>([])
  const [successSheet,   setSuccessSheet]   = useState(false)
  const [clubDistances,  setClubDistances]  = useState<ClubDistanceMap>({})
  const stratRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let parsed: RoundPlan[]    = []
    let clubs:  ClubDistanceMap = {}
    try {
      const raw  = localStorage.getItem(PLAN_KEY)
      if (raw)   parsed = JSON.parse(raw)
      const rawC = localStorage.getItem(CLUB_DISTANCE_KEY)
      if (rawC)  clubs  = JSON.parse(rawC)
    } catch {}
    startTransition(() => {
      setPlans(parsed)
      setClubDistances(clubs)
    })
  }, [])

  function handleGenerate() {
    setGenerating(true)
    setStrategy(null)
    setTimeout(() => {
      const s = generateStrategy({ date, courseName, startTime, weather, windSpeed, temperature, targetScore, cautions, recentIssues })
      setStrategy(s)
      setGenerating(false)
      setTimeout(() => stratRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }, 900)
  }

  function handleSave() {
    if (!strategy) return
    const entry: RoundPlan = {
      id: `${Date.now()}`, date, courseName, startTime, weather, windSpeed,
      temperature, targetScore, cautions, recentIssues, strategy,
      savedAt: new Date().toISOString(),
    }
    const updated = [entry, ...plans]
    setPlans(updated)
    localStorage.setItem(PLAN_KEY, JSON.stringify(updated))
    setSuccessSheet(true)
  }

  const windNum = parseFloat(windSpeed) || 0

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', backgroundColor: CREAM }}>

      {/* Header */}
      <header style={{ backgroundColor: FOREST, padding: '52px 20px 22px' }}>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', letterSpacing: '0.28em', marginBottom: '8px', fontWeight: 400, fontFamily: "Georgia, 'Times New Roman', serif" }}>GOLF LOOP</div>
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>ラウンド準備</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', margin: '4px 0 0' }}>当日の戦略をまとめて万全の準備を</p>
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
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: `${TERRACOTTA}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={TERRACOTTA} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#1C1C1C' }}>ラウンド準備を保存しました</div>
              <div style={{ fontSize: '13px', color: '#6B7060', marginTop: '4px' }}>続けて何をしますか？</div>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#6B7060', letterSpacing: '0.08em', marginBottom: '10px' }}>次のステップ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { href: '/round', label: 'ラウンドを記録する', sub: 'ラウンド後にスコアを入力する',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TERRACOTTA} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg> },
                { href: '/', label: 'ホームで確認する', sub: '準備内容がダッシュボードに反映されます',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> },
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

        {/* ─── Form section 1: コース情報 ─── */}
        <SectionCard accent={FOREST} title="コース情報">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <FieldWrap label="ラウンド日" required>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
            </FieldWrap>

            <FieldWrap label="コース名">
              <TextInput value={courseName} onChange={setCourseName} placeholder="例：東急セブンハンドレッドクラブ" />
            </FieldWrap>

            <FieldWrap label="スタート時間">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={INPUT_STYLE}
                onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
            </FieldWrap>
          </div>
        </SectionCard>

        {/* ─── Form section 2: 当日の気象 ─── */}
        <SectionCard accent={FOREST_MID} title="当日の気象">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <FieldWrap label="天気">
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {WEATHER_PRESETS.map(({ id, val }) => {
                  const active = weather === val
                  return (
                    <button key={id} onClick={() => setWeather(active ? '' : val)} style={{
                      padding: '6px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: active ? 700 : 400,
                      color: active ? '#fff' : INK, backgroundColor: active ? FOREST_MID : CREAM,
                      border: `1.5px solid ${active ? FOREST_MID : SAND_LIGHT}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      {id}
                    </button>
                  )
                })}
              </div>
              <TextInput value={weather} onChange={setWeather} placeholder="例：晴れ・北風あり（自由入力可）" />
            </FieldWrap>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <FieldWrap label="風速">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                    <input type="number" value={windSpeed} min={0} max={30}
                      onChange={(e) => setWindSpeed(e.target.value)}
                      placeholder="0" style={{ ...INPUT_STYLE, textAlign: 'center', borderRadius: '8px 0 0 8px' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
                    <div style={{ padding: '0 10px', backgroundColor: SAND_LIGHT, border: `1.5px solid ${SAND_LIGHT}`, borderLeft: 'none', height: '42px', display: 'flex', alignItems: 'center', fontSize: '12px', color: MUTED, borderRadius: '0 8px 8px 0', whiteSpace: 'nowrap' }}>
                      m/s
                    </div>
                  </div>
                </FieldWrap>
              </div>
              <div style={{ flex: 1 }}>
                <FieldWrap label="気温">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input type="number" value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="15" style={{ ...INPUT_STYLE, textAlign: 'center', borderRadius: '8px 0 0 8px' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
                    <div style={{ padding: '0 10px', backgroundColor: SAND_LIGHT, border: `1.5px solid ${SAND_LIGHT}`, borderLeft: 'none', height: '42px', display: 'flex', alignItems: 'center', fontSize: '12px', color: MUTED, borderRadius: '0 8px 8px 0' }}>
                      ℃
                    </div>
                  </div>
                </FieldWrap>
              </div>
            </div>

            {/* Wind indicator */}
            {windNum > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', backgroundColor: windNum >= 10 ? `${TERRACOTTA}12` : windNum >= 6 ? `${GOLD}12` : `${FOREST}08` }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={windNum >= 10 ? TERRACOTTA : windNum >= 6 ? GOLD : FOREST_MID} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                  <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                  <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
                </svg>
                <span style={{ fontSize: '12px', fontWeight: 600, color: windNum >= 10 ? TERRACOTTA : windNum >= 6 ? GOLD : FOREST_MID }}>
                  {windNum >= 10 ? `強風（${windNum}m）: ドライバー封印推奨` : windNum >= 6 ? `やや強い風（${windNum}m）: 3/4スイング推奨` : `微風（${windNum}m）: 通常通りOK`}
                </span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ─── Form section 3: 目標と課題 ─── */}
        <SectionCard accent={TERRACOTTA} title="今日の目標と課題">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <FieldWrap label="目標スコア" required>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="number" value={targetScore} min={60} max={150}
                  onChange={(e) => setTargetScore(Number(e.target.value))}
                  style={{ ...INPUT_STYLE, width: '100px', textAlign: 'center' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = SAND_LIGHT)} />
                <div style={{ display: 'flex', gap: '5px' }}>
                  {[80, 85, 90, 95, 100].map(n => (
                    <button key={n} onClick={() => setTargetScore(n)} style={{
                      padding: '4px 8px', borderRadius: '5px', fontSize: '11px',
                      fontWeight: targetScore === n ? 700 : 400,
                      color: targetScore === n ? '#fff' : MUTED,
                      backgroundColor: targetScore === n ? FOREST : CREAM,
                      border: `1px solid ${targetScore === n ? FOREST : SAND_LIGHT}`,
                      cursor: 'pointer',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            </FieldWrap>

            <FieldWrap label="今日の注意点">
              <AutoTA value={cautions} onChange={setCautions} placeholder="例：OBを避ける、池越えは刻む、バンカーに入れない" />
            </FieldWrap>

            <FieldWrap label="最近の課題">
              <AutoTA value={recentIssues} onChange={setRecentIssues} placeholder="例：アプローチがダフりやすい、後半にメンタルが崩れる" />
            </FieldWrap>
          </div>
        </SectionCard>

        {/* ─── Generate button ─── */}
        <button onClick={handleGenerate} disabled={generating} style={{
          width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
          background: generating ? `${FOREST}80` : `linear-gradient(135deg, ${FOREST}, ${FOREST_MID})`,
          color: '#fff', fontSize: '15px', fontWeight: 700, cursor: generating ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          letterSpacing: '0.04em', boxShadow: generating ? 'none' : `0 4px 20px ${FOREST}50`,
        }}
          onMouseDown={(e) => { if (!generating) e.currentTarget.style.opacity = '0.85' }}
          onMouseUp={(e)   => { if (!generating) e.currentTarget.style.opacity = '1' }}
          onTouchStart={(e)=> { if (!generating) e.currentTarget.style.opacity = '0.85' }}
          onTouchEnd={(e)  => { if (!generating) e.currentTarget.style.opacity = '1' }}
        >
          {generating ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              戦略を生成中...
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
              ラウンド戦略を生成する
            </>
          )}
        </button>

        {/* ─── Strategy card ─── */}
        {strategy && (
          <div ref={stratRef}>
            {/* One word banner */}
            <div style={{ backgroundColor: FOREST, borderRadius: '12px', padding: '14px 18px', marginBottom: '12px', boxShadow: `0 4px 20px ${FOREST}40` }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', letterSpacing: '0.12em', marginBottom: '6px' }}>今日の一言</div>
              <div style={{ color: '#fff', fontSize: '16px', fontWeight: 700, lineHeight: 1.5, fontStyle: 'italic' }}>
                「{strategy.oneWord}」
              </div>
            </div>

            {/* Strategy details */}
            <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 16px rgba(28,66,48,0.1)', overflow: 'hidden' }}>
              <div style={{ height: '3px', background: `linear-gradient(90deg, ${FOREST}, ${FOREST_LIGHT}, ${GOLD})` }} />
              <div style={{ padding: '16px 16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: `${FOREST}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                    </svg>
                  </div>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: FOREST }}>AI ラウンド戦略カード</span>
                    {courseName && <span style={{ fontSize: '11px', color: MUTED, marginLeft: '6px' }}>{courseName}</span>}
                  </div>
                </div>

                <div style={{ borderTop: `1px solid ${SAND_LIGHT}`, marginTop: '12px' }}>
                  <StratRow accent={FOREST} label="今日の攻め方" text={strategy.attack}
                    icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>}
                  />
                  <StratRow accent={FOREST_MID} label="ティーショット方針" text={strategy.teeShot}
                    icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FOREST_MID} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="21"/><path d="M6 4L17 7.5L6 11V4Z"/></svg>}
                  />
                  <StratRow accent={FOREST_LIGHT} label="グリーン周りの注意" text={strategy.aroundGreen}
                    icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FOREST_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l4-8 4 4 4-6 4 10"/><path d="M3 21h18"/></svg>}
                  />
                  <StratRow accent={windNum >= 6 ? TERRACOTTA : MUTED} label="番手調整（風・気温）" text={strategy.windAdjust}
                    icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={windNum >= 6 ? TERRACOTTA : MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>}
                  />
                  <StratRow accent={GOLD} label="メンタルテーマ" text={strategy.mental}
                    icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>}
                  />

                  {/* Club distance integration */}
                  <ClubAdviceSection
                    entries={getSortedClubs(clubDistances)}
                    windNum={windNum}
                    tempNum={parseFloat(temperature) || 15}
                  />
                </div>
              </div>
            </div>

            {/* Save button */}
            <button onClick={handleSave} style={{
              marginTop: '12px', width: '100%', padding: '14px', borderRadius: '12px',
              border: `1.5px solid ${FOREST}`, backgroundColor: 'transparent', color: FOREST,
              fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: '7px',
            }}
              onMouseDown={(e) => (e.currentTarget.style.backgroundColor = `${FOREST}0A`)}
              onMouseUp={(e)   => (e.currentTarget.style.backgroundColor = 'transparent')}
              onTouchStart={(e)=> (e.currentTarget.style.backgroundColor = `${FOREST}0A`)}
              onTouchEnd={(e)  => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
              </svg>
              この戦略を保存する
            </button>

            {/* Link to round recording */}
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <Link href="/round" style={{ fontSize: '12px', color: MUTED, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                ラウンド後はスコアを記録する
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </Link>
            </div>
          </div>
        )}

        {/* ─── History ─── */}
        {plans.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '10px', padding: '0 2px' }}>
              最近のラウンド準備
              <span style={{ fontSize: '11px', color: MUTED, fontWeight: 400, marginLeft: '6px' }}>全{plans.length}件</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {plans.slice(0, 3).map(plan => (
                <HistoryItem key={plan.id} plan={plan} />
              ))}
            </div>
            {plans.length > 3 && (
              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: MUTED }}>
                他 {plans.length - 3} 件
              </div>
            )}
          </div>
        )}

        {plans.length === 0 && !strategy && (
          <div style={{ textAlign: 'center', padding: '20px', color: MUTED }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏌️</div>
            <div style={{ fontSize: '13px' }}>上のフォームを入力して戦略を生成しましょう</div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
