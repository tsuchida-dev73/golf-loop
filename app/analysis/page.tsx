'use client'

import { useState, useEffect, startTransition } from 'react'
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
const BOGEY_AMB   = '#B06820'

// ─── Types (mirrors round/page.tsx – do not modify) ─────────────────────────
type Par     = 3 | 4 | 5
type TeeShot = 'FW' | '左' | '右' | 'OB' | '池' | null

type HoleData = {
  par: Par; score: number; putts: number; teeShot: TeeShot; memo: string
}

type RoundLog = {
  id: string; date: string; courseName: string; weather: string
  targetScore: number; holes: HoleData[]; savedAt: string
}

const ROUND_KEY    = 'golf-loop-round-logs'
const PRACTICE_KEY = 'golf-loop-practice-logs'

// Practice log type (mirrors practice/page.tsx – do not modify)
type Category = 'driver' | 'iron' | 'approach' | 'putter'
type PracticeLog = {
  id: string; date: string; categories: Category[]
  theme: string; good: string; bad: string; insight: string; next: string; savedAt: string
}

const CATEGORY_LABEL: Record<Category, string> = {
  driver: 'ドライバー', iron: 'アイアン', approach: 'アプローチ', putter: 'パター',
}

// Maps analysis issue category → practice categories
const ISSUE_CAT_TO_PRACTICE: Record<string, Category[]> = {
  putter:   ['putter'],
  driver:   ['driver'],
  approach: ['approach'],
  mental:   ['approach', 'putter'],
}

const ISSUE_RECOMMENDED_THEME: Record<Issue['id'], string> = {
  putts:    'ショートパット反復・距離感ドリル（20分 / 週3回）',
  ob:       'ドライバー方向性・3/4スイング練習',
  fw:       'フェアウェイキープ重視のティーショット練習',
  collapse: 'アプローチ距離感 + 後半集中力維持のルーティーン',
  score:    '課題クラブ一点集中の技術練習',
}

// ─── Per-round stats ─────────────────────────────────────────────────────────
type RoundStats = {
  score: number; par: number; putts: number
  fws: number; obs: number; fwPct: number; diff: number
  frontDiff: number; backDiff: number; collapse: number
  vsTarget: number
}

function roundStats(log: RoundLog): RoundStats {
  const hs = log.holes.slice(0, 18)
  const score  = hs.reduce((s, h) => s + h.score, 0)
  const par    = hs.reduce((s, h) => s + h.par,   0)
  const putts  = hs.reduce((s, h) => s + h.putts,  0)
  const fws    = hs.filter(h => h.teeShot === 'FW').length
  const obs    = hs.filter(h => h.teeShot === 'OB').length
  const front9 = hs.slice(0, 9)
  const back9  = hs.slice(9)
  const fd = front9.reduce((s, h) => s + h.score - h.par, 0)
  const bd = back9.reduce ((s, h) => s + h.score - h.par, 0)
  return {
    score, par, putts, fws, obs,
    fwPct: Math.round((fws / 18) * 100),
    diff: score - par,
    frontDiff: fd,
    backDiff:  bd,
    collapse:  bd - fd,
    vsTarget: score - log.targetScore,
  }
}

function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

// ─── Issue analysis ──────────────────────────────────────────────────────────
type Severity = 'critical' | 'warning' | 'good'

type Issue = {
  id:        'putts' | 'ob' | 'fw' | 'collapse' | 'score'
  title:     string
  severity:  Severity
  current:   string
  bench:     string
  desc:      string
  category:  'putter' | 'driver' | 'approach' | 'mental'
}

function sevOrder(s: Severity) { return s === 'critical' ? 0 : s === 'warning' ? 1 : 2 }

