import { MAX_TAG_NAME_LENGTH, MAX_TAGS } from '../../shared/tagConfig.js'
import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sendJson(response, status, body) {
  response.status(status).json(body)
}

function normalizeName(value) {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name && [...name].length <= MAX_TAG_NAME_LENGTH ? name : null
}

function tagIdFrom(request) {
  const id = typeof request.body?.id === 'string' ? request.body.id : ''
  return UUID_PATTERN.test(id) ? id : ''
}

async function listTags(sql, familyId) {
  return sql`
    SELECT
      t.id,
      t.name,
      COUNT(daft.album_file_id)::integer AS "photoCount",
      t.created_at AS "createdAt",
      t.updated_at AS "updatedAt"
    FROM tags t
    LEFT JOIN drive_album_file_tags daft
      ON daft.family_id = t.family_id AND daft.tag_id = t.id
    WHERE t.family_id = ${familyId}
    GROUP BY t.id
    ORDER BY t.created_at ASC, t.id ASC
  `
}

export default async function handler(request, response) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const familyId = request.headers['x-family-id']
  if (!familyId) {
    sendJson(response, 400, { error: 'Family ID is required' })
    return
  }

  try {
    const authorization = await authorizeFamilyRequest(
      request,
      familyId,
      request.method === 'GET' ? 'tag:read' : 'tag:manage',
    )
    const sql = getDatabase()

    if (request.method === 'GET') {
      sendJson(response, 200, { tags: await listTags(sql, familyId), maxTags: MAX_TAGS })
      return
    }

    if (request.method === 'POST') {
      const name = normalizeName(request.body?.name)
      if (!name) {
        sendJson(response, 400, { error: `タグ名を1〜${MAX_TAG_NAME_LENGTH}文字で入力してください。` })
        return
      }
      if (MAX_TAGS !== null) {
        const countRows = await sql`SELECT COUNT(*)::integer AS count FROM tags WHERE family_id = ${familyId}`
        if (countRows[0].count >= MAX_TAGS) {
          sendJson(response, 409, { error: `タグは${MAX_TAGS}個まで登録できます。` })
          return
        }
      }
      const rows = await sql`
        INSERT INTO tags (family_id, name, created_by)
        VALUES (${familyId}, ${name}, ${authorization.userId})
        RETURNING id, name, 0::integer AS "photoCount", created_at AS "createdAt", updated_at AS "updatedAt"
      `
      sendJson(response, 201, { tag: rows[0], maxTags: MAX_TAGS })
      return
    }

    const id = tagIdFrom(request)
    if (!id) {
      sendJson(response, 400, { error: 'タグIDが正しくありません。' })
      return
    }

    if (request.method === 'PATCH') {
      const name = normalizeName(request.body?.name)
      if (!name) {
        sendJson(response, 400, { error: `タグ名を1〜${MAX_TAG_NAME_LENGTH}文字で入力してください。` })
        return
      }
      const rows = await sql`
        UPDATE tags
        SET name = ${name}, updated_at = now()
        WHERE id = ${id} AND family_id = ${familyId}
        RETURNING id, name, updated_at AS "updatedAt"
      `
      if (rows.length === 0) {
        sendJson(response, 404, { error: 'タグが見つかりません。' })
        return
      }
      sendJson(response, 200, { tag: rows[0] })
      return
    }

    const countRows = await sql`
      SELECT COUNT(daft.album_file_id)::integer AS "photoCount"
      FROM tags t
      LEFT JOIN drive_album_file_tags daft
        ON daft.family_id = t.family_id AND daft.tag_id = t.id
      WHERE t.id = ${id} AND t.family_id = ${familyId}
      GROUP BY t.id
    `
    if (countRows.length === 0) {
      sendJson(response, 404, { error: 'タグが見つかりません。' })
      return
    }
    await sql`DELETE FROM tags WHERE id = ${id} AND family_id = ${familyId}`
    sendJson(response, 200, { id, removedPhotoCount: countRows[0].photoCount })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Tag operation failed', error)
    sendJson(response, 500, { error: 'タグの処理に失敗しました。' })
  }
}
