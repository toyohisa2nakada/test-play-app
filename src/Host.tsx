import { useEffect, useMemo, useRef, useState } from 'react'
import type { DataConnection } from 'peerjs'
import { QRCodeSVG } from 'qrcode.react'
import { QUESTION, TITLE } from './content'
import { binOf, playScore, summarize, type Answer, type Entry, type ToClient, type ToHost } from './model'
import { makeDummies } from './dummy'
import { joinUrl, newPeer } from './net'
import { AVG_MAX, CompBars, CondStack, Histogram } from './components/Charts'

type HostStatus = 'starting' | 'ready' | 'id-taken' | 'error'
const STORE = 'asobi-host-answers'

function load(): Record<string, Answer> {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}')
  } catch {
    return {}
  }
}

export default function Host({ room }: { room: string }) {
  const [status, setStatus] = useState<HostStatus>('starting')
  const [real, setReal] = useState<Record<string, Answer>>(load)
  const [lastCid, setLastCid] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)
  const [useDummy, setUseDummy] = useState(true)
  const [showPhone, setShowPhone] = useState(true)
  const [phoneKey, setPhoneKey] = useState(0)
  const [peers, setPeers] = useState(0)
  const [seed, setSeed] = useState(0)
  const connsRef = useRef(new Set<DataConnection>())
  const revealRef = useRef(reveal)
  revealRef.current = reveal

  const dummies = useMemo(() => makeDummies(), [])
  const url = joinUrl(room)

  // ---- ホストPeer（固定ID = ルームID） ----
  useEffect(() => {
    let peer = newPeer(room)
    let timer: number | undefined
    let alive = true
    const setup = () => {
      peer.on('open', () => setStatus('ready'))
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          connsRef.current.add(conn)
          setPeers(connsRef.current.size)
          conn.send({ t: 'state', reveal: revealRef.current } satisfies ToClient)
        })
        conn.on('data', (raw) => {
          const msg = raw as ToHost
          if (msg.t !== 'submit') return
          setReal((r) => ({ ...r, [msg.cid]: msg.answer }))
          setLastCid(msg.cid)
          conn.send({ t: 'ack', cid: msg.cid } satisfies ToClient)
        })
        const drop = () => {
          connsRef.current.delete(conn)
          setPeers(connsRef.current.size)
        }
        conn.on('close', drop)
        conn.on('error', drop)
      })
      peer.on('disconnected', () => {
        if (alive && !peer.destroyed) peer.reconnect()
      })
      peer.on('error', (e) => {
        const type = (e as { type?: string }).type
        if (type === 'unavailable-id') {
          // 前回のタブがまだIDを保持している：少し待って取り直す
          setStatus('id-taken')
          peer.destroy()
          timer = window.setTimeout(() => {
            if (!alive) return
            peer = newPeer(room)
            setup()
          }, 4000)
        } else if (type !== 'peer-unavailable') {
          setStatus('error')
        }
      })
    }
    setup()
    return () => {
      alive = false
      window.clearTimeout(timer)
      peer.destroy()
    }
  }, [room])

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(real))
    } catch {
      /* 保存できなくても表示は続ける */
    }
  }, [real])

  useEffect(() => {
    for (const c of connsRef.current) c.send({ t: 'state', reveal } satisfies ToClient)
  }, [reveal])

  const entries: Entry[] = useMemo(() => {
    const r = Object.entries(real).map(([cid, answer]) => ({ cid, answer, dummy: false }))
    return useDummy ? [...dummies, ...r] : r
  }, [real, useDummy, dummies])

  const s = useMemo(() => summarize(entries), [entries])
  const highlightBin = lastCid && real[lastCid] ? binOf(playScore(real[lastCid])) : null

  const comments = useMemo(() => {
    const withText = entries.filter((e) => e.answer.comment)
    const realOnes = withText.filter((e) => !e.dummy).sort((a, b) => b.answer.at - a.answer.at)
    const rest = withText.filter((e) => e.dummy)
    // 実回答を優先し、残りは架空データからシャッフルで補う
    const shuffled = [...rest].sort((a, b) => hash(a.cid + seed) - hash(b.cid + seed))
    const seen = new Set<string>()
    return [...realOnes, ...shuffled].filter((e) => !seen.has(e.answer.comment) && seen.add(e.answer.comment)).slice(0, 3)
  }, [entries, seed])

  const reset = () => {
    if (!window.confirm('実際の回答をすべて消去します。よろしいですか？')) return
    setReal({})
    setLastCid(null)
  }

  return (
    <div className="h-dvh flex bg-surface overflow-hidden">
      {/* ---- 左：スクリーン用の集計 ---- */}
      <div className="flex-1 min-w-0 flex flex-col p-5 gap-4 overflow-auto">
        <header className="flex items-start gap-5">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-ink2">
              {TITLE}
              <span className="mx-2">|</span>ゲームメディア論 第2回
            </div>
            <h1 className="text-3xl font-bold mt-1">{QUESTION}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink2">
              <span>
                回答 <b className="text-ink text-lg tabular-nums">{s.n}</b> 人
                {useDummy && <span className="ml-1">（うち実回答 {s.nReal}）</span>}
              </span>
              <span>接続中の端末 {peers}</span>
              <HostBadge status={status} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex gap-2">
              <Toggle on={reveal} onClick={() => setReveal((v) => !v)} label="種明かし" strong />
              <Toggle on={useDummy} onClick={() => setUseDummy((v) => !v)} label="架空の44人" />
              <Toggle on={showPhone} onClick={() => setShowPhone((v) => !v)} label="スマホ画面" />
              <button onClick={reset} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm">
                リセット
              </button>
            </div>
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="shrink-0 bg-white p-2 rounded-lg border border-stone-200" title={url}>
            <QRCodeSVG value={url} size={96} />
          </a>
        </header>

        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          <Panel no="①" title="「遊び度」の分布" note={`平均 ${s.mean}%　最小 ${s.min}%〜最大 ${s.max}%`}>
            <Histogram s={s} highlightBin={highlightBin} />
            <p className="text-sm text-ink2 mt-1">同じ活動でも、人によって「遊び」の度合いは違う？</p>
          </Panel>
          <Panel no="②" title={reveal ? '4分類：成分の平均ポイント' : '「楽しい」の成分（平均ポイント）'} note="10ポイント中">
            <CompBars values={s.avgPoints} max={AVG_MAX} unit="" digits={1} reveal={reveal} />
          </Panel>
          <Panel no="③" title={reveal ? 'カイヨワの6条件' : '6つの質問への回答'}>
            <CondStack s={s} reveal={reveal} />
          </Panel>
          <Panel
            no="④"
            title="いちばん楽しい瞬間"
            action={
              <button onClick={() => setSeed((v) => v + 1)} className="text-sm rounded-md border border-stone-300 bg-white px-2 py-0.5">
                入れ替え
              </button>
            }
          >
            <ul className="space-y-2.5">
              {comments.map((e) => (
                <li key={e.cid} className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-[15px]">
                  「{e.answer.comment}」
                  <span className="block text-xs text-ink3 mt-0.5">
                    遊び度 {playScore(e.answer)}%{!e.dummy && '・実回答'}
                  </span>
                </li>
              ))}
              {comments.length === 0 && <li className="text-ink3 text-sm">まだありません</li>}
            </ul>
          </Panel>
        </div>
      </div>

      {/* ---- 右：スマホ画面（実際にPeerで接続するクライアント） ---- */}
      {showPhone && (
        <aside className="w-[380px] shrink-0 border-l border-stone-200 bg-stone-100 flex flex-col items-center justify-center p-4 gap-2">
          <div className="text-sm text-ink2 flex items-center gap-2">
            学生のスマホ画面
            <button onClick={() => setPhoneKey((k) => k + 1)} className="rounded border border-stone-300 bg-white px-2 text-xs">
              最初から
            </button>
          </div>
          <div className="rounded-[36px] bg-ink p-3 shadow-xl">
            <iframe
              key={phoneKey}
              title="スマホ画面"
              src={`${url}&cid=demo-phone`}
              className="block w-[330px] h-[680px] max-h-[calc(100dvh-110px)] rounded-[26px] bg-surface"
            />
          </div>
        </aside>
      )}
    </div>
  )
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function Panel({ no, title, note, action, children }: { no: string; title: string; note?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-stone-200 p-4 flex flex-col min-h-0">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-ink3 font-bold">{no}</span>
        <h2 className="font-bold text-lg">{title}</h2>
        {note && <span className="text-sm text-ink2 ml-auto">{note}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  )
}

function Toggle({ on, onClick, label, strong }: { on: boolean; onClick: () => void; label: string; strong?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${on ? (strong ? 'bg-alea border-alea text-white' : 'bg-ink border-ink text-white') : 'bg-white border-stone-300'}`}
    >
      {label}
    </button>
  )
}

function HostBadge({ status }: { status: HostStatus }) {
  const map: Record<HostStatus, [string, string]> = {
    starting: ['bg-stone-400', '起動中'],
    ready: ['bg-green-600', '受付中'],
    'id-taken': ['bg-amber-500', 'ルームIDの解放待ち…（別タブで開いていませんか）'],
    error: ['bg-red-500', '通信エラー（ネットワークを確認）'],
  }
  const [cls, label] = map[status]
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${cls}`} />
      {label}
    </span>
  )
}