function buildIssues(logs: RoundLog[]): Issue[] {
  const recent = logs.slice(0, 3).map(roundStats)
  const issues: Issue[] = []

  // Putts
  const ap = avg(recent.map(s => s.putts))
  if (ap >= 37) {
    issues.push({ id: 'putts', severity: 'critical', title: 'パット数が多い',
      current: `${ap.toFixed(1)}打`, bench: '目標 33打',
      desc: '3パット以上が頻発し、スコアロスの主因になっています。',
      category: 'putter' })
  } else if (ap >= 34) {
    issues.push({ id: 'putts', severity: 'warning', title: 'パット数がやや多い',
      current: `${ap.toFixed(1)}打`, bench: '目標 33打',
      desc: 'わずかに多め。距離感の精度がスコアに直結しています。',
      category: 'putter' })
  } else {
    issues.push({ id: 'putts', severity: 'good', title: 'パット数は良好',
      current: `${ap.toFixed(1)}打`, bench: '目標 33打',
      desc: 'パッティングは安定しています。このまま維持しましょう。',
      category: 'putter' })
  }

  // OB
  const ao = avg(recent.map(s => s.obs))
  if (ao >= 2) {
    issues.push({ id: 'ob', severity: 'critical', title: 'OBが多い',
      current: `${ao.toFixed(1)}回`, bench: '目標 0〜1回',
      desc: '1回につき約2打のロス。ティーショットの方向性改善が最優先です。',
      category: 'driver' })
  } else if (ao >= 1) {
    issues.push({ id: 'ob', severity: 'warning', title: 'OBがやや目立つ',
      current: `${ao.toFixed(1)}回`, bench: '目標 0回',
      desc: '大きなミスをなくすことでスコアが安定します。',
      category: 'driver' })
  } else {
    issues.push({ id: 'ob', severity: 'good', title: 'OBはほぼなし',
      current: `${ao.toFixed(1)}回`, bench: '目標 0回',
      desc: 'ティーショットは安定しています。引き続き方向性を維持して。',
      category: 'driver' })
  }

  // FW rate
  const af = avg(recent.map(s => s.fwPct))
  if (af < 40) {
    issues.push({ id: 'fw', severity: 'critical', title: 'FW率が低い',
      current: `${Math.round(af)}%`, bench: '目標 55%以上',
      desc: 'セカンドショットが難しい位置からが多く、スコアに影響しています。',
      category: 'driver' })
  } else if (af < 55) {
    issues.push({ id: 'fw', severity: 'warning', title: 'FW率がやや低い',
      current: `${Math.round(af)}%`, bench: '目標 55%以上',
      desc: 'もう少し改善するとセカンドが楽になります。',
      category: 'driver' })
  } else {
    issues.push({ id: 'fw', severity: 'good', title: 'FW率は良好',
      current: `${Math.round(af)}%`, bench: '目標 55%以上',
      desc: 'フェアウェイキープが安定しています。この精度を維持しましょう。',
      category: 'driver' })
  }

  // Back-9 collapse
  const ac = avg(recent.map(s => s.collapse))
  if (ac >= 5) {
    issues.push({ id: 'collapse', severity: 'critical', title: '後半に崩れている',
      current: `後半が前半より平均 +${ac.toFixed(1)}打`,
      bench: '目標 ±3打以内',
      desc: '疲労・メンタル・アプローチの精度低下が後半崩れの主因です。',
      category: 'mental' })
  } else if (ac >= 3) {
    issues.push({ id: 'collapse', severity: 'warning', title: '後半スコアがやや不安定',
      current: `後半が前半より平均 +${ac.toFixed(1)}打`,
      bench: '目標 ±3打以内',
      desc: '後半の集中力維持とルーティーンの徹底が効果的です。',
      category: 'mental' })
  } else if (ac >= 0) {
    issues.push({ id: 'collapse', severity: 'good', title: '前後半のバランスが良い',
      current: `後半差 +${ac.toFixed(1)}打`,
      bench: '目標 ±3打以内',
      desc: '18ホール通じてスタミナと集中力が維持できています。',
      category: 'mental' })
  } else {
    issues.push({ id: 'collapse', severity: 'good', title: '後半の方が安定している',
      current: `後半差 ${ac.toFixed(1)}打`,
      bench: '目標 ±3打以内',
      desc: '後半に強いという特徴があります。この強みを活かしましょう。',
      category: 'mental' })
  }

  return issues.sort((a, b) => sevOrder(a.severity) - sevOrder(b.severity))
}

// ─── AI comment ───────────────────────────────────────────────────────────────
type AIComment = { issue: string; practice: string; round: string }

