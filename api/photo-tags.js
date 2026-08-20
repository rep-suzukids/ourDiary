import { AuthorizationError, authorizeFamilyRequest } from './_lib/authorization.js'
import { getDatabase } from './_lib/db.js'

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
  const submittedTagIds = Array.isArray(request.body?.tagIds) ? request.body.tagIds : null
  const tagIds = submittedTagIds ? [...new Set(submittedTagIds)] : []

  if (!familyId) {
    sendJson(response, 400, { error: 'Family ID is required' })
    return
  }
  if (!UUID_PATTERN.test(albumFileId) || submittedTagIds === null || tagIds.some((id) => !UUID_PATTERN.test(id))) {
    sendJson(response, 400, { error: '写真またはタグの指定が正しくありません。' })
    return
  }

  try {
    const authorization = await authorizeFamilyRequest(request, familyId, 'tag:assign')
    const sql = getDatabase()
    const tagIdsJson = JSON.stringify(tagIds)
    const files = await sql`
      SELECT id
      FROM drive_album_files
      WHERE family_id = ${familyId} AND id = ${albumFileId}
      LIMIT 1
    `
    if (files.length === 0) {
      sendJson(response, 404, { error: '写真が見つかりません。' })
      return
    }

    const validTags = tagIds.length === 0 ? [] : await sql`
      SELECT id
      FROM tags
      WHERE family_id = ${familyId}
        AND id IN (
          SELECT value::uuid
          FROM jsonb_array_elements_text(${tagIdsJson}::jsonb)
        )
    `
    if (validTags.length !== tagIds.length) {
      sendJson(response, 400, { error: '使用できないタグが含まれています。' })
      return
    }

    const updated = await sql`
      WITH selected AS MATERIALIZED (
        SELECT value::uuid AS tag_id
        FROM jsonb_array_elements_text(${tagIdsJson}::jsonb)
      ), removed AS (
        DELETE FROM drive_album_file_tags
        WHERE family_id = ${familyId}
          AND album_file_id = ${albumFileId}
          AND NOT EXISTS (
            SELECT 1 FROM selected WHERE selected.tag_id = drive_album_file_tags.tag_id
          )
      ), inserted AS (
        INSERT INTO drive_album_file_tags (family_id, album_file_id, tag_id, assigned_by)
        SELECT ${familyId}, ${albumFileId}, selected.tag_id, ${authorization.userId}
        FROM selected
        ON CONFLICT (album_file_id, tag_id) DO NOTHING
        RETURNING tag_id
      )
      SELECT tag_id AS id FROM selected
    `

    sendJson(response, 200, { albumFileId, tagIds: updated.map((tag) => tag.id) })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Photo tag operation failed', error)
    sendJson(response, 500, { error: '写真のタグを更新できませんでした。' })
  }
}
