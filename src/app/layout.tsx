import type { Metadata } from 'next'
import './styles.css'
import './pages-styles.css'

export const metadata: Metadata = {
  title: 'Açaí da Barra · Painel Administrativo',
  description: 'Painel multi-tenant de delivery + IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body data-density="comfortable" data-sidebar-tone="slate">{children}</body>
    </html>
  )
}
