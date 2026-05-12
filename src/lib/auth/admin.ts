/**
 * Admin auth helper.
 * Valida Bearer Supabase JWT + carrega tenant ativo do user.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/config/env'
import { supabaseService } from '@/lib/db/supabase'

export interface AdminContext {
  user: { id: string; email?: string }
  tenant_id: string
  tenant_slug: string
  tenant_name: string
  role: string
  ip: string
  user_agent: string
}

export async function requireAdmin(req: NextRequest): Promise<AdminContext | NextResponse> {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!header) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const e = env()
  // Service token bypass
  if (e.INTERNAL_TEST_TOKEN && header === e.INTERNAL_TEST_TOKEN) {
    const sb = supabaseService()
    const { data } = await sb.from('tenants').select('id, slug, name').eq('slug', 'acai-da-barra').maybeSingle()
    if (!data) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 })
    return {
      user: { id: '00000000-0000-0000-0000-000000000000', email: 'service@internal' },
      tenant_id: data.id,
      tenant_slug: data.slug,
      tenant_name: data.name,
      role: 'service',
      ip: req.headers.get('x-forwarded-for') || '0.0.0.0',
      user_agent: req.headers.get('user-agent') || '',
    }
  }

  // Validar JWT Supabase
  try {
    const sb = createClient(e.SUPABASE_URL, e.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { data: { user }, error } = await sb.auth.getUser(header)
    if (error || !user) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })

    // Resolve tenant ativo via service role (bypassa RLS)
    const svc = supabaseService()
    const { data: tu } = await svc
      .from('tenant_users')
      .select('tenant_id, role, tenants(id, slug, name)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (!tu) return NextResponse.json({ error: 'no_tenant', message: 'Usuário sem tenant associado' }, { status: 403 })

    const tenant = (tu as any).tenants
    return {
      user: { id: user.id, email: user.email },
      tenant_id: tu.tenant_id as string,
      tenant_slug: tenant.slug,
      tenant_name: tenant.name,
      role: tu.role as string,
      ip: req.headers.get('x-forwarded-for') || '0.0.0.0',
      user_agent: req.headers.get('user-agent') || '',
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'auth_error' }, { status: 401 })
  }
}

export function isAdminCtx(x: AdminContext | NextResponse): x is AdminContext {
  return !(x instanceof NextResponse)
}
