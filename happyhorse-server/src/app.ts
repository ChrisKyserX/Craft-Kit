import { Hono } from 'hono'
import { cors } from 'hono/cors'
import auth from './routes/auth'
import configs from './routes/configs'
import projects from './routes/projects'
import sessions from './routes/sessions'
import chat from './routes/chat'

const app = new Hono()

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}))

app.route('/api/auth', auth)
app.route('/api/configs', configs)
app.route('/api/projects', projects)
app.route('/api', sessions)
app.route('/api', chat)

app.onError((err, c) => {
  console.error('[App] Unhandled error:', err.message)
  console.error('[App] Stack:', err.stack)
  return c.json({ error: err.message }, 500)
})

app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default app