import { getDatabase } from './db.js'
import { permissionsFor } from './permissions.js'
import { assertSameOrigin, getAppSession } from './session.js'

export class AuthorizationError extends Error {
  constructor(message, status = 403) {
    super(message)
    this.name = 'AuthorizationError'
    this.status = status
  }
}

async function authenticateRequest(request) {
  const appSession = await getAppSession(request)
  if (!appSession) throw new AuthorizationError('ログインが必要です。', 401)
  return {
    userId: appSession.user_id,
    googleUser: {
      subject: appSession.google_subject,
      email: appSession.email,
      name: appSession.display_name ?? appSession.email,
      picture: appSession.avatar_url,
    },
  }
}

export async function authorizeFamilyRequest(request, familyId, requiredPermission) {
  try {
    assertSameOrigin(request)
  } catch {
    throw new AuthorizationError('安全でないリクエストを拒否しました。', 403)
  }

  const identity = await authenticateRequest(request)
  const sql = getDatabase()
  const memberships = await sql`
    SELECT fm.role
    FROM family_memberships fm
    INNER JOIN users u ON u.id = fm.user_id
    WHERE fm.user_id = ${identity.userId}
      AND u.is_active = true
      AND fm.family_id = ${familyId}
      AND fm.status = 'active'
    LIMIT 1
  `

  if (memberships.length === 0) {
    throw new AuthorizationError('この家族へのアクセス権限がありません。')
  }

  const membership = memberships[0]
  const permissions = permissionsFor(membership.role)
  if (requiredPermission && !permissions.includes(requiredPermission)) {
    throw new AuthorizationError('この操作を行う権限がありません。')
  }

  return {
    userId: identity.userId,
    role: membership.role,
    permissions,
    googleUser: identity.googleUser,
  }
}
