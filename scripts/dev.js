import { createServer as createHttpServer } from 'node:http'
import { createServer as createViteServer, loadEnv } from 'vite'

const port = Number(process.env.PORT ?? 3000)
const localEnvironment = loadEnv('development', process.cwd(), '')

Object.assign(process.env, localEnvironment, {
  VERCEL_ENV: 'development',
})

const [
  { default: authSessionHandler },
  { default: albumFilesHandler },
  { default: driveOwnerInvitationsHandler },
  { default: driveOwnerInvitationHandler },
  { default: driveOwnerOauthStartHandler },
  { default: googleDriveCallbackHandler },
  { getDatabase },
] = await Promise.all([
  import('../api/auth-session.js'),
  import('../api/album-files.js'),
  import('../api/drive-owner-invitations.js'),
  import('../api/drive-owner-invitation.js'),
  import('../api/drive-owner-oauth-start.js'),
  import('../api/google-drive-callback.js'),
  import('../api/_lib/db.js'),
])

const apiRoutes = new Map([
  ['/api/auth-session', authSessionHandler],
  ['/api/album-files', albumFilesHandler],
  ['/api/drive-owner-invitations', driveOwnerInvitationsHandler],
  ['/api/drive-owner-invitation', driveOwnerInvitationHandler],
  ['/api/drive-owner-oauth-start', driveOwnerOauthStartHandler],
  ['/api/google-drive-callback', googleDriveCallbackHandler],
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
  const pathname = new URL(request.url, 'http://localhost').pathname
  const apiHandler = apiRoutes.get(pathname)

  if (apiHandler) {
    try {
      if (request.method === 'POST') request.body = await readJsonBody(request)
      await apiHandler(request, createApiResponse(response))
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
