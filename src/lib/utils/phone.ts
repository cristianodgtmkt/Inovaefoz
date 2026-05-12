/**
 * Phone helpers (Brasil) — usados em login + admin invite.
 * UI: input mostra "(45) 99999-9999". Backend recebe "5545999999999".
 */

export const DDDS_BR = new Set([
  '11','12','13','14','15','16','17','18','19',
  '21','22','24','27','28',
  '31','32','33','34','35','37','38',
  '41','42','43','44','45','46','47','48','49',
  '51','53','54','55',
  '61','62','63','64','65','66','67','68','69',
  '71','73','74','75','77','79',
  '81','82','83','84','85','86','87','88','89',
  '91','92','93','94','95','96','97','98','99',
])

/** Mascara DDD + número (sem 55 visível). Aceita até 11 dígitos. */
export function maskPhone(raw: string): string {
  let d = raw.replace(/\D/g, '')
  // Se user colou com 55, remove
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  d = d.slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** Retorna só dígitos DDD+número (10 ou 11). */
export function digitsOnly(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  return d.slice(0, 11)
}

/** Retorna número completo com 55 pra enviar ao backend. */
export function fullNumber(raw: string): string {
  return '55' + digitsOnly(raw)
}

/** Valida formato BR. */
export function validatePhone(raw: string): { valid: boolean; warning?: string } {
  const d = digitsOnly(raw)
  if (d.length < 10) return { valid: false, warning: `Faltam ${10 - d.length} dígitos (DDD + número)` }
  if (d.length > 11) return { valid: false, warning: 'Número longo demais' }
  const ddd = d.slice(0, 2)
  if (!DDDS_BR.has(ddd)) return { valid: false, warning: `DDD ${ddd} inválido` }
  if (d.length === 11 && d[2] !== '9') return { valid: false, warning: 'Celular começa com 9 depois do DDD' }
  return { valid: true }
}
