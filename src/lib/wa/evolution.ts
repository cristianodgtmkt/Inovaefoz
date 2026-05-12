/**
 * Evolution-Go API client (CORRETO — endpoints reais do evolution-go).
 *
 * Auth:
 *   - GLOBAL_KEY: cria instances (POST /instance/create)
 *   - INSTANCE TOKEN: send/connect/status (apikey header)
 *
 * Endpoints (NÃO Evolution Node — Evolution Go é diferente):
 *   POST /instance/create           body: { name, token }                       (global key)
 *   POST /instance/connect          body: { immediate, webhookUrl, subscribe }  (instance key) → retorna QR
 *   GET  /instance/status                                                       (instance key)
 *   POST /send/text                 body: { number, text, delay? }              (instance key)
 *   POST /send/media                body: { number, url, type, caption? }       (instance key)
 *   DELETE /instance                                                            (global key + instance hint)
 */
import { env } from '@/lib/config/env'

const EVO_URL = () => env().EVOLUTION_GO_URL
const GLOBAL_KEY = () => env().EVOLUTION_GO_GLOBAL_KEY

export interface EvolutionInstance {
  instanceName: string
  instanceId?: string
  apikey: string
  qrcode?: { base64?: string; code?: string }
  status?: string
}

async function evoFetch(path: string, opts: RequestInit = {}, apiKey?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: apiKey || GLOBAL_KEY(),
    ...(opts.headers as Record<string, string> || {}),
  }
  const r = await fetch(`${EVO_URL()}${path}`, { ...opts, headers, cache: 'no-store' })
  const text = await r.text()
  let data: any
  try { data = JSON.parse(text) } catch { data = text }
  if (!r.ok) {
    const err = new Error(`evolution ${r.status}: ${typeof data === 'string' ? data : JSON.stringify(data).slice(0, 300)}`)
    ;(err as any).status = r.status
    ;(err as any).data = data
    throw err
  }
  return data
}

