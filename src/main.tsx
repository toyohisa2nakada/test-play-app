import { createRoot } from 'react-dom/client'
import './index.css'
import Host from './Host'
import Client from './Client'
import { DEFAULT_ROOM } from './net'

// ?join=<room>          → スマホ（学生）画面
// ?host=<room> / なし   → PC（教員）画面
// ※ StrictMode は使わない（開発時に固定IDのPeerを二重生成してしまうため）
const q = new URLSearchParams(window.location.search)
const join = q.get('join')
const room = join || q.get('host') || DEFAULT_ROOM

createRoot(document.getElementById('root')!).render(
  join ? <Client room={room} fixedCid={q.get('cid')} /> : <Host room={room} />,
)
