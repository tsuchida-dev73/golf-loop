'use client'

import { useState, useEffect, useRef, startTransition } from 'react'
import Link from 'next/link'
import BottomNav from '../components/BottomNav'

// ── Design tokens ──────────────────────────────────────────
const FOREST = '#1C4230'
const FOREST_MID = '#235C3E'
const FOREST_LIGHT = '#3A7D57'
const TERRACOTTA = '#C0522D'
const CREAM = '#FAF8F0'
const SAND_LIGHT = '#E8DFCE'
const CARD = '#FFFFFF'
const INK = '#1C1C1C'
const MUTED = '#6B7060'

// ── Category config ────────────────────────────────────────
type Category = 'driver' | 'iron' | 'approach' | 'putter'

const CATEGORY_CONFIG: Record<Category, { label: string; emoji: string; color: string; bg: string }> = {
  driver:   { label: 'ドライバー', emoji: '🏌️', color: '#1C4230', bg: '#1C423014' },
  iron:     { label: 'アイアン',   emoji: '⛳',  color: '#235C3E', bg: '#235C3E14' },
  approach: { label: 'アプローチ', emoji: '🎯',  color: '#C0522D', bg: '#C0522D14' },
  putter:   { label: 'パター',     emoji: '🏁',  color: '#7A5800', bg: '#7A580014' },
}
const CATEGORIES = Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG[Category]][]

function categoryLabel(id: Category) { return CATEGORY_CONFIG[id]?.label ?? id }

// ── Data types (unchanged from v1) ─────────────────────────
type PracticeLog = {
  id: string
  date: string
  categories: Category[]
  theme: string
  good: string
  bad: string
  insight: string
  next: string
  savedAt: string
}

const STORAGE_KEY = 'golf-loop-practice-logs'

// ── AI insight ─────────────────────────────────────────────
type AIInsight = {
  summary: string
  goodPoints: string
  focusTheme: string
  roundTip: string
  basedOn: number
}

function generateInsight(logs: PracticeLog[]): AIInsight | null {
  if (logs.length === 0) return null
  const latest = logs[0]
  const recent = logs.slice(0, Math.min(5, logs.length))

  // Category frequency
  const freq: Partial<Record<Category, number>> = {}
  recent.forEach(l => l.categories.forEach(c => { freq[c] = (freq[c] ?? 0) + 1 }))
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
  const topCat = sorted[0]?.[0] as Category | undefined

  // 今日の総括
  let summary: string
  if (latest.theme) {
    summary = `「${latest.theme}」をテーマに取り組んでいます。`
  } else {
    summary = `直近${recent.length}回の記録を分析しました。`
  }
  if (topCat) summary += `${categoryLabel(topCat)}への取り組みが最も多く、継続的な集中が見られます。`
  if (logs.length >= 3) summary += `計${logs.length}回のログから一貫した改善傾向が確認できます。`

  // 良かった点
  const goods = recent.filter(l => l.good).map(l => l.good)
  let goodPoints: string
  if (goods.length >= 2) {
    goodPoints = `「${goods[0]}」という手応えが記録されています。`
    if (goods[1] !== goods[0]) goodPoints += `前回も「${goods[1].slice(0, 20)}」が良好でした。`
    goodPoints += 'この感覚を体に染み込ませましょう。'
  } else if (goods.length === 1) {
    goodPoints = `「${goods[0]}」が直近の収穫です。この成果を次回に繋げましょう。`
  } else if (latest.insight) {
    goodPoints = `「${latest.insight.slice(0, 35)}」という気づきは重要な前進です。`
  } else {
    goodPoints = '毎回ログを続けていること自体が最大の強みです。記録の積み重ねが上達を加速させます。'
  }

  // 次回の重点テーマ
  const nexts = recent.filter(l => l.next).map(l => l.next)
  const bads  = recent.filter(l => l.bad).map(l => l.bad)
  let focusTheme: string
  if (nexts.length > 0) {
    focusTheme = `次回は「${nexts[0].slice(0, 28)}」を最優先にしましょう。`
    if (bads.length >= 2) focusTheme += '複数回のログで同様の課題が確認されています。重点的に取り組む価値があります。'
  } else if (bads.length > 0) {
    focusTheme = `「${bads[0].slice(0, 28)}」の改善が直近の最重要課題です。1セッション20分を目安に集中練習を。`
  } else if (topCat) {
    focusTheme = `${categoryLabel(topCat)}の基本動作を一つ選び、深く掘り下げるセッションを設けましょう。`
  } else {
    focusTheme = '各カテゴリをバランスよく練習し、最も改善余地のある部分を特定しましょう。'
  }

  // ラウンドで意識すること
  const tips: Record<Category, string> = {
    driver:   'ティーショットは「方向性」だけを意識。距離より確実にフェアウェイキープを優先して。',
    iron:     '番手選択を信じてフルスイング。ハーフショットの誘惑に負けず、体重移動を丁寧に。',
    approach: 'グリーン周りは「転がし優先」。上げようとせず、ミスを最小限に抑える選択を。',
    putter:   'ファーストパットは距離感のみ集中。入れにいかず、次のパットを楽な位置に残すこと。',
  }
  const roundTip = (topCat && tips[topCat]) ??
    '1ホールずつリセット。前のホールは忘れ、プロセスだけに集中しましょう。'

  return { summary, goodPoints, focusTheme, roundTip, basedOn: recent.length }
}

