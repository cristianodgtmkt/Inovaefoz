// Meta Graph API helpers (Instagram + Facebook Messenger)
import { env } from '@/lib/config/env'

const GRAPH = 'https://graph.facebook.com/v21.0'

export async function sendInstagram(igUserId: string, recipientId: string, text: string): Promise<any> {
  const token = env().META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN missing')
  const r = await fetch(`${GRAPH}/${igUserId}/messages?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  })
  return r.json()
}

export async function sendFacebook(pageId: string, recipientId: string, text: string): Promise<any> {
  const token = env().META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN missing')
  const r = await fetch(`${GRAPH}/${pageId}/messages?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: 'RESPONSE', message: { text } }),
  })
  return r.json()
}

export function verifyMetaWebhook(req: { searchParams: URLSearchParams }): { verified: boolean; challenge: string } {
  const mode = req.searchParams.get('hub.mode')
  const token = req.searchParams.get('hub.verify_token')
  const challenge = req.searchParams.get('hub.challenge') || ''
  const expected = env().META_VERIFY_TOKEN
  return { verified: mode === 'subscribe' && token === expected, challenge }
}