function buildAIComment(logs: RoundLog[], issues: Issue[]): AIComment {
  const top = issues.find(i => i.severity !== 'good')
  const stats3 = logs.slice(0, 3).map(roundStats)
  const avgScore = avg(stats3.map(s => s.score))

  if (!top) {
    return {
      issue:    `平均スコア ${avgScore.toFixed(1)} で、全カテゴリがバランスよく安定しています。次の目標設定をしましょう。`,
      practice: `各カテゴリの中で最もスコアへの貢献度が高い技術を一つ選び、重点的に磨く段階です。`,
      round:    `コースマネジメントに集中し、リスク管理を意識した戦略的なプレーを心がけましょう。`,
    }
  }

  const map: Record<Issue['id'], AIComment> = {
    putts: {
      issue:    `パット数が平均 ${avg(stats3.map(s => s.putts)).toFixed(1)} 打と多く、スコアロスの最大要因になっています。`,
      practice: `1.5m〜3mのショートパット反復練習を週3回・20分実施してください。「入れにいく」より「距離感のキャリブレーション」が先決です。`,
      round:    `ファーストパットは「カップの1m手前に止める」距離感を意識。3パットを防ぐことで大きくスコアが改善します。`,
    },
    ob: {
      issue:    `OBが平均 ${avg(stats3.map(s => s.obs)).toFixed(1)} 回発生。1回につき約2打のペナルティが積み重なっています。`,
      practice: `ドライバーを 3/4 スイングに抑えて方向性を優先した練習を。広いフェアウェイへの「安全な向き」設定がカギです。`,
      round:    `ティーショットはコースの広い側に向けてアドレス。距離より確実なフェアウェイキープを最優先にしてください。`,
    },
    fw: {
      issue:    `FW率 ${Math.round(avg(stats3.map(s => s.fwPct)))}% と低く、セカンド以降が難しい状況から打つことが多くなっています。`,
      practice: `ドライバーより3番ウッドやユーティリティの使用頻度を上げ、ティーショットの安定性から整えましょう。`,
      round:    `ロングホールでも無理にドライバーを使わず、FWキープできるクラブ選択を優先してください。`,
    },
    collapse: {
      issue:    `後半スコアが前半より平均 +${avg(stats3.map(s => s.collapse)).toFixed(1)} 打多く、疲労・集中力の低下が影響しています。`,
      practice: `ラウンドシミュレーション（18H通し）で後半の集中力維持を訓練しましょう。アプローチ精度の向上も後半崩れ防止に直結します。`,
      round:    `10番ホールを「新ゲームのスタート」と捉え、前半スコアを完全にリセット。後半1ホール目の入り方が最重要です。`,
    },
    score: {
      issue:    `目標スコアとの差が平均 +${avg(stats3.map(s => s.vsTarget)).toFixed(1)} 打あります。改善ポイントを絞って取り組みましょう。`,
      practice: `まずは一つの技術に集中した練習を継続することがスコアアップへの近道です。`,
      round:    `1ホールごとにリセットし、プロセスに集中することで安定したスコアが生まれます。`,
    },
  }

  return map[top.id]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function diffLabel(diff: number) {
  if (diff === 0) return 'E'
  return diff > 0 ? `+${diff}` : `${diff}`
}

function diffColor(diff: number) {
  if (diff <= -2) return GOLD
  if (diff === -1) return FOREST_LIGHT
  if (diff === 0)  return MUTED
  if (diff === 1)  return BOGEY_AMB
  return TERRACOTTA
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionCard({ accent, title, children }: {
  accent: string; title: string; children: React.ReactNode
}) {
  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)', overflow: 'hidden' }}>
      <div style={{ height: '3px', backgroundColor: accent }} />
      <div style={{ padding: '16px 16px 18px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, letterSpacing: '0.06em', marginBottom: '14px' }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function StatGrid({ items }: { items: { label: string; value: string; sub?: string; color?: string }[] }) {
  return (
    <div style={{ display: 'flex' }}>
      {items.map(({ label, value, sub, color }, i) => (
        <div key={label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? `1px solid ${SAND_LIGHT}` : 'none', padding: '0 4px' }}>
          <div style={{ fontSize: '10px', color: MUTED, marginBottom: '3px' }}>{label}</div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: color ?? INK, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>{sub}</div>}
        </div>
      ))}
    </div>
  )
}

// ─── Trend charts (4 metrics, up to 5 rounds) ────────────────────────────────

type TrendPoint = {
  value: number
  date: string
  barColor: string
  targetMark?: number  // per-bar target value (score chart uses this)
}

function MiniBarChart({
  points, goodDir, chartMin, chartMax,
  targetLine, targetLabel, valueFormatter,
}: {
  points: TrendPoint[]
  goodDir: 'low' | 'high'
  chartMin: number
  chartMax: number
  targetLine?: number
  targetLabel?: string
  valueFormatter?: (v: number) => string
}) {
  const BAR_H = 56
  const range = Math.max(1, chartMax - chartMin)
  const fmt   = valueFormatter ?? ((v: number) => String(v))
  const hasPerBarTargets = points.some(p => p.targetMark !== undefined)

  const toH = (v: number) =>
    Math.max(2, Math.min(BAR_H, Math.round(
      goodDir === 'low'
        ? ((chartMax - v) / range) * BAR_H
        : ((v    - chartMin) / range) * BAR_H
    )))

  const globalTargetH = !hasPerBarTargets && targetLine !== undefined ? toH(targetLine) : null

  return (
    <div>
      {/* Value labels */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '3px' }}>
        {points.map((p, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{
              fontSize: '10px',
              fontWeight: i === points.length - 1 ? 700 : 400,
              color: i === points.length - 1 ? p.barColor : MUTED,
            }}>
              {fmt(p.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div style={{ position: 'relative', height: `${BAR_H}px` }}>
        {globalTargetH !== null && (
          <div style={{
            position: 'absolute', bottom: `${globalTargetH}px`,
            left: 0, right: 0, height: '1.5px',
            backgroundColor: `${TERRACOTTA}55`, zIndex: 1,
          }} />
        )}
        <div style={{ display: 'flex', gap: '4px', height: '100%' }}>
          {points.map((p, i) => {
            const h   = toH(p.value)
            const ptH = p.targetMark !== undefined ? toH(p.targetMark) : null
            const isLatest = i === points.length - 1
            return (
              <div key={i} style={{ flex: 1, position: 'relative', height: '100%' }}>
                {ptH !== null && (
                  <div style={{
                    position: 'absolute', bottom: `${ptH}px`,
                    left: 0, right: 0, height: '1.5px',
                    backgroundColor: `${TERRACOTTA}70`,
                  }} />
                )}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: `${h}px`,
                  backgroundColor: isLatest ? p.barColor : `${p.barColor}55`,
                  borderRadius: '3px 3px 0 0',
                }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Date labels */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
        {points.map((p, i) => {
          const parts = p.date.split('-')
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <span style={{ fontSize: '9px', color: MUTED }}>
                {Number(parts[1])}/{Number(parts[2])}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      {targetLabel && (
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '14px', height: '1.5px', backgroundColor: `${TERRACOTTA}70`, borderRadius: '1px' }} />
          <span style={{ fontSize: '10px', color: MUTED }}>{targetLabel}</span>
        </div>
      )}
    </div>
  )
}

function TrendChartsSection({ logs }: { logs: RoundLog[] }) {
  const shown = logs.slice(0, 5).reverse()  // oldest → newest

  if (shown.length <= 1) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '30px' }}>📊</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: INK }}>推移グラフはもうすぐ表示されます</div>
        <div style={{ fontSize: '12px', color: MUTED }}>あと1ラウンド記録すると推移が見られます</div>
        <Link href="/round" style={{ marginTop: '4px', padding: '10px 20px', borderRadius: '8px', backgroundColor: FOREST, color: '#fff', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
          ラウンドを記録する
        </Link>
      </div>
    )
  }

  const stats    = shown.map(l => roundStats(l))
  const scores   = stats.map(s => s.score)
  const targets  = shown.map(l => l.targetScore)
  const puttsArr = stats.map(s => s.putts)
  const obsArr   = stats.map(s => s.obs)
  const fwArr    = stats.map(s => s.fwPct)

  const scorePoints: TrendPoint[] = shown.map((log, i) => ({
    value: stats[i].score,
    date: log.date,
    barColor: stats[i].score <= log.targetScore ? FOREST_LIGHT : diffColor(stats[i].diff),
    targetMark: log.targetScore,
  }))

  const puttsPoints: TrendPoint[] = stats.map((st, i) => ({
    value: st.putts, date: shown[i].date,
    barColor: st.putts <= 33 ? FOREST_LIGHT : st.putts <= 36 ? BOGEY_AMB : TERRACOTTA,
  }))

  const obPoints: TrendPoint[] = stats.map((st, i) => ({
    value: st.obs, date: shown[i].date,
    barColor: st.obs === 0 ? FOREST_LIGHT : st.obs <= 1 ? BOGEY_AMB : TERRACOTTA,
  }))

  const fwPoints: TrendPoint[] = stats.map((st, i) => ({
    value: st.fwPct, date: shown[i].date,
    barColor: st.fwPct >= 55 ? FOREST_LIGHT : st.fwPct >= 40 ? BOGEY_AMB : TERRACOTTA,
  }))

  const aScore = avg(scores)
  const aPutts = avg(puttsArr)
  const aObs   = avg(obsArr)
  const aFw    = avg(fwArr)

  const scoreMin = Math.min(...scores, ...targets) - 3
  const scoreMax = Math.max(...scores, ...targets) + 3
  const puttsMin = Math.max(0, Math.min(...puttsArr) - 2)
  const puttsMax = Math.max(...puttsArr, 36) + 3
  const obMax    = Math.max(...obsArr, 3) + 1

  const D = <div style={{ height: '1px', backgroundColor: SAND_LIGHT, margin: '16px 0' }} />

  return (
    <div>
      {/* ① スコア */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em' }}>スコア</span>
        <span style={{ fontSize: '11px', color: MUTED }}>
          直近平均 <span style={{ fontWeight: 700, color: FOREST }}>{aScore.toFixed(1)}</span>
        </span>
      </div>
      <MiniBarChart
        points={scorePoints} goodDir="low"
        chartMin={scoreMin} chartMax={scoreMax}
        targetLabel="目標スコア（各ラウンド）"
      />

      {D}

      {/* ② パット数 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em' }}>パット数</span>
        <span style={{ fontSize: '11px', color: MUTED }}>
          直近平均 <span style={{ fontWeight: 700, color: aPutts <= 33 ? FOREST_LIGHT : aPutts <= 36 ? BOGEY_AMB : TERRACOTTA }}>{aPutts.toFixed(1)}</span> 打
        </span>
      </div>
      <MiniBarChart
        points={puttsPoints} goodDir="low"
        chartMin={puttsMin} chartMax={puttsMax}
        targetLine={33} targetLabel="目標 33打"
      />

      {D}

      {/* ③ OB数 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em' }}>OB数</span>
        <span style={{ fontSize: '11px', color: MUTED }}>
          直近平均 <span style={{ fontWeight: 700, color: aObs < 1 ? FOREST_LIGHT : aObs < 2 ? BOGEY_AMB : TERRACOTTA }}>{aObs.toFixed(1)}</span> 回
        </span>
      </div>
      <MiniBarChart
        points={obPoints} goodDir="low"
        chartMin={0} chartMax={obMax}
        targetLine={1} targetLabel="目標 1回以内"
      />

      {D}

      {/* ④ FW率 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED, letterSpacing: '0.04em' }}>FW率</span>
        <span style={{ fontSize: '11px', color: MUTED }}>
          直近平均 <span style={{ fontWeight: 700, color: aFw >= 55 ? FOREST_LIGHT : aFw >= 40 ? BOGEY_AMB : TERRACOTTA }}>{Math.round(aFw)}</span>%
        </span>
      </div>
      <MiniBarChart
        points={fwPoints} goodDir="high"
        chartMin={0} chartMax={100}
        targetLine={55} targetLabel="目標 55%以上"
        valueFormatter={v => `${v}%`}
      />
    </div>
  )
}

// Issue severity badge
function SevBadge({ sev }: { sev: Severity }) {
  const cfg = {
    critical: { label: '要改善', color: TERRACOTTA, bg: `${TERRACOTTA}14` },
    warning:  { label: '注意',   color: BOGEY_AMB,  bg: `${BOGEY_AMB}14` },
    good:     { label: '良好',   color: FOREST_LIGHT,bg: `${FOREST_LIGHT}18` },
  }[sev]
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.color, backgroundColor: cfg.bg, borderRadius: '4px', padding: '2px 7px', flexShrink: 0 }}>
      {cfg.label}
    </span>
  )
}

// Issue rank item
function IssueItem({ issue, rank }: { issue: Issue; rank: number }) {
  const rankColor = rank === 1 ? TERRACOTTA : rank === 2 ? BOGEY_AMB : MUTED
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 0', borderBottom: `1px solid ${SAND_LIGHT}` }}>
      <div style={{ flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', backgroundColor: `${rankColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: rankColor }}>{rank}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: INK }}>{issue.title}</span>
          <SevBadge sev={issue.severity} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: issue.severity === 'good' ? FOREST_LIGHT : TERRACOTTA }}>{issue.current}</span>
          <span style={{ fontSize: '11px', color: MUTED }}>{issue.bench}</span>
        </div>
        <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.55 }}>{issue.desc}</div>
      </div>
    </div>
  )
}

// AI comment row
function CommentRow({ accent, icon, label, text }: {
  accent: string; icon: React.ReactNode; label: string; text: string
}) {
  return (
    <div style={{ display: 'flex', gap: '11px', paddingTop: '13px' }}>
      <div style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '8px', backgroundColor: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: accent, letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '13px', color: INK, lineHeight: 1.7 }}>{text}</div>
      </div>
    </div>
  )
}

// Improvement menu card
type MenuDef = {
  id: string; title: string; subtitle: string
  points: string[]; color: string; bg: string
  emoji: string; relatedIssueIds: Issue['id'][]
}

const MENUS: MenuDef[] = [
  {
    id: 'putter', title: 'パター練習', subtitle: '3パット削減・距離感向上',
    points: ['1.5〜3mのショートパット反復', '距離感ドリル（5m / 10m / 15m）', 'ルーティーン確立と反復'],
    color: FOREST, bg: `${FOREST}10`, emoji: '🏁', relatedIssueIds: ['putts'],
  },
  {
    id: 'driver', title: 'ドライバー方向性', subtitle: 'OB・大きなミス防止',
    points: ['フェース向き確認ドリル', 'ティーショット 3/4 スイング', '安全マージンを考えたアドレス'],
    color: FOREST_MID, bg: `${FOREST_MID}10`, emoji: '🏌️', relatedIssueIds: ['ob', 'fw'],
  },
  {
    id: 'approach', title: 'アプローチ距離感', subtitle: 'グリーン周りの精度向上',
    points: ['30yd以内チップショット反復', '転がしアプローチ優先練習', 'ライ別クラブ選択力向上'],
    color: TERRACOTTA, bg: `${TERRACOTTA}10`, emoji: '🎯', relatedIssueIds: ['collapse'],
  },
  {
    id: 'mental', title: 'メンタル/ルーティーン', subtitle: '後半崩れ防止・集中力維持',
    points: ['1ホールごとリセット習慣化', 'ショット前ルーティーン徹底', 'スコアより過程に集中する意識'],
    color: '#7A5800', bg: '#7A580010', emoji: '🧘', relatedIssueIds: ['collapse'],
  },
]

function MenuCard({ menu, priority }: { menu: MenuDef; priority: boolean }) {
  return (
    <div style={{ backgroundColor: CARD, borderRadius: '12px', border: `1.5px solid ${priority ? menu.color : SAND_LIGHT}`, overflow: 'hidden', boxShadow: priority ? `0 2px 12px ${menu.color}20` : 'none' }}>
      {priority && <div style={{ height: '3px', backgroundColor: menu.color }} />}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: menu.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
            {menu.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: INK }}>{menu.title}</span>
              {priority && (
                <span style={{ fontSize: '10px', fontWeight: 700, color: menu.color, backgroundColor: menu.bg, borderRadius: '4px', padding: '2px 6px' }}>
                  優先
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>{menu.subtitle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {menu.points.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flexShrink: 0, marginTop: '4px', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: menu.color }} />
              <span style={{ fontSize: '12px', color: INK, lineHeight: 1.55 }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center', gap: '12px' }}>
      <div style={{ fontSize: '56px', marginBottom: '4px' }}>⛳</div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: INK }}>まだ分析データがありません</div>
      <div style={{ fontSize: '14px', color: MUTED, lineHeight: 1.7, maxWidth: '280px' }}>
        ラウンドを記録すると、スコア傾向・課題ランキング・AI改善コメントが自動で表示されます。
      </div>
      <Link href="/round" style={{ marginTop: '8px', padding: '14px 28px', borderRadius: '10px', backgroundColor: FOREST, color: '#fff', fontSize: '14px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
        ラウンドを記録する
      </Link>
    </div>
  )
}

// ─── Horizontal meter bar ─────────────────────────────────────────────────────
function MeterBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: MUTED, marginBottom: '4px' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: '6px', backgroundColor: SAND_LIGHT, borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const [logs,         setLogs]         = useState<RoundLog[]>([])
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([])
  const [ready,        setReady]        = useState(false)

  useEffect(() => {
    let rounds: RoundLog[] = []
    let practices: PracticeLog[] = []
    try {
      const raw = localStorage.getItem(ROUND_KEY)
      rounds = raw ? JSON.parse(raw) : []
      // ④ 最新ラウンドを優先表示: savedAt降順でソート
      rounds.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
      const rawP = localStorage.getItem(PRACTICE_KEY)
      practices = rawP ? JSON.parse(rawP) : []
    } catch {}
    startTransition(() => {
      setLogs(rounds)
      setPracticeLogs(practices)
      setReady(true)
    })
  }, [])

  const hasData = logs.length > 0
  const latest  = hasData ? roundStats(logs[0]) : null
  const recent3 = logs.slice(0, 3).map(roundStats)
  const issues  = hasData ? buildIssues(logs) : []
  const aiComment = hasData ? buildAIComment(logs, issues) : null
  const criticalIds = issues.filter(i => i.severity !== 'good').map(i => i.id)
  const priorityMenus = new Set(MENUS.filter(m => m.relatedIssueIds.some(id => criticalIds.includes(id))).map(m => m.id))

  const avgScore  = avg(recent3.map(s => s.score))
  const avgPutts  = avg(recent3.map(s => s.putts))
  const avgObs    = avg(recent3.map(s => s.obs))
  const avgFwPct  = avg(recent3.map(s => s.fwPct))

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', backgroundColor: CREAM }}>

      {/* Header */}
      <header style={{ backgroundColor: FOREST, padding: '52px 20px 22px' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', letterSpacing: '0.15em', marginBottom: '6px', fontWeight: 500 }}>GOLF LOOP</div>
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>スコア分析</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', margin: '4px 0 0' }}>
          {hasData ? `直近 ${Math.min(logs.length, 3)} ラウンドのデータから分析` : '保存済みラウンドから課題を見える化'}
        </p>
      </header>

      <main style={{ padding: '18px 16px 110px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {!ready && (
          <div style={{ textAlign: 'center', padding: '40px', color: MUTED }}>読み込み中...</div>
        )}

        {ready && !hasData && <EmptyState />}

        {ready && hasData && latest && (
          <>
            {/* ① Latest round summary */}
            <SectionCard accent={FOREST} title="直近ラウンドのサマリー">
              {/* Big score */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <div style={{ color: MUTED, fontSize: '11px', marginBottom: '4px' }}>
                    {logs[0].courseName || 'コース未記入'}　{logs[0].date.slice(5).replace('-', '/')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '48px', fontWeight: 700, color: FOREST, lineHeight: 1, letterSpacing: '-0.02em' }}>
                      {latest.score}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: diffColor(latest.diff) }}>
                      {diffLabel(latest.diff)}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: MUTED, marginBottom: '2px' }}>目標 {logs[0].targetScore}</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: latest.vsTarget <= 0 ? FOREST_LIGHT : TERRACOTTA }}>
                    {latest.vsTarget <= 0 ? '✓ 達成' : `+${latest.vsTarget} 打`}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${SAND_LIGHT}`, paddingTop: '14px' }}>
                <StatGrid items={[
                  { label: 'パット',  value: String(latest.putts), sub: latest.putts <= 33 ? '◎' : latest.putts <= 36 ? '△' : '×', color: latest.putts <= 33 ? FOREST_LIGHT : latest.putts <= 36 ? BOGEY_AMB : TERRACOTTA },
                  { label: 'OB',     value: String(latest.obs),   sub: latest.obs === 0 ? '◎' : latest.obs === 1 ? '△' : '×',    color: latest.obs === 0 ? FOREST_LIGHT : latest.obs <= 1 ? BOGEY_AMB : TERRACOTTA },
                  { label: 'FW率',   value: `${latest.fwPct}%`,   sub: latest.fwPct >= 55 ? '◎' : latest.fwPct >= 40 ? '△' : '×', color: latest.fwPct >= 55 ? FOREST_LIGHT : latest.fwPct >= 40 ? BOGEY_AMB : TERRACOTTA },
                  { label: '前半',   value: `${latest.frontDiff >= 0 ? '+' : ''}${latest.frontDiff}` },
                  { label: '後半',   value: `${latest.backDiff >= 0 ? '+' : ''}${latest.backDiff}` },
                ]} />
              </div>
            </SectionCard>

            {/* ② 推移グラフ（直近5ラウンド） */}
            <SectionCard accent={FOREST_MID} title="推移グラフ（直近5ラウンド）">
              <TrendChartsSection logs={logs} />
            </SectionCard>

            <SectionCard accent={FOREST_MID} title={`直近 ${recent3.length} ラウンド平均`}>
              {/* Average score big */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '36px', fontWeight: 700, color: FOREST, lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {avgScore.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>平均スコア</div>
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: avgPutts <= 33 ? FOREST_LIGHT : avgPutts <= 36 ? BOGEY_AMB : TERRACOTTA }}>
                      {avgPutts.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>平均パット</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: avgObs < 1 ? FOREST_LIGHT : avgObs < 2 ? BOGEY_AMB : TERRACOTTA }}>
                      {avgObs.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>平均OB</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: avgFwPct >= 55 ? FOREST_LIGHT : avgFwPct >= 40 ? BOGEY_AMB : TERRACOTTA }}>
                      {Math.round(avgFwPct)}%
                    </div>
                    <div style={{ fontSize: '10px', color: MUTED, marginTop: '2px' }}>平均FW率</div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${SAND_LIGHT}`, paddingTop: '12px' }}>
                <MeterBar value={avgPutts} max={45} color={avgPutts <= 33 ? FOREST_LIGHT : BOGEY_AMB} label="パット数" />
                <MeterBar value={avgFwPct} max={100} color={avgFwPct >= 55 ? FOREST_LIGHT : BOGEY_AMB} label="FW率 (%)" />
                <MeterBar value={Math.max(0, avgObs)} max={5} color={avgObs < 1 ? FOREST_LIGHT : TERRACOTTA} label="OB回数" />
              </div>
            </SectionCard>

            {/* ③ Issue ranking */}
            <SectionCard accent={TERRACOTTA} title="課題ランキング">
              <div style={{ margin: '-2px 0' }}>
                {issues.map((issue, i) => (
                  <IssueItem key={issue.id} issue={issue} rank={i + 1} />
                ))}
              </div>
              <div style={{ fontSize: '11px', color: MUTED, marginTop: '12px', paddingTop: '2px' }}>
                直近 {recent3.length} ラウンドのデータに基づく分析
              </div>
            </SectionCard>

            {/* ④ AI comment */}
            {aiComment && (
              <div style={{ backgroundColor: CARD, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(28,66,48,0.07)' }}>
                <div style={{ height: '3px', background: `linear-gradient(90deg, ${FOREST}, #7ECB9E)` }} />
                <div style={{ padding: '16px 16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: `${FOREST}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                      </svg>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: FOREST }}>AI コーチからのアドバイス</span>
                  </div>
                  <div style={{ borderTop: `1px solid ${SAND_LIGHT}`, marginTop: '12px' }}>
                    <CommentRow
                      accent={TERRACOTTA} label="今の最大課題"
                      text={aiComment.issue}
                      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TERRACOTTA} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>}
                    />
                    <CommentRow
                      accent={FOREST_LIGHT} label="次回練習でやること"
                      text={aiComment.practice}
                      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FOREST_LIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>}
                    />
                    <CommentRow
                      accent={GOLD} label="次回ラウンドで意識すること"
                      text={aiComment.round}
                      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="21"/><path d="M6 4L17 7.5L6 11V4Z"/></svg>}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ⑤ 練習ログ × 分析 連携 (requirement 5) */}
            {practiceLogs.length > 0 && (() => {
              const lp        = practiceLogs[0]
              const topIssue  = issues.find(i => i.severity !== 'good')
              const recCats   = topIssue ? (ISSUE_CAT_TO_PRACTICE[topIssue.category] ?? []) : []
              const isAligned = lp.categories.some(c => recCats.includes(c))
              const recTheme  = topIssue ? ISSUE_RECOMMENDED_THEME[topIssue.id] : ''
              const [, pm, pd] = lp.date.split('-')
              const dateLabel = `${Number(pm)}/${Number(pd)}`
              return (
                <div style={{ backgroundColor: CARD, borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)', overflow: 'hidden' }}>
                  <div style={{ height: '3px', backgroundColor: GOLD }} />
                  <div style={{ padding: '16px 16px 18px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, letterSpacing: '0.06em', marginBottom: '14px' }}>
                      練習ログ × 分析 連携
                    </div>

                    {/* Latest practice summary */}
                    <div style={{ backgroundColor: `${FOREST}07`, borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: FOREST }}>最新練習（{dateLabel}）</span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {lp.categories.map(c => (
                            <span key={c} style={{ fontSize: '10px', color: FOREST_MID, backgroundColor: `${FOREST}12`, borderRadius: '3px', padding: '1px 6px', fontWeight: 600 }}>
                              {CATEGORY_LABEL[c]}
                            </span>
                          ))}
                        </div>
                      </div>
                      {lp.theme && (
                        <div style={{ fontSize: '13px', color: INK, fontWeight: 500, marginBottom: lp.next ? '4px' : 0 }}>
                          「{lp.theme}」
                        </div>
                      )}
                      {lp.next && (
                        <div style={{ fontSize: '12px', color: MUTED }}>次回予定：{lp.next.slice(0, 36)}</div>
                      )}
                    </div>

                    {/* Alignment check */}
                    {topIssue && (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '8px', backgroundColor: isAligned ? `${FOREST_LIGHT}18` : `${GOLD}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isAligned ? (
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={FOREST_LIGHT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2,8 6,12 14,4" />
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12,5 19,12 12,19" />
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          {isAligned ? (
                            <>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST_LIGHT, marginBottom: '3px' }}>
                                練習が課題に合致しています
                              </div>
                              <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6 }}>
                                分析最優先課題「{topIssue.title}」に対して、現在の練習内容が正しい方向性で取り組めています。この調子で継続しましょう。
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: GOLD, marginBottom: '3px' }}>
                                次回練習テーマの推奨
                              </div>
                              <div style={{ fontSize: '12px', color: INK, lineHeight: 1.6 }}>
                                最優先課題「{topIssue.title}」の解消に向け、次回は以下に重点を置くことをお勧めします。
                              </div>
                              <div style={{ marginTop: '6px', padding: '8px 12px', backgroundColor: `${GOLD}10`, borderRadius: '6px', fontSize: '12px', color: INK, fontWeight: 500, lineHeight: 1.6 }}>
                                {recTheme}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ⑥ Improvement menu */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: FOREST, letterSpacing: '0.06em', marginBottom: '10px', paddingLeft: '2px' }}>改善メニュー</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {MENUS.sort((a, b) => {
                  const ap = priorityMenus.has(a.id) ? 0 : 1
                  const bp = priorityMenus.has(b.id) ? 0 : 1
                  return ap - bp
                }).map(menu => (
                  <MenuCard key={menu.id} menu={menu} priority={priorityMenus.has(menu.id)} />
                ))}
              </div>
            </div>

            {/* ⑦ Next steps */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 2px 12px rgba(28,66,48,0.07)', overflow: 'hidden' }}>
              <div style={{ backgroundColor: FOREST, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12,5 19,12 12,19" />
                </svg>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }}>次のステップ</span>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { href: '/practice', label: '練習ログを記録する', sub: '課題に向けた練習テーマを残す',
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg> },
                  { href: '/round-plan', label: 'ラウンドを準備する', sub: '次回ラウンドの戦略プランを作成',
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TERRACOTTA} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
                  { href: '/round', label: 'ラウンドを記録する', sub: '新しいラウンドのスコアを入力',
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TERRACOTTA} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg> },
                ].map(({ href, label, sub, icon }) => (
                  <Link key={href} href={href} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                    backgroundColor: '#FAF8F0', borderRadius: '10px', textDecoration: 'none',
                    border: `1px solid #E8DFCE`,
                  }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(28,66,48,0.08)' }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1C1C1C' }}>{label}</div>
                      <div style={{ fontSize: '11px', color: '#6B7060', marginTop: '2px' }}>{sub}</div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9,18 15,12 9,6" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
