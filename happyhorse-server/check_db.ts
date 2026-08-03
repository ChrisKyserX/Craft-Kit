import 'dotenv/config'
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!)
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  console.log('Tables:', tables.map((t: any) => t.table_name))
  const usersCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'`
  console.log('Users columns:', usersCols)
  await sql.end()
  process.exit(0)
}
main()