/** Cria nova instance — global key */
export async function createInstance(instanceName: string): Promise<EvolutionInstance> {
  const token = (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  const data = await evoFetch('/instance/create', {
    method: 'POST',
    body: JSON.stringify({ name: instanceName, token }),
  })
  return {
    instanceName,
    instanceId: data?.instance?.instanceId || data?.id,
    apikey: token,
    status: data?.status,
  }
}

/** Conecta + retorna QR — POST /instance/connect (instance key) */
export async function connectInstance(instanceName: string, apiKey: string, webhookUrl: string): Promise<{ base64?: string; code?: string }> {
  const data = await evoFetch('/instance/connect', {
    method: 'POST',
    body: JSON.stringify({
      immediate: true,
      webhookUrl,
      subscribe: ['MESSAGE', 'READ_RECEIPT', 'CONNECTION', 'QRCODE'],
    }),
  }, apiKey)
  // Resposta varia: { qrcode: { base64, code } } OU { base64 } OU { qr }
  return {
    base64: data?.qrcode?.base64 || data?.base64 || data?.qr || data?.QRCode,
    code: data?.qrcode?.code || data?.code,
  }
}

/** GET /instance/qr — endpoint dedicado pra QR (evolution-go).
 *  Retorna QR atual (regenerando se preciso). Funciona após /instance/connect.
 */
export async function getQR(instanceName: string, apiKey: string): Promise<{ base64?: string; code?: string }> {
  try {
    const data = await evoFetch('/instance/qr', { method: 'GET' }, apiKey)
    const qr = data?.data?.Qrcode || data?.data?.qrcode || data?.Qrcode || data?.qrcode || data?.data?.base64 || data?.base64
    if (typeof qr === 'string') return { base64: qr }
    if (qr && typeof qr === 'object') return { base64: qr.base64 || qr.image, code: qr.code }
    return {}
  } catch (e: any) {
    // Se /instance/qr 404, fallback pra /instance/connect (que seta webhook + retorna QR em algumas versões)
    const webhookUrl = `https://acai.inovaefoz.com.br/api/webhook/evolution/${encodeURIComponent(instanceName)}`
    try { return await connectInstance(instanceName, apiKey, webhookUrl) } catch { return {} }
  }
}

/** Status conexão.
 *  Evolution-go: Connected = socket TCP, LoggedIn = sessão WhatsApp real.
 *  Pra UI: só considera "conectado de verdade" quando LoggedIn=true.
 */
export async function getStatus(instanceName: string, apiKey: string): Promise<{ connected: boolean; loggedIn: boolean; raw: any }> {
  const data = await evoFetch('/instance/status', {}, apiKey)
  const tcpConnected = !!(data?.data?.Connected || data?.data?.connected || data?.connected)
  const loggedIn = !!(data?.data?.LoggedIn || data?.data?.loggedIn || data?.loggedIn)
  // "connected" verdadeiro só quando logado no WA
  return { connected: loggedIn, loggedIn, raw: data }
}

/** Envia texto. delayMs > 0 → Evolution-go mostra "digitando..." e espera ANTES de enviar.
 *  Built-in do evolution-go, não precisa chamar presence manualmente. */
export async function sendText(instanceName: string, apiKey: string, phone: string, text: string, delayMs?: number): Promise<any> {
  const number = (phone || '').replace(/[^0-9]/g, '')
  const body: any = { number, text }
  if (delayMs && delayMs > 0) body.delay = delayMs
  return evoFetch('/send/text', {
    method: 'POST',
    body: JSON.stringify(body),
  }, apiKey)
}

/** Marca msg como lida */
export async function markRead(apiKey: string, phone: string, messageId: string): Promise<any> {
  const number = (phone || '').replace(/[^0-9]/g, '')
  try {
    return await evoFetch('/message/markread', {
      method: 'POST',
      body: JSON.stringify({ number, id: messageId }),
    }, apiKey)
  } catch (e: any) { return { error: e?.message } }
}

/** Set presence: composing | paused | recording | available */
export async function setPresence(apiKey: string, phone: string, state: 'composing' | 'paused' | 'recording' | 'available'): Promise<any> {
  const number = (phone || '').replace(/[^0-9]/g, '')
  try {
    return await evoFetch('/message/presence', {
      method: 'POST',
      body: JSON.stringify({ number, state }),
    }, apiKey)
  } catch (e: any) { return { error: e?.message } }
}

export interface HumanizeOpts {
  enabled?: boolean
  minDelayMs?: number
  maxDelayMs?: number
  charsPerSecond?: number   // velocidade de "digitação" simulada (~25 = humano lento, ~40 = rápido)
  typingIndicator?: boolean
  readReceipt?: boolean
  splitLongAt?: number       // splitta msg em chunks ≥ N chars (default 220)
  betweenChunksMs?: [number, number] // delay entre chunks [min, max]
}

const DEFAULT_HUMANIZE: Required<HumanizeOpts> = {
  enabled: true,
  minDelayMs: 1500,
  maxDelayMs: 8000,
  charsPerSecond: 28,
  typingIndicator: true,
  readReceipt: true,
  splitLongAt: 220,
  betweenChunksMs: [800, 2200],
}

function jitter(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

/** Splitta msg longa em pedaços ≤ N chars no fim de frase/parágrafo */
function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text.trim()
  while (remaining.length > maxLen) {
    let cut = -1
    // tenta cortar em \n\n primeiro, depois \n, depois ". ", depois "; ", depois " "
    for (const sep of ['\n\n', '\n', '. ', '; ', '? ', '! ', ', ']) {
      const idx = remaining.lastIndexOf(sep, maxLen)
      if (idx > maxLen / 2) { cut = idx + sep.length; break }
    }
    if (cut === -1) cut = maxLen
    chunks.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

/**
 * Envia mensagem humanizada — read + typing + delay + send.
 * Splitta texto longo em vários chunks com pequeno delay entre.
 */
export async function humanizedSend(
  instanceName: string,
  apiKey: string,
  phone: string,
  text: string,
  opts: HumanizeOpts = {},
  incomingMessageId?: string,
): Promise<{ chunks: number; total_delay_ms: number }> {
  const cfg = { ...DEFAULT_HUMANIZE, ...opts }
  console.log('[humanizedSend]', JSON.stringify({ phone, text_len: text.length, enabled: cfg.enabled, msgId: incomingMessageId }))

  if (!cfg.enabled) {
    await sendText(instanceName, apiKey, phone, text)
    return { chunks: 1, total_delay_ms: 0 }
  }

  // 1. Marca como lida
  if (cfg.readReceipt && incomingMessageId) {
    await markRead(apiKey, phone, incomingMessageId)
  }

  // 2. Splitta texto se longo
  const chunks = splitMessage(text, cfg.splitLongAt)

  let totalDelay = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]

    // 3. Calcula delay baseado em chars/velocidade + jitter, dentro de [min, max]
    const baseDelay = (chunk.length / cfg.charsPerSecond) * 1000
    const delay = Math.round(Math.min(cfg.maxDelayMs, Math.max(cfg.minDelayMs, baseDelay + jitter(-300, 600))))

    // 4. Envia COM delay built-in do evolution-go (mostra "digitando" + espera N ms automaticamente)
    if (cfg.typingIndicator) {
      await sendText(instanceName, apiKey, phone, chunk, delay)
    } else {
      await sleep(delay)
      await sendText(instanceName, apiKey, phone, chunk)
    }
    totalDelay += delay

    // 5. Delay entre chunks (se houver mais)
    if (i < chunks.length - 1) {
      const between = jitter(cfg.betweenChunksMs[0], cfg.betweenChunksMs[1])
      await sleep(between)
      totalDelay += between
    }
  }

  return { chunks: chunks.length, total_delay_ms: totalDelay }
}

/** Envia mídia */
export async function sendMedia(
  instanceName: string,
  apiKey: string,
  phone: string,
  mediaType: 'image' | 'video' | 'document' | 'audio',
  url: string,
  caption?: string
): Promise<any> {
  const number = (phone || '').replace(/[^0-9]/g, '')
  const body: any = { number, url, type: mediaType }
  if (caption) body.caption = caption
  return evoFetch('/send/media', { method: 'POST', body: JSON.stringify(body) }, apiKey)
}

/** Set webhook standalone — em evolution-go, webhook é setado no /connect.
 *  Mantemos no-op pra compatibilidade com chamadas existentes. */
export async function setWebhook(_instanceName: string, _apiKey: string, _webhookUrl: string): Promise<void> {
  // No-op: webhook é definido em connectInstance.
  return
}

/** Delete instance — apikey da instance */
export async function deleteInstance(instanceName: string, apiKey?: string): Promise<any> {
  const key = apiKey || GLOBAL_KEY()
  try {
    return await evoFetch('/instance', { method: 'DELETE' }, key)
  } catch (e: any) {
    // tolera 404 (já deletada)
    if (e.status === 404) return { ok: true, ignored: 'not_found' }
    throw e
  }
}

/** Lista instances — alguns evolution-go não têm endpoint, retorna [] silently */
export async function listInstances(): Promise<any[]> {
  try {
    const data = await evoFetch('/instances', {})
    return Array.isArray(data) ? data : data?.instances || []
  } catch { return [] }
}
