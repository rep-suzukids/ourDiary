import { neon } from '@neondatabase/serverless'
import pg from 'pg'

const VERCEL_DATABASE_ENVIRONMENTS = new Set(['preview', 'production'])

let databaseClient

export class DatabaseConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DatabaseConfigurationError'
  }
}

function assertPostgresUrl(value) {
  if (!value || !/^postgres(ql)?:\/\//.test(value)) {
    throw new DatabaseConfigurationError(
      'DATABASE_URL must be a PostgreSQL URL in Vercel Preview and Production',
    )
  }
}

function createLocalSqlClient() {
  const requiredVariables = [
    'POSTGRES_HOST',
    'POSTGRES_DATABASE',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
  ]
  const missingVariables = requiredVariables.filter((name) => !process.env[name])

  if (missingVariables.length > 0) {
    throw new DatabaseConfigurationError(
      `Local PostgreSQL configuration is incomplete: ${missingVariables.join(', ')}`,
    )
  }

  if (/\.neon\.tech$/i.test(process.env.POSTGRES_HOST)) {
    throw new DatabaseConfigurationError(
      'Local development must not connect to a Neon database',
    )
  }

  const pool = new pg.Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  })

  return async function sql(strings, ...values) {
    const statement = strings.reduce(
      (text, part, index) => text + (index === 0 ? '' : `$${index}`) + part,
      '',
    )
    const result = await pool.query(statement, values)
    return result.rows
  }
}

export function getDatabase() {
  if (databaseClient) {
    return databaseClient
  }

  if (VERCEL_DATABASE_ENVIRONMENTS.has(process.env.VERCEL_ENV)) {
    assertPostgresUrl(process.env.DATABASE_URL)
    databaseClient = neon(process.env.DATABASE_URL)
    return databaseClient
  }

  databaseClient = createLocalSqlClient()
  return databaseClient
}
