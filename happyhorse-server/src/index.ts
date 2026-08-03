import 'dotenv/config'
import { serve } from '@hono/node-server'
import app from './app'

const port = parseInt(process.env.PORT || '3000', 10)

console.log(`HappyHorse Server starting on http://localhost:${port}`)
serve({ fetch: app.fetch, port })