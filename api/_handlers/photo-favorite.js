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
  const albumFileId = typeof request.body?.albumFileId === 'string' ? request.body.albumFileId : ''
  const isFavorite = request.body?.isFavorite

  if (!familyId) {
    sendJson(response, 400, { error: 'Family ID is required' })
    return
  }
  if (!UUID_PATTERN.test(albumFileId) || typeof isFavorite !== 'boolean') {
    sendJson(response, 400, { error: '写真またはお気に入りの指定が正しくありません。' })
    return
  }

  try {
    const authorization = await authorizeFamilyRequest(request, familyId, 'favorite:use')
    const sql = getDatabase()
    const files = await sql`
      SELECT id, is_published AS "isPublished"
      FROM drive_album_files
      WHERE family_id = ${familyId} AND id = ${albumFileId}
      LIMIT 1
    `
    if (files.length === 0 || (authorization.role === 'member' && !files[0].isPublished)) {
      sendJson(response, 404, { error: '写真が見つからないか、公開されていません。' })
      return
    }

    if (isFavorite) {
      await sql`
        INSERT INTO photo_favorites (family_id, album_file_id, user_id)
        VALUES (${familyId}, ${albumFileId}, ${authorization.userId})
        ON CONFLICT (album_file_id, user_id) DO NOTHING
      `
    } else {
      await sql`
        DELETE FROM photo_favorites
        WHERE family_id = ${familyId}
          AND album_file_id = ${albumFileId}
          AND user_id = ${authorization.userId}
      `
    }

    sendJson(response, 200, { albumFileId, isFavorite })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Photo favorite operation failed', error)
    sendJson(response, 500, { error: '写真のお気に入りを更新できませんでした。' })
  }
}