// ── Helpers ────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  const wd = ['日', '月', '火', '水', '木', '金', '土']
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return `${Number(m)}月${Number(d)}日（${wd[date.getDay()]}）`
}

// ── Voice input ────────────────────────────────────────────
type ParsedFields = { theme?: string; good?: string; bad?: string; insight?: string; next?: string }

interface SRInstance {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  start(): void; stop(): void; abort(): void
  onstart: (() => void) | null
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
interface SREvent {
  readonly resultIndex: number
  readonly results: {
    readonly length: number
    [i: number]: { readonly isFinal: boolean; [j: number]: { readonly transcript: string } }
  }
}
type SpeechRecognitionCtor = new () => SRInstance

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function parseTranscript(text: string): ParsedFields {
  type Field = keyof ParsedFields
  const rules: Array<{ keywords: string[]; field: Field }> = [
    { field: 'next',    keywords: ['次回', '次は', '次の練習', 'つぎは'] },
    { field: 'insight', keywords: ['気づい', 'わかっ', '感じ', 'わかりました'] },
    { field: 'bad',     keywords: ['うまくいかな', 'できなかっ', '悪かっ', 'ミスし', '右に出', '左に出', 'OBし', 'ダフっ', 'トップし'] },
    { field: 'good',    keywords: ['良かっ', 'よかっ', 'うまくいっ', '改善し', 'よくなっ'] },
    { field: 'theme',   keywords: ['今日は', 'テーマは', '意識したのは', '今日のテーマ'] },
  ]
  const found: Array<{ pos: number; field: Field }> = []
  for (const rule of rules) {
    let earliest = Infinity
    for (const kw of rule.keywords) {
      const idx = text.indexOf(kw)
      if (idx !== -1 && idx < earliest) earliest = idx
    }
    if (earliest !== Infinity) found.push({ pos: earliest, field: rule.field })
  }
  found.sort((a, b) => a.pos - b.pos)
  if (found.length === 0) return { theme: text.trim() }
  const result: ParsedFields = {}
  if (found[0].pos > 0) {
    const pre = text.slice(0, found[0].pos).trim()
    if (pre && !found.some(f => f.field === 'theme')) result.theme = pre
  }
  for (let i = 0; i < found.length; i++) {
    result[found[i].field] = text.slice(found[i].pos, found[i + 1]?.pos ?? text.length).trim()
  }
  return result
}

type VoiceStatus = 'idle' | 'listening' | 'done' | 'error'

function VoiceInput({ onApply }: { onApply: (fields: ParsedFields) => void }) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const recRef = useRef<SRInstance | null>(null)
  const finalRef = useRef('')
  const [Ctor, setCtor] = useState<SpeechRecognitionCtor | null>(null)

  useEffect(() => {
    setCtor(getSpeechRecognitionCtor())
    return () => { recRef.current?.abort() }
  }, [])

