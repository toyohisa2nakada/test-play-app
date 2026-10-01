import Peer, { type PeerOptions } from 'peerjs'

export const DEFAULT_ROOM = (import.meta.env.VITE_ROOM_ID as string | undefined) || 'sagami-asobi-nakada-2026'

export function peerOptions(): PeerOptions {
  const env = import.meta.env
  const opts: PeerOptions = { debug: 1 }
  if (env.VITE_PEER_HOST) {
    opts.host = env.VITE_PEER_HOST
    opts.port = Number(env.VITE_PEER_PORT || 443)
    opts.path = env.VITE_PEER_PATH || '/'
    opts.secure = env.VITE_PEER_SECURE !== 'false'
  }
  return opts
}

export function newPeer(id?: string): Peer {
  return id ? new Peer(id, peerOptions()) : new Peer(peerOptions())
}

/** スマホ用URL（配布資料のQRコードに使う） */
export function joinUrl(room: string): string {
  const u = new URL(window.location.href)
  u.search = ''
  u.hash = ''
  u.searchParams.set('join', room)
  return u.toString()
}
