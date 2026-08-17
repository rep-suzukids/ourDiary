import { createHash, randomBytes } from 'node:crypto'
import { getDatabase } from './db.js'

const SESSION_COOKIE_NAME = 'ourdiary_session'
const SESSION_IDLE_DAYS = 30
const SESSION_ABSOLUTE_DAYS = 180
const SESSION_COOKIE_MAX_AGE = SESSION_ABSOLUTE_DAYS * 24 * 60 * 60

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function parseCookies(request) {
  const cookies = {}
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (name) cookies[name] = decodeURIComponent(value)
  }
  return cookies
}

function isSecureRequest(request) {
  const forwardedProtocol = request.headers['x-forwarded-proto']
  return forwardedProtocol === 'https' || request.socket?.encrypted === true
}

function sessionCookie(request, token, maxAge) {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (isSecureRequest(request)) attributes.push('Secure')
  return attributes.join('; ')
}

export function clearSessionCookie(request, response) {
  response.setHeader('Set-Cookie', sessionCookie(request, '', 0))
}

export async function createAppSession(request, response, userId) {
  const token = randomBytes(32).toString('base64url')
  const sql = getDatabase()
  await sql`
    INSERT INTO app_sessions (
      user_id, token_hash, expires_at, absolute_expires_at
    ) VALUES (
      ${userId},
      ${hashSessionToken(token)},
      now() + (${SESSION_IDLE_DAYS} * interval '1 day'),
      now() + (${SESSION_ABSOLUTE_DAYS} * interval '1 day')
    )
  `
  response.setHeader('Set-Cookie', sessionCookie(request, token, SESSION_COOKIE_MAX_AGE))
}

export async function getAppSession(request) {
  const token = parseCookies(request)[SESSION_COOKIE_NAME]
  if (!token) return null

  const sql = getDatabase()
  const sessions = await sql`
    SELECT
      s.id AS session_id,
      s.user_id,
      u.email,
      u.display_name,
      u.avatar_url,
      u.google_subject
    FROM app_sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashSessionToken(token)}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND s.absolute_expires_at > now()
      AND u.is_active = true
    LIMIT 1
  `
  if (sessions.length === 0) return null

  const session = sessions[0]
  await sql`
    UPDATE app_sessions
    SET
      last_used_at = now(),
      expires_at = LEAST(absolute_expires_at, now() + (${SESSION_IDLE_DAYS} * interval '1 day'))
    WHERE id = ${session.session_id}
  `
  return session
}

export async function revokeAppSession(request) {
  const token = parseCookies(request)[SESSION_COOKIE_NAME]
  if (!token) return
  const sql = getDatabase()
  await sql`
    UPDATE app_sessions
    SET revoked_at = now()
    WHERE token_hash = ${hashSessionToken(token)}
      AND revoked_at IS NULL
  `
}

export function assertSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return
  const fetchSite = request.headers['sec-fetch-site']
  if (fetchSite === 'cross-site') throw new Error('Cross-site request rejected')

  const origin = request.headers.origin
  if (!origin) return
  const forwardedHost = request.headers['x-forwarded-host'] ?? request.headers.host
  const forwardedProtocol = request.headers['x-forwarded-proto'] ?? 'http'
  const expectedOrigin = `${forwardedProtocol}://${forwardedHost}`
  if (origin !== expectedOrigin) throw new Error('Request origin does not match')
}
