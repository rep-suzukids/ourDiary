import { verifyGoogleCredential } from './_lib/auth.js'
import { getDatabase } from './_lib/db.js'
import { permissionsFor } from './_lib/permissions.js'
import {
  assertSameOrigin,
  clearSessionCookie,
  createAppSession,
  getAppSession,
  revokeAppSession,
} from './_lib/session.js'

function sendJson(response, status, body) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.status(status).json(body)
}

async function loadSessionResponse(userId) {
  const sql = getDatabase()
  const memberships = await sql`
    SELECT
      u.id AS user_id,
      u.email,
      u.display_name,
      u.avatar_url,
      f.id AS family_id,
      f.name AS family_name,
      fm.role
    FROM users u
    INNER JOIN family_memberships fm ON fm.user_id = u.id
    INNER JOIN families f ON f.id = fm.family_id
    WHERE u.id = ${userId}
      AND u.is_active = true
      AND fm.status = 'active'
    ORDER BY fm.created_at ASC
  `
  if (memberships.length === 0) return null

  const user = memberships[0]
  return {
    user: {
      id: user.user_id,
      email: user.email,
      name: user.display_name ?? user.email,
      picture: user.avatar_url,
    },
    families: memberships.map((membership) => ({
      id: membership.family_id,
      name: membership.family_name,
      role: membership.role,
      permissions: permissionsFor(membership.role),
    })),
  }
}

async function restoreSession(request, response) {
  const session = await getAppSession(request)
  if (!session) {
    clearSessionCookie(request, response)
    sendJson(response, 401, { error: 'ログインが必要です。' })
    return
  }
  const body = await loadSessionResponse(session.user_id)
  if (!body) {
    clearSessionCookie(request, response)
    sendJson(response, 403, { error: 'このアカウントは利用できません。' })
    return
  }
  sendJson(response, 200, body)
}

async function login(request, response) {
  assertSameOrigin(request)
  const credential = request.body?.credential
  if (typeof credential !== 'string' || credential.length === 0) {
    sendJson(response, 400, { error: 'Google credential is required' })
    return
  }

  let googleUser
  try {
    googleUser = await verifyGoogleCredential(credential)
  } catch (error) {
    console.error('Google authentication failed', error)
    sendJson(response, 401, { error: 'Google認証に失敗しました。再度ログインしてください。' })
    return
  }

  const sql = getDatabase()
  const memberships = await sql`
    SELECT u.id AS user_id
    FROM users u
    INNER JOIN family_memberships fm ON fm.user_id = u.id
    WHERE u.is_active = true
      AND fm.status = 'active'
      AND (
        u.google_subject = ${googleUser.subject}
        OR (u.google_subject IS NULL AND u.email = ${googleUser.email})
      )
    ORDER BY fm.created_at ASC
    LIMIT 1
  `
  if (memberships.length === 0) {
    sendJson(response, 403, {
      error: 'このアカウントは招待されていません。管理者に確認してください。',
    })
    return
  }

  const userId = memberships[0].user_id
  const updatedUsers = await sql`
    UPDATE users
    SET
      google_subject = COALESCE(google_subject, ${googleUser.subject}),
      display_name = ${googleUser.name},
      avatar_url = ${googleUser.picture},
      last_login_at = now(),
      updated_at = now()
    WHERE id = ${userId}
      AND (google_subject IS NULL OR google_subject = ${googleUser.subject})
    RETURNING id
  `
  if (updatedUsers.length === 0) {
    sendJson(response, 403, { error: 'Googleアカウントを確認できませんでした。' })
    return
  }

  const body = await loadSessionResponse(userId)
  if (!body) {
    sendJson(response, 403, { error: 'このアカウントは利用できません。' })
    return
  }
  await createAppSession(request, response, userId)
  sendJson(response, 200, body)
}

async function logout(request, response) {
  assertSameOrigin(request)
  await revokeAppSession(request)
  clearSessionCookie(request, response)
  response.status(204).end()
}

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      await restoreSession(request, response)
      return
    }
    if (request.method === 'POST') {
      await login(request, response)
      return
    }
    if (request.method === 'DELETE') {
      await logout(request, response)
      return
    }
    response.setHeader('Allow', 'GET, POST, DELETE')
    sendJson(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    console.error('Session operation failed', error)
    sendJson(response, 503, {
      error: 'ログイン情報を確認できませんでした。しばらくしてから再試行してください。',
    })
  }
}
