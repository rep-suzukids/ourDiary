import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sendJson(response, status, body) {
  response.status(status).json(body)
}

export default async function handler(request, response) {
  if (request.method !== 'PATCH') {
    response.setHeader('Allow', 'PATCH')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const familyId = request.headers['x-family-id']
  const albumFileId = request.body?.albumFileId
  const isPublished = request.body?.isPublished
  if (!UUID_PATTERN.test(familyId ?? '') || !UUID_PATTERN.test(albumFileId ?? '') || typeof isPublished !== 'boolean') {
    sendJson(response, 400, { error: '写真または公開設定の指定が正しくありません。' })
    return
  }

  try {
    await authorizeFamilyRequest(request, familyId, 'photo:publish')
    const sql = getDatabase()
    const rows = await sql`
      UPDATE drive_album_files
      SET is_published = ${isPublished}, updated_at = now()
      WHERE family_id = ${familyId} AND id = ${albumFileId}
      RETURNING id AS "albumFileId", is_published AS "isPublished"
    `
    if (rows.length === 0) {
      sendJson(response, 404, { error: '写真が見つかりません。' })
      return
    }
    sendJson(response, 200, rows[0])
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Photo visibility operation failed', error)
    sendJson(response, 500, { error: '写真の公開設定を更新できませんでした。' })
  }
}
