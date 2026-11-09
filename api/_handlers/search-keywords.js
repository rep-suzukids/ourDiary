import {
  MAX_SAVED_SEARCH_KEYWORD_LENGTH,
  MAX_SAVED_SEARCH_KEYWORDS,
} from '../../shared/searchKeywordConfig.js'
import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sendJson(response, status, body) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.status(status).json(body)
}

function normalizeKeyword(value) {
  if (typeof value !== 'string') return null
  const keyword = value.trim()
  return keyword && [...keyword].length <= MAX_SAVED_SEARCH_KEYWORD_LENGTH ? keyword : null
}

function keywordId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : ''
}

async function listKeywords(sql, familyId) {
  return sql`
    SELECT
      id,
      keyword,
      display_order AS "displayOrder",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM saved_search_keywords
    WHERE family_id = ${familyId}
    ORDER BY display_order, created_at, id
  `
}

export default async function handler(request, response) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const familyId = request.headers['x-family-id']
  if (!UUID_PATTERN.test(familyId ?? '')) {
    sendJson(response, 400, { error: '家族の指定が正しくありません。' })
    return
  }

  try {
    const authorization = await authorizeFamilyRequest(
      request,
      familyId,
      request.method === 'GET' ? 'search_keyword:read' : 'search_keyword:manage',
    )
    const sql = getDatabase()

    if (request.method === 'GET') {
      sendJson(response, 200, {
        keywords: await listKeywords(sql, familyId),
        maxKeywords: MAX_SAVED_SEARCH_KEYWORDS,
        maxKeywordLength: MAX_SAVED_SEARCH_KEYWORD_LENGTH,
      })
      return
    }

    if (request.method === 'POST') {
      const keyword = normalizeKeyword(request.body?.keyword)
      if (!keyword) {
        sendJson(response, 400, { error: `キーワードを1〜${MAX_SAVED_SEARCH_KEYWORD_LENGTH}文字で入力してください。` })
        return
      }
      if (MAX_SAVED_SEARCH_KEYWORDS !== null) {
        const countRows = await sql`
          SELECT COUNT(*)::integer AS count
          FROM saved_search_keywords
          WHERE family_id = ${familyId}
        `
        if (countRows[0].count >= MAX_SAVED_SEARCH_KEYWORDS) {
          sendJson(response, 409, { error: `キーワードは${MAX_SAVED_SEARCH_KEYWORDS}個まで登録できます。` })
          return
        }
      }
      const rows = await sql`
        INSERT INTO saved_search_keywords (family_id, keyword, display_order, created_by)
        SELECT
          ${familyId},
          ${keyword},
          COALESCE(MAX(display_order) + 1, 0),
          ${authorization.userId}
        FROM saved_search_keywords
        WHERE family_id = ${familyId}
        RETURNING
          id,
          keyword,
          display_order AS "displayOrder",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `
      sendJson(response, 201, { keyword: rows[0] })
      return
    }

    if (request.method === 'PATCH' && request.body?.action === 'reorder') {
      const ids = Array.isArray(request.body?.ids) ? request.body.ids : []
      if (ids.length === 0 || ids.some((id) => !keywordId(id)) || new Set(ids).size !== ids.length) {
        sendJson(response, 400, { error: '表示順の指定が正しくありません。' })
        return
      }
      const serializedOrder = JSON.stringify(ids.map((id, displayOrder) => ({ id, displayOrder })))
      const counts = await sql`
        WITH requested AS (
          SELECT *
          FROM json_to_recordset(${serializedOrder}::json) AS item(id uuid, "displayOrder" integer)
        )
        SELECT
          (SELECT COUNT(*)::integer FROM saved_search_keywords WHERE family_id = ${familyId}) AS "existingCount",
          (SELECT COUNT(*)::integer FROM requested) AS "requestedCount",
          (
            SELECT COUNT(*)::integer
            FROM requested
            INNER JOIN saved_search_keywords keyword
              ON keyword.family_id = ${familyId} AND keyword.id = requested.id
          ) AS "matchedCount"
      `
      const count = counts[0]
      if (count.existingCount !== count.requestedCount || count.existingCount !== count.matchedCount) {
        sendJson(response, 400, { error: '表示順を更新できませんでした。画面を再読み込みしてください。' })
        return
      }
      await sql`
        WITH requested AS (
          SELECT *
          FROM json_to_recordset(${serializedOrder}::json) AS item(id uuid, "displayOrder" integer)
        )
        UPDATE saved_search_keywords keyword
        SET display_order = requested."displayOrder", updated_at = now()
        FROM requested
        WHERE keyword.family_id = ${familyId} AND keyword.id = requested.id
      `
      sendJson(response, 200, { keywords: await listKeywords(sql, familyId) })
      return
    }

    const id = keywordId(request.body?.id)
    if (!id) {
      sendJson(response, 400, { error: 'キーワードIDが正しくありません。' })
      return
    }

    if (request.method === 'PATCH') {
      const keyword = normalizeKeyword(request.body?.keyword)
      if (!keyword) {
        sendJson(response, 400, { error: `キーワードを1〜${MAX_SAVED_SEARCH_KEYWORD_LENGTH}文字で入力してください。` })
        return
      }
      const rows = await sql`
        UPDATE saved_search_keywords
        SET keyword = ${keyword}, updated_at = now()
        WHERE family_id = ${familyId} AND id = ${id}
        RETURNING id, keyword, display_order AS "displayOrder", updated_at AS "updatedAt"
      `
      if (rows.length === 0) {
        sendJson(response, 404, { error: 'キーワードが見つかりません。' })
        return
      }
      sendJson(response, 200, { keyword: rows[0] })
      return
    }

    const rows = await sql`
      DELETE FROM saved_search_keywords
      WHERE family_id = ${familyId} AND id = ${id}
      RETURNING id
    `
    if (rows.length === 0) {
      sendJson(response, 404, { error: 'キーワードが見つかりません。' })
      return
    }
    sendJson(response, 200, { id: rows[0].id })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    if (error?.code === '23505') {
      sendJson(response, 409, { error: '同じキーワードが既に登録されています。' })
      return
    }
    console.error('Saved search keyword operation failed', error)
    sendJson(response, 500, { error: '検索キーワードの処理に失敗しました。' })
  }
}
