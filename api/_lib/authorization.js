import { verifyGoogleCredential } from './auth.js'
import { getDatabase } from './db.js'
import { permissionsFor } from './permissions.js'

export class AuthorizationError extends Error {
  constructor(message, status = 403) {
    super(message)
    this.name = 'AuthorizationError'
    this.status = status
  }
}

export async function authorizeFamilyRequest(request, familyId, requiredPermission) {
  const authorization = request.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    throw new AuthorizationError('ログインが必要です。', 401)
  }

  const credential = authorization.slice('Bearer '.length)
  const googleUser = await verifyGoogleCredential(credential)
  const sql = getDatabase()
  const memberships = await sql`
    SELECT u.id AS user_id, fm.role
    FROM users u
    INNER JOIN family_memberships fm ON fm.user_id = u.id
    WHERE u.google_subject = ${googleUser.subject}
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
    userId: membership.user_id,
    role: membership.role,
    permissions,
    googleUser,
  }
}
