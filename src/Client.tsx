import { useEffect, useMemo, useRef, useState } from 'react'
import type { DataConnection } from 'peerjs'
import { COMPONENTS, CONDITIONS, TITLE, TOTAL_POINTS, type ComponentKey, type ConditionKey } from './content'
import { playScore, type Answer, type ToClient, type ToHost, type Tri } from './model'
import { newPeer } from './net'
import { Radar } from './components/Radar'

type Status = 'connecting' | 'online' | 'offline'
type Step = 'intro' | 'points' | 'conds' | 'comment' | 'result'

function clientId(fixed: string | null): string {
  if (fixed) return fixed
  try {
    const k = 'asobi-cid'
    let v = localStorage.getItem(k)
    if (!v) {
      v = Math.random().toString(36).slice(2, 10)
      localStorage.setItem(k, v)
    }
    return v
  } catch {
    return Math.random().toString(36).slice(2, 10)
  }
}

const emptyPoints = () => Object.fromEntries(COMPONENTS.map((c) => [c.key, 0])) as Record<ComponentKey, number>

export default function Client({ room, fixedCid }: { room: string; fixedCid: string | null }) {
  const cid = useMemo(() => clientId(fixedCid), [fixedCid])
  const [status, setStatus] = useState<Status>('connecting')
  const [reveal, setReveal] = useState(false)
  const [step, setStep] = useState<Step>('intro')
  const [points, setPoints] = useState(emptyPoints)
  const [conds, setConds] = useState<Partial<Record<ConditionKey, Tri>>>({})
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState<'no' | 'sending' | 'ok'>('no')
  const connRef = useRef<DataConnection | null>(null)
  const pendingRef = useRef<ToHost | null>(null)

  // ---- 接続（切れたら3秒ごとに再接続） ----
  useEffect(() => {
    const peer = newPeer()
    let timer: number | undefined
    let alive = true
    const connect = () => {
      if (!alive || peer.destroyed) return
      if (peer.disconnected) peer.reconnect()
      const conn = peer.connect(room, { reliable: true })
      conn.on('open', () => {
        connRef.current = conn
        setStatus('online')
        if (pendingRef.current) conn.send(pendingRef.current)
      })
      conn.on('data', (raw) => {
        const msg = raw as ToClient
        if (msg.t === 'state') setReveal(msg.reveal)
        if (msg.t === 'ack' && msg.cid === cid) {
          pendingRef.current = null
          setSent('ok')
        }
      })
      const retry = () => {
        if (connRef.current === conn) connRef.current = null
        setStatus('offline')
        window.clearTimeout(timer)
        timer = window.setTimeout(connect, 3000)
      }
      conn.on('close', retry)
      conn.on('error', retry)
    }
    peer.on('open', connect)
    peer.on('error', (e) => {
      setStatus('offline')
      if ((e as { type?: string }).type === 'peer-unavailable') {
        window.clearTimeout(timer)
        timer = window.setTimeout(connect, 3000)
      }
    })
    return () => {
      alive = false
      window.clearTimeout(timer)
      peer.destroy()
    }
  }, [room, cid])

  const used = COMPONENTS.reduce((s, c) => s + points[c.key], 0)
  const left = TOTAL_POINTS - used
  const condsDone = CONDITIONS.every((c) => conds[c.key] !== undefined)

  // その時点の回答全体（未回答の質問は null）
  const snapshot = (): Answer => ({
    points,
    conds: Object.fromEntries(CONDITIONS.map((c) => [c.key, conds[c.key] ?? null])) as Record<ConditionKey, Tri | null>,
    comment: comment.trim().slice(0, 60),
    at: Date.now(),
  })
  const answer: Answer | null = condsDone ? snapshot() : null

  // 各画面の「次へ」「結果を見る」で、全体を送ってから次の画面へ
  const sendAndGo = (next: Step) => {
    const msg: ToHost = { t: 'submit', cid, answer: snapshot() }
    pendingRef.current = msg
    setSent('sending')
    connRef.current?.send(msg)
    setStep(next)
  }

  const name = '推し活'
  const compLabel = (c: (typeof COMPONENTS)[number]) => (reveal ? `${c.theory}（${c.theorySub}）` : c.plain)

  return (
    <div className="min-h-dvh bg-surface flex flex-col text-[15px]">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="font-bold text-lg">{TITLE}</h1>
        <StatusDot status={status} />
      </header>

      <main className="flex-1 px-4 pb-6">
        {step === 'intro' && (
          <section className="space-y-4">
            <h2 className="font-bold text-xl leading-snug">あなたの「推し活」の遊び度を分析します</h2>
            <p className="text-ink2 leading-relaxed">2つのものさしで、あなたの推し活を分析します。</p>
            <ol className="space-y-2 text-ink2 leading-relaxed list-decimal pl-5">
              <li>
                <b className="text-ink">「楽しい」の成分</b>：4つの成分に{TOTAL_POINTS}ポイントを配分します
              </li>
              <li>
                <b className="text-ink">6つの質問</b>：はい／どちらとも／いいえで答えます。ここから、推し活があなたにとってどのくらい「遊び」なのか（<b className="text-ink">遊び度</b>、0〜100%）を出します
              </li>
            </ol>
            <p className="text-ink2 leading-relaxed">
              最後に「結果を見る」を押すと、あなたの分析結果が表示されます。回答は匿名で、スクリーンにはクラス全体の集計だけが映ります。
            </p>
            <p className="text-sm text-ink2 leading-relaxed">
              推しがいない人は、身近な人の推し活や、自分が「推し」に近い気持ちで楽しんでいるもの（作品・キャラクター・チームなど）を思い浮かべて答えてください。
            </p>
            <Primary onClick={() => setStep('points')}>はじめる</Primary>
          </section>
        )}

        {step === 'points' && (
          <section className="space-y-3">
            <h2 className="font-bold leading-snug">
              {name}の「楽しい」は、どれでできていますか？
              <span className="block text-sm font-normal text-ink2 mt-1">{TOTAL_POINTS}ポイントを配分してください</span>
            </h2>
            <div className="sticky top-0 bg-surface py-1 z-10">
              <div className={`text-center font-bold rounded-lg py-1.5 ${left === 0 ? 'bg-green-100 text-green-800' : 'bg-stone-100'}`}>
                残り {left} ポイント
              </div>
            </div>
            {COMPONENTS.map((c) => (
              <div key={c.key} className="rounded-xl border border-stone-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: c.color }} />
                  <span className="font-bold">{compLabel(c)}</span>
                </div>
                <div className="text-sm text-ink2 ml-5">{reveal ? c.plain : c.hint}</div>
                <div className="flex items-center gap-3 mt-2 ml-5">
                  <Step onClick={() => setPoints((p) => ({ ...p, [c.key]: Math.max(0, p[c.key] - 1) }))} disabled={points[c.key] === 0}>
                    −
                  </Step>
                  <div className="flex gap-0.5 flex-1">
                    {Array.from({ length: TOTAL_POINTS }).map((_, i) => (
                      <span key={i} className="h-3 flex-1 rounded-[2px]" style={{ background: i < points[c.key] ? c.color : '#ebeae6' }} />
                    ))}
                  </div>
                  <Step onClick={() => setPoints((p) => ({ ...p, [c.key]: p[c.key] + 1 }))} disabled={left === 0}>
                    ＋
                  </Step>
                  <span className="w-5 text-right tabular-nums font-bold">{points[c.key]}</span>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Secondary onClick={() => setStep('intro')}>戻る</Secondary>
              <Primary disabled={left !== 0} onClick={() => sendAndGo('conds')}>
                次へ
              </Primary>
            </div>
          </section>
        )}

        {step === 'conds' && (
          <section className="space-y-3">
            <h2 className="font-bold">あなたの{name}に、あてはまりますか？</h2>
            {CONDITIONS.map((c, i) => (
              <div key={c.key} className="rounded-xl border border-stone-200 bg-white p-3">
                <div className="font-bold leading-snug">
                  {i + 1}. {c.plain}
                </div>
                {reveal && <div className="text-sm text-ink2 mt-0.5">カイヨワ：{c.theory}</div>}
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {([
                    [1, 'はい'],
                    [0.5, 'どちらとも'],
                    [0, 'いいえ'],
                  ] as [Tri, string][]).map(([v, label]) => (
                    <button
                      key={label}
                      onClick={() => setConds((p) => ({ ...p, [c.key]: v }))}
                      className={`rounded-lg py-2 text-sm font-bold border ${conds[c.key] === v ? 'bg-ink text-white border-ink' : 'bg-white border-stone-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Secondary onClick={() => setStep('points')}>戻る</Secondary>
              <Primary disabled={!condsDone} onClick={() => sendAndGo('comment')}>
                次へ
              </Primary>
            </div>
          </section>
        )}

        {step === 'comment' && (
          <section className="space-y-3">
            <h2 className="font-bold">{name}で、いちばん楽しい瞬間は？（任意）</h2>
            <textarea
              value={comment}
              maxLength={60}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="ひとことで（60字まで）"
              className="w-full rounded-xl border border-stone-300 bg-white p-3"
            />
            <div className="flex gap-2">
              <Secondary onClick={() => setStep('conds')}>戻る</Secondary>
              <Primary onClick={() => sendAndGo('result')}>結果を見る</Primary>
            </div>
          </section>
        )}

        {step === 'result' && answer && (
          <section className="space-y-4 text-center">
            <div className="text-sm text-ink2">
              {sent === 'ok' ? '送信しました。スクリーンを見てください' : status === 'online' ? '送信中…' : '接続を待っています（自動で送信します）'}
            </div>
            {/* ブロック1：「楽しい」の成分（配分したポイントそのもの） */}
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <h2 className="font-bold text-left">{reveal ? '4分類（カイヨワ）' : '「楽しい」の成分'}</h2>
              <p className="text-sm text-ink2 text-left">あなたが配分した{TOTAL_POINTS}ポイント</p>
              <Radar values={COMPONENTS.map((c) => ({ label: reveal ? c.theory : c.short, value: answer.points[c.key], color: c.color }))} max={Math.max(5, ...COMPONENTS.map((c) => answer.points[c.key]))} />
            </div>

            {/* ブロック2：遊び度（6つの質問だけから計算） */}
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <h2 className="font-bold text-left">{reveal ? '遊び度（カイヨワの6条件から）' : '遊び度（6つの質問から）'}</h2>
              <div className="text-6xl font-bold tabular-nums my-2">
                {playScore(answer)}
                <span className="text-2xl">%</span>
              </div>
              <ul className="space-y-1.5 text-left">
                {CONDITIONS.map((c) => {
                  const v = answer.conds[c.key]
                  const [label, cls] = v === 1 ? ['はい', 'bg-yes text-white'] : v === 0.5 ? ['どちらとも', 'bg-mid text-ink'] : ['いいえ', 'bg-no text-white']
                  return (
                    <li key={c.key} className="flex items-start gap-2 text-sm">
                      <span className={`shrink-0 w-[5.5em] text-center rounded-md py-0.5 font-bold text-xs ${cls}`}>{label}</span>
                      <span className="leading-snug">{reveal ? c.theory : c.plain}</span>
                    </li>
                  )
                })}
              </ul>
              <p className="text-xs text-ink3 text-left mt-3">はい＝1、どちらとも＝0.5、いいえ＝0 の平均です</p>
            </div>
            <p className="text-sm text-ink2 leading-relaxed text-left">
              隣の人と結果を見せ合って、どこが違うか話してみましょう。
            </p>
            <Secondary
              onClick={() => {
                setSent('no')
                setStep('points')
              }}
            >
              回答を修正する
            </Secondary>
          </section>
        )}
      </main>
    </div>
  )
}

function StatusDot({ status }: { status: Status }) {
  const map = { online: ['bg-green-600', '接続中'], connecting: ['bg-stone-400', '接続しています'], offline: ['bg-red-500', '再接続中'] } as const
  const [cls, label] = map[status]
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink2">
      <span className={`w-2 h-2 rounded-full ${cls}`} />
      {label}
    </span>
  )
}

function Primary(props: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button {...props} className="flex-1 w-full rounded-xl bg-ink text-white font-bold py-3 disabled:opacity-30">
      {props.children}
    </button>
  )
}
function Secondary(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button {...props} className="flex-1 w-full rounded-xl border border-stone-300 bg-white font-bold py-3">
      {props.children}
    </button>
  )
}
function Step(props: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button {...props} className="w-9 h-9 rounded-full border border-stone-300 bg-white text-lg font-bold leading-none disabled:opacity-30">
      {props.children}
    </button>
  )
}