  if (!Ctor) return null

  function start() {
    if (!Ctor) return
    finalRef.current = ''
    setTranscript('')
    setErrorMsg('')
    const rec = new Ctor()
    rec.lang = 'ja-JP'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onstart = () => setStatus('listening')
    rec.onresult = (e) => {
      let final = finalRef.current
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) { final += t; finalRef.current = final }
        else interim += t
      }
      setTranscript(final + interim)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed')     { setStatus('error'); setErrorMsg('マイクのアクセスが拒否されました') }
      else if (e.error === 'audio-capture') { setStatus('error'); setErrorMsg('マイクが見つかりません') }
      else if (e.error !== 'no-speech')  { setStatus('error'); setErrorMsg(`音声認識エラー: ${e.error}`) }
    }
    rec.onend = () => {
      setStatus(prev => prev !== 'listening' ? prev : finalRef.current ? 'done' : 'idle')
      if (finalRef.current) setTranscript(finalRef.current)
    }
    recRef.current = rec
    try { rec.start() } catch { setStatus('error'); setErrorMsg('音声認識を開始できませんでした') }
  }

  function stop()  { recRef.current?.stop() }
  function apply() { onApply(parseTranscript(transcript)); setStatus('idle'); setTranscript('') }
  function reset() { recRef.current?.abort(); setStatus('idle'); setTranscript(''); setErrorMsg('') }

  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '3px', backgroundColor: FOREST_LIGHT }} />
      <div style={{ padding: '18px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: `${FOREST_LIGHT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FOREST_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: FOREST, letterSpacing: '0.06em' }}>音声入力</span>
        </div>

        {/* Idle */}
        {status === 'idle' && (
          <button onClick={start} style={{
            width: '100%', padding: '13px 16px', borderRadius: '10px', backgroundColor: FOREST_LIGHT,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px', color: '#FFFFFF', fontSize: '14px', fontWeight: 600,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            マイクでまとめて入力
          </button>
        )}

        {/* Listening */}
        {status === 'listening' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: TERRACOTTA, animation: 'voicePulse 1s infinite' }} />
              <span style={{ fontSize: '13px', color: TERRACOTTA, fontWeight: 600 }}>聞き取り中...</span>
              <button onClick={stop} style={{ marginLeft: 'auto', fontSize: '12px', color: MUTED, background: 'none', border: `1px solid ${SAND_LIGHT}`, borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                停止
              </button>
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.65, backgroundColor: CREAM, borderRadius: '8px', padding: '12px', border: `1px solid ${SAND_LIGHT}`, minHeight: '52px', color: transcript ? INK : MUTED, fontStyle: transcript ? 'normal' : 'italic' }}>
              {transcript || '練習内容を話してください...'}
            </div>
          </div>
        )}

        {/* Done */}
        {status === 'done' && (
          <div>
            <div style={{ fontSize: '12px', color: MUTED, marginBottom: '8px', fontWeight: 600 }}>認識結果（修正できます）</div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM, color: INK, fontSize: '13px', lineHeight: 1.65, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
              onBlur={(e) => (e.currentTarget.style.borderColor = SAND_LIGHT)}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button onClick={apply} style={{ flex: 1, padding: '11px', borderRadius: '8px', backgroundColor: FOREST, border: 'none', cursor: 'pointer', color: '#FFFFFF', fontSize: '13px', fontWeight: 600 }}>
                入力欄に反映する
              </button>
              <button onClick={reset} style={{ padding: '11px 14px', borderRadius: '8px', background: 'none', border: `1.5px solid ${SAND_LIGHT}`, cursor: 'pointer', color: MUTED, fontSize: '13px' }}>
                やり直す
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div>
            <div style={{ fontSize: '13px', color: TERRACOTTA, marginBottom: '10px' }}>{errorMsg}</div>
            {transcript && (
              <div>
                <div style={{ fontSize: '12px', color: MUTED, marginBottom: '6px', fontWeight: 600 }}>認識できたテキスト</div>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  style={{ width: '100%', minHeight: '60px', padding: '12px', borderRadius: '8px', border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM, color: INK, fontSize: '13px', lineHeight: 1.65, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <button onClick={apply} style={{ marginTop: '8px', width: '100%', padding: '11px', borderRadius: '8px', backgroundColor: FOREST, border: 'none', cursor: 'pointer', color: '#FFFFFF', fontSize: '13px', fontWeight: 600 }}>
                  入力欄に反映する
                </button>
              </div>
            )}
            <button onClick={reset} style={{ marginTop: '8px', fontSize: '12px', color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              閉じる
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes voicePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.8)}}`}</style>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────
function AutoTextarea({ placeholder, value, onChange }: {
  placeholder: string; value: string; onChange: (v: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${ref.current.scrollHeight}px`
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={2}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', minHeight: '72px', padding: '12px', borderRadius: '8px',
        border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM, color: INK,
        fontSize: '14px', lineHeight: 1.65, resize: 'none', outline: 'none',
        fontFamily: 'inherit', overflowY: 'hidden', transition: 'border-color 0.15s',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
      onBlur={(e) => (e.currentTarget.style.borderColor = SAND_LIGHT)}
    />
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: FOREST }}>{children}</span>
      {required && <span style={{ fontSize: '10px', color: TERRACOTTA, fontWeight: 600 }}>必須</span>}
    </div>
  )
}

