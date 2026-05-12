// Structured logger (JSON) — sem dependência. Sentry pode plugar em prod.
type Level = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

function emit(level: Level, msg: string, meta?: Record<string, any>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta || {}),
  })
  if (level === 'error' || level === 'fatal') {
    console.error(line)
    // Sentry capture future
    try {
      const dsn = process.env.SENTRY_DSN
      if (dsn) {
        fetch(dsn.replace('/api', '/api/store/'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': `Sentry sentry_version=7,sentry_key=${dsn.split('@')[0].split('//')[1]}` },
          body: JSON.stringify({ message: msg, level, extra: meta }),
        }).catch(() => {})
      }
    } catch {}
  } else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  debug: (m: string, meta?: any) => emit('debug', m, meta),
  info: (m: string, meta?: any) => emit('info', m, meta),
  warn: (m: string, meta?: any) => emit('warn', m, meta),
  error: (m: string, meta?: any) => emit('error', m, meta),
  fatal: (m: string, meta?: any) => emit('fatal', m, meta),
}
