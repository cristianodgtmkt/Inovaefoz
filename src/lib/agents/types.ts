// Tipos compartilhados pelo pipeline
export type Intent =
  | 'saudacao'
  | 'pedido_inicio'
  | 'pedido_continua'
  | 'cardapio_query'
  | 'status_pedido'
  | 'objection'
  | 'escalation'
  | 'smalltalk'
  | 'media_only'

export type Channel = 'whatsapp' | 'instagram' | 'facebook'

export interface AgentContext {
  telefone: string
  message: string
  channel: Channel
  nome_cliente?: string | null
  provider_message_id?: string | null
  history: HistoryMsg[]
  state: ConversaState
  cardapioSnapshot: CardapioSnapshot
  configs: Record<string, any>
  tenant_id?: string
}

export interface HistoryMsg {
  role: 'user' | 'assistant' | 'admin'
  message: string
  created_at: string
}

export interface ConversaState {
  pedido: PedidoState
  etapa: 'descoberta' | 'encantamento' | 'fechamento'
}

export interface PedidoState {
  items: any[]
  endereco?: string | null
  bairro?: string | null
  complemento?: string | null
  forma_pagamento?: string | null
  troco_para?: number | null
  total?: number
  taxa?: number
  fase?: string
  pedido_id?: string | null
}

export interface CardapioSnapshot {
  produtos: any[]
  tamanhos: any[]
  sabores: any[]
  complementos: any[]
  taxas: any[]
  precos: number[]   // whitelist em centavos
  itensNomes: Set<string>
  bairrosAtivos: Set<string>
}

export interface RouterOutput {
  intent: Intent
  confidence: number
  needs_rag: boolean
  reasoning?: string
}

export interface SpecialistReply {
  text: string
  specialistName: string
  toolCalls?: ToolCall[]
  needsHandoff?: boolean
  handoffReason?: string
  newState?: Partial<PedidoState>
  tokens_in: number
  tokens_out: number
  cost_cents: number
  duration_ms: number
}

export interface ToolCall {
  name: string
  args: Record<string, any>
  result?: any
  duration_ms?: number
  cached?: boolean
}

export interface PipelineResult {
  reply: string
  intent: Intent
  specialist: string
  shouldEscalate: boolean
  audit_verdict: 'pass' | 'fail' | 'warn'
  guardrail_failures: string[]
  tokens_in: number
  tokens_out: number
  cost_cents: number
  duration_ms: number
  retrieved_chunk_ids: string[]
  tools_called: string[]
}