function SectionCard({ accentColor, children }: { accentColor: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '3px', backgroundColor: accentColor }} />
      <div style={{ padding: '18px 16px' }}>{children}</div>
    </div>
  )
}

function CategoryBadge({ cat }: { cat: Category }) {
  const cfg = CATEGORY_CONFIG[cat]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 600, color: cfg.color,
      backgroundColor: cfg.bg, borderRadius: '5px', padding: '3px 7px',
    }}>
      <span style={{ fontSize: '12px' }}>{cfg.emoji}</span>
      {cfg.label}
    </span>
  )
}

function InsightRow({ icon, label, text, accent }: {
  icon: React.ReactNode; label: string; text: string; accent: string
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', paddingTop: '14px' }}>
      <div style={{
        flexShrink: 0, width: '30px', height: '30px', borderRadius: '8px',
        backgroundColor: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: accent, letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '13px', color: INK, lineHeight: 1.7 }}>{text}</div>
      </div>
    </div>
  )
}

function LogItem({ log, onDelete }: { log: PracticeLog; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const fields = [
    { label: 'テーマ', value: log.theme, mark: '' },
    { label: 'うまくいったこと', value: log.good, mark: '◎' },
    { label: 'うまくいかなかったこと', value: log.bad, mark: '△' },
    { label: '気づき', value: log.insight, mark: '💡' },
    { label: '次回やること', value: log.next, mark: '▶' },
  ].filter(f => f.value)

  return (
    <div style={{ backgroundColor: CARD, borderRadius: '10px', border: `1px solid ${SAND_LIGHT}`, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', padding: '12px 14px', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', gap: '8px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: INK }}>{formatDate(log.date)}</span>
            {fields.length > 0 && (
              <span style={{ fontSize: '10px', color: MUTED }}>{fields.length}項目記録</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {log.categories.map(c => <CategoryBadge key={c} cat={c} />)}
          </div>
          {log.theme && (
            <div style={{ fontSize: '12px', color: MUTED, marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {log.theme}
            </div>
          )}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {expanded && (
        <div style={{ padding: '12px 14px 14px', borderTop: `1px solid ${SAND_LIGHT}` }}>
          {fields.map(({ label, value, mark }) => (
            <div key={label} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                {mark && <span style={{ fontSize: '11px' }}>{mark}</span>}
                <span style={{ fontSize: '10px', color: MUTED, fontWeight: 600 }}>{label}</span>
              </div>
              <div style={{ fontSize: '13px', color: INK, lineHeight: 1.65, paddingLeft: mark ? '16px' : 0 }}>{value}</div>
            </div>
          ))}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{ marginTop: '6px', fontSize: '11px', color: TERRACOTTA, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            この記録を削除
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────
export default function PracticePage() {
  const [date, setDate] = useState(todayStr())
  const [categories, setCategories] = useState<Category[]>([])
  const [theme, setTheme] = useState('')
  const [good, setGood] = useState('')
  const [bad, setBad] = useState('')
  const [insight, setInsight] = useState('')
  const [next, setNext] = useState('')
  const [successSheet, setSuccessSheet] = useState(false)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<PracticeLog[]>([])
  const [insightReady, setInsightReady] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let parsed: PracticeLog[] = []
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      parsed = raw ? JSON.parse(raw) : []
    } catch {}
    startTransition(() => setLogs(parsed))
    if (parsed.length > 0) {
      setTimeout(() => setInsightReady(true), 900)
    }
  }, [])

  function toggleCategory(id: Category) {
    setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  function save() {
    if (categories.length === 0) { setError('練習カテゴリを選択してください'); return }
    setError('')
    const entry: PracticeLog = {
      id: `${Date.now()}`, date, categories, theme, good, bad, insight, next,
      savedAt: new Date().toISOString(),
    }
    const updated = [entry, ...logs]
    setLogs(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setCategories([]); setTheme(''); setGood(''); setBad(''); setInsight(''); setNext(''); setDate(todayStr())
    setInsightReady(false)
    setTimeout(() => setInsightReady(true), 900)
    setSuccessSheet(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function deleteLog(id: string) {
    const updated = logs.filter(l => l.id !== id)
    setLogs(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    if (updated.length === 0) setInsightReady(false)
  }

  function applyVoiceInput(fields: ParsedFields) {
    if (fields.theme   !== undefined) setTheme(fields.theme)
    if (fields.good    !== undefined) setGood(fields.good)
    if (fields.bad     !== undefined) setBad(fields.bad)
    if (fields.insight !== undefined) setInsight(fields.insight)
    if (fields.next    !== undefined) setNext(fields.next)
  }

  const insight2 = insightReady ? generateInsight(logs) : null
  const displayedLogs = showAll ? logs : logs.slice(0, 5)

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', backgroundColor: CREAM }}>

      {/* Header */}
      <header style={{ backgroundColor: FOREST, padding: '52px 20px 22px' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', letterSpacing: '0.15em', marginBottom: '6px', fontWeight: 500 }}>GOLF LOOP</div>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>練習ログ</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', margin: '4px 0 0' }}>記録して改善サイクルを回す</p>
      </header>

      {/* Success Sheet */}
      {successSheet && (
        <>
          <div onClick={() => setSuccessSheet(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '480px', zIndex: 201,
            backgroundColor: CARD, borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px', boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: `${FOREST}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: INK }}>練習ログを保存しました</div>
              <div style={{ fontSize: '13px', color: MUTED, marginTop: '4px' }}>続けて何をしますか？</div>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', marginBottom: '10px' }}>次のステップ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { href: '/analysis', label: 'スコアを分析する', sub: 'ラウンドデータから課題を確認', stroke: '#7A5800',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7A5800" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
                { href: '/round-plan', label: 'ラウンドを準備する', sub: '次回の戦略プランを作成', stroke: FOREST_MID,
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={FOREST_MID} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
              ].map(({ href, label, sub, icon }) => (
                <Link key={href} href={href} onClick={() => setSuccessSheet(false)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                  backgroundColor: CREAM, borderRadius: '12px', textDecoration: 'none',
                  border: `1px solid ${SAND_LIGHT}`,
                }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(28,66,48,0.1)' }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: INK }}>{label}</div>
                    <div style={{ fontSize: '12px', color: MUTED, marginTop: '2px' }}>{sub}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9,18 15,12 9,6" />
                  </svg>
                </Link>
              ))}
            </div>
            <button onClick={() => setSuccessSheet(false)} style={{
              marginTop: '14px', width: '100%', padding: '13px', borderRadius: '12px',
              border: `1.5px solid ${SAND_LIGHT}`, background: 'none',
              fontSize: '14px', color: MUTED, cursor: 'pointer',
            }}>
              閉じる
            </button>
          </div>
        </>
      )}

      <main style={{ padding: '18px 16px 110px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        <VoiceInput onApply={applyVoiceInput} />

        {/* ─── Form ─── */}
        <SectionCard accentColor={FOREST}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, letterSpacing: '0.06em', marginBottom: '16px' }}>基本情報</div>
          <div style={{ marginBottom: '18px' }}>
            <FieldLabel required>練習日</FieldLabel>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM, color: INK, fontSize: '15px', outline: 'none', fontFamily: 'inherit' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
              onBlur={(e) => (e.currentTarget.style.borderColor = SAND_LIGHT)}
            />
          </div>
          <div>
            <FieldLabel required>練習カテゴリ（複数選択可）</FieldLabel>
            {error && <div style={{ fontSize: '12px', color: TERRACOTTA, marginBottom: '8px' }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {CATEGORIES.map(([id, cfg]) => {
                const active = categories.includes(id)
                return (
                  <button key={id} onClick={() => toggleCategory(id)} style={{
                    padding: '12px 10px', borderRadius: '10px',
                    border: `1.5px solid ${active ? cfg.color : SAND_LIGHT}`,
                    backgroundColor: active ? cfg.bg : CARD,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: '18px' }}>{cfg.emoji}</span>
                    <span style={{ fontSize: '13px', fontWeight: active ? 600 : 400, color: active ? cfg.color : INK }}>{cfg.label}</span>
                    {active && (
                      <div style={{ marginLeft: 'auto' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20,6 9,17 4,12" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </SectionCard>

        <SectionCard accentColor={FOREST_MID}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, letterSpacing: '0.06em', marginBottom: '16px' }}>今日のテーマ</div>
          <FieldLabel>テーマ</FieldLabel>
          <input type="text" placeholder="例：下半身リード、テンポを意識" value={theme} onChange={(e) => setTheme(e.target.value)}
            style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: `1.5px solid ${SAND_LIGHT}`, backgroundColor: CREAM, color: INK, fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = FOREST_MID)}
            onBlur={(e) => (e.currentTarget.style.borderColor = SAND_LIGHT)}
          />
        </SectionCard>

        <SectionCard accentColor={FOREST_LIGHT}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, letterSpacing: '0.06em', marginBottom: '16px' }}>練習の振り返り</div>
          <div style={{ marginBottom: '16px' }}>
            <FieldLabel><span style={{ color: '#4CAF50', marginRight: '4px' }}>◎</span>うまくいったこと</FieldLabel>
            <AutoTextarea placeholder="例：インパクトで右手が緩まなかった" value={good} onChange={setGood} />
          </div>
          <div>
            <FieldLabel><span style={{ color: TERRACOTTA, marginRight: '4px' }}>△</span>うまくいかなかったこと</FieldLabel>
            <AutoTextarea placeholder="例：バックスイングで右肘が外れてしまう" value={bad} onChange={setBad} />
          </div>
        </SectionCard>

        <SectionCard accentColor={TERRACOTTA}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, letterSpacing: '0.06em', marginBottom: '16px' }}>気づきと次のアクション</div>
          <div style={{ marginBottom: '16px' }}>
            <FieldLabel>💡 気づき</FieldLabel>
            <AutoTextarea placeholder="例：体重移動が早いとトップが出やすい" value={insight} onChange={setInsight} />
          </div>
          <div>
            <FieldLabel>▶ 次回やること</FieldLabel>
            <AutoTextarea placeholder="例：テイクバックでクラブを低く引く練習" value={next} onChange={setNext} />
          </div>
        </SectionCard>

        {/* Save button */}
        <button onClick={save} style={{
          width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
          backgroundColor: FOREST, color: '#FFFFFF', fontSize: '15px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px', letterSpacing: '0.04em', boxShadow: `0 4px 16px ${FOREST}40`,
        }}
          onMouseDown={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseUp={(e) => (e.currentTarget.style.opacity = '1')}
          onTouchStart={(e) => (e.currentTarget.style.opacity = '0.85')}
          onTouchEnd={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
          </svg>
          保存する
        </button>

        {/* ─── AI Insight ─── */}
        {logs.length > 0 && (
          <div>
            {/* Loading shimmer */}
            {!insightReady && (
              <div style={{
                backgroundColor: CARD, borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(28,66,48,0.07)',
              }}>
                <div style={{ height: '3px', background: `linear-gradient(90deg, ${FOREST} 0%, #7ECB9E 50%, ${FOREST} 100%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                <div style={{ padding: '18px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: `${FOREST}12` }} />
                    <div style={{ width: '140px', height: '12px', borderRadius: '4px', backgroundColor: `${FOREST}10` }} />
                  </div>
                  {[90, 75, 85, 70].map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: `${FOREST}0A`, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: '60px', height: '9px', borderRadius: '3px', backgroundColor: `${FOREST}14`, marginBottom: '6px' }} />
                        <div style={{ width: `${w}%`, height: '11px', borderRadius: '3px', backgroundColor: `${FOREST}0A` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <style>{`@keyframes shimmer { 0%{background-position:100% 0} 100%{background-position:-100% 0} }`}</style>
              </div>
            )}

            {/* Insight card */}
            {insightReady && insight2 && (
              <div style={{ backgroundColor: CARD, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(28,66,48,0.07)' }}>
                <div style={{ height: '3px', background: `linear-gradient(90deg, ${FOREST}, #7ECB9E)` }} />
                <div style={{ padding: '16px 16px 18px' }}>
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: `${FOREST}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                        </svg>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: FOREST }}>AI コーチからのアドバイス</span>
                    </div>
                    <span style={{ fontSize: '10px', color: MUTED }}>直近{insight2.basedOn}回分析</span>
                  </div>

                  <div style={{ borderTop: `1px solid ${SAND_LIGHT}`, marginTop: '12px' }}>
                    <InsightRow
                      accent={FOREST}
                      label="今日の総括"
                      text={insight2.summary}
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>}
                    />
                    <InsightRow
                      accent={FOREST_LIGHT}
                      label="良かった点"
                      text={insight2.goodPoints}
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FOREST_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>}
                    />
                    <InsightRow
                      accent={TERRACOTTA}
                      label="次回の重点テーマ"
                      text={insight2.focusTheme}
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TERRACOTTA} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>}
                    />
                    <InsightRow
                      accent="#7A5800"
                      label="ラウンドで意識すること"
                      text={insight2.roundTip}
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A5800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="21"/><path d="M6 4L17 7.5L6 11V4Z"/></svg>}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── History ─── */}
        {logs.length > 0 && (
          <div style={{ marginTop: '6px' }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 2px' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: INK }}>練習履歴</span>
                <span style={{ fontSize: '11px', color: MUTED, marginLeft: '6px' }}>全{logs.length}件</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setShowAll(false)}
                  style={{
                    fontSize: '11px', fontWeight: showAll ? 400 : 600,
                    color: showAll ? MUTED : FOREST, background: showAll ? 'none' : `${FOREST}12`,
                    border: `1px solid ${showAll ? SAND_LIGHT : FOREST}`, borderRadius: '5px',
                    padding: '4px 10px', cursor: 'pointer',
                  }}
                >
                  最近5件
                </button>
                <button
                  onClick={() => setShowAll(true)}
                  style={{
                    fontSize: '11px', fontWeight: !showAll ? 400 : 600,
                    color: !showAll ? MUTED : FOREST, background: !showAll ? 'none' : `${FOREST}12`,
                    border: `1px solid ${!showAll ? SAND_LIGHT : FOREST}`, borderRadius: '5px',
                    padding: '4px 10px', cursor: 'pointer',
                  }}
                >
                  すべて
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayedLogs.map(log => (
                <LogItem key={log.id} log={log} onDelete={() => deleteLog(log.id)} />
              ))}
            </div>

            {!showAll && logs.length > 5 && (
              <button
                onClick={() => setShowAll(true)}
                style={{
                  width: '100%', marginTop: '10px', padding: '12px',
                  borderRadius: '10px', border: `1.5px dashed ${SAND_LIGHT}`,
                  background: 'none', color: MUTED, fontSize: '13px', cursor: 'pointer',
                }}
              >
                残り {logs.length - 5} 件をすべて表示
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {logs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: MUTED }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>📝</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>まだ記録がありません</div>
            <div style={{ fontSize: '12px' }}>上のフォームから最初の練習ログを記録しましょう</div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
