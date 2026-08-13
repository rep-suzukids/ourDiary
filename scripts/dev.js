import { createServer as createHttpServer } from 'node:http'
import { createServer as createViteServer, loadEnv } from 'vite'

const port = Number(process.env.PORT ?? 3000)
const localEnvironment = loadEnv('development', process.cwd(), '')

Object.assign(process.env, localEnvironment, {
  VERCEL_ENV: 'development',
})

const [{ default: authSessionHandler }, { getDatabase }] = await Promise.all([
  import('../api/auth-session.js'),
  import('../api/_lib/db.js'),
])

const sql = getDatabase()
const databaseRows = await sql`
  SELECT current_database() AS database_name
`

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
})

function createApiResponse(response) {
  response.status = (statusCode) => {
    response.statusCode = statusCode
    return response
  }
  response.json = (body) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(body))
  }
  return response
}

async function readJsonBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const server = createHttpServer(async (request, response) => {
  if (request.url === '/api/auth-session') {
    try {
      request.body = await readJsonBody(request)
      await authSessionHandler(request, createApiResponse(response))
    } catch (error) {
      console.error('Local API request failed', error)
      if (!response.headersSent) {
        createApiResponse(response).status(400).json({ error: 'Invalid request' })
      }
    }
    return
  }

  vite.middlewares(request, response, (error) => {
    if (error) {
      vite.ssrFixStacktrace(error)
      console.error(error)
      response.statusCode = 500
      response.end('Internal server error')
    }
  })
})

server.listen(port, () => {
  console.log(`Local database connected: ${databaseRows[0].database_name}`)
  console.log(`Local app: http://localhost:${port}`)
})
