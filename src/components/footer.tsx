import type { Tenant } from '@/lib/tenants'

export function Footer({ tenant }: { tenant: Tenant }) {
  return (
    <footer className="ftr">
      <span>{tenant.name} · Painel Administrativo · v1.0</span>
      <div className="ftr-right">
        <a href="#">Status</a>
        <a href="#">Suporte</a>
        <a href="#">Política de privacidade</a>
      </div>
    </footer>
  )
}
