// Tenants helper — agora DB-backed via /api/admin/tenant/me.
// Mantém shape `Tenant` legado pra compatibilidade com Sidebar/Header.
export interface Tenant {
  slug: string
  name: string
  tagline: string
  icon: string                  // lucide icon name
  brandPrimary: string
  brandPrimaryHover: string
  brandSoft: string
  brandBorder: string
  brandText: string
  location: string
  logo_url?: string | null
  ai_paused_global?: boolean
  id?: string
}

export const FALLBACK_TENANT: Tenant = {
  slug: 'acai-da-barra',
  name: 'Açaí da Barra',
  tagline: 'Painel Administrativo',
  icon: 'Grape',
  brandPrimary: '#7e22ce',
  brandPrimaryHover: '#6b21a8',
  brandSoft: '#f3e8ff',
  brandBorder: '#e9d5ff',
  brandText: '#581c87',
  location: 'Foz do Iguaçu',
}

// Legacy dict — mantém só pra evitar quebrar imports antigos.
// Páginas devem usar useTenant() ao invés disso.
export const TENANTS: Record<string, Tenant> = {
  'acai-da-barra': FALLBACK_TENANT,
}

export function getTenant(slug?: string): Tenant {
  return TENANTS[slug || ''] || FALLBACK_TENANT
}

// Mapeia row do DB (`tenants`) pra shape `Tenant` legado.
export function tenantFromDb(row: any): Tenant {
  if (!row) return FALLBACK_TENANT
  const b = row.brand || {}
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || 'Painel Administrativo',
    icon: b.icon || 'Grape',
    brandPrimary: b.primary || FALLBACK_TENANT.brandPrimary,
    brandPrimaryHover: b.primaryHover || FALLBACK_TENANT.brandPrimaryHover,
    brandSoft: b.soft || FALLBACK_TENANT.brandSoft,
    brandBorder: b.border || FALLBACK_TENANT.brandBorder,
    brandText: b.text || FALLBACK_TENANT.brandText,
    location: row.endereco_cidade || FALLBACK_TENANT.location,
    logo_url: b.logo_url || null,
    ai_paused_global: !!row.ai_paused_global,
  }
}
