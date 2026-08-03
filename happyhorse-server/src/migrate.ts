import 'dotenv/config'
import { db } from './db'
import { sql } from 'drizzle-orm'

async function main() {
  console.log('Creating tables...')
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hh_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100),
      created_at TIMESTAMP DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hh_llm_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES hh_users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      provider VARCHAR(50) NOT NULL,
      api_key TEXT NOT NULL,
      base_url VARCHAR(255),
      default_model VARCHAR(100) NOT NULL,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hh_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES hh_users(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hh_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES hh_projects(id) ON DELETE CASCADE,
      title VARCHAR(300),
      agent_type VARCHAR(50) NOT NULL DEFAULT 'general',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hh_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES hh_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT,
      tool_calls JSONB,
      created_at TIMESTAMP DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hh_agent_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES hh_users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      agent_type VARCHAR(50) NOT NULL,
      system_prompt TEXT NOT NULL,
      model VARCHAR(100) NOT NULL,
      llm_config_id UUID REFERENCES hh_llm_configs(id),
      tools JSONB DEFAULT '[]',
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT now()
    )
  `)
  console.log('Tables created successfully')
  process.exit(0)
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})