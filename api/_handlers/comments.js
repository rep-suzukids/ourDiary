import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_COMMENT_LENGTH = 2000

function sendJson(response, status, body) {
  response.status(status).json(body)
}

function targetFrom(request) {
  const url = new URL(request.url, 'http://localhost')
  const targetType = request.body?.targetType ?? request.query?.targetType ?? url.searchParams.get('targetType')
  const targetId = request.body?.targetId ?? request.query?.targetId ?? url.searchParams.get('targetId')
  if (!['diary', 'photo'].includes(targetType) || !UUID_PATTERN.test(targetId ?? '')) return null
  return { targetType, targetId }
}

function commentBodyFrom(request) {
  const body = typeof request.body?.text === 'string' ? request.body.text.trim() : ''
  return body && body.length <= MAX_COMMENT_LENGTH ? body : null
}

function requiredPermission(method, targetType) {
  const actionByMethod = { GET: 'read', POST: 'create', PATCH: 'update', DELETE: 'delete' }
  const prefix = targetType === 'photo' ? 'photo:comment' : 'comment'
  return `${prefix}:${actionByMethod[method]}`
}

function assertPermission(authorization, permission) {
  if (!authorization.permissions.includes(permission)) {
    throw new AuthorizationError('この操作を行う権限がありません。')
  }
}

async function targetExists(sql, familyId, target) {
  if (target.targetType === 'diary') {
    const rows = await sql`
      SELECT id
      FROM diary_entries
      WHERE id = ${target.targetId}
        AND family_id = ${familyId}
        AND entry_type = 'note'
        AND deleted_at IS NULL
      LIMIT 1
    `
    return rows.length > 0
  }

  const rows = await sql`
    SELECT id
    FROM drive_album_files
    WHERE id = ${target.targetId}
      AND family_id = ${familyId}
    LIMIT 1
  `
  return rows.length > 0
}

async function listComments(sql, familyId, userId, canEdit, target) {
  return sql`
    SELECT
      cmt.id,
      cmt.body AS text,
      cmt.author_id AS "authorId",
      COALESCE(author.display_name, author.email::text) AS "authorName",
      cmt.updated_at AS "updatedAt",
      (cmt.author_id = ${userId} AND ${canEdit}) AS "canEdit"
    FROM comments cmt
    INNER JOIN users author ON author.id = cmt.author_id
    WHERE cmt.family_id = ${familyId}
      AND (
        (${target.targetType} = 'diary' AND cmt.diary_entry_id = ${target.targetId})
        OR (${target.targetType} = 'photo' AND cmt.album_file_id = ${target.targetId})
      )
    ORDER BY cmt.created_at ASC
  `
}

async function getComment(sql, familyId, userId, canEdit, commentId) {
  const rows = await sql`
    SELECT
      cmt.id,
      cmt.body AS text,
      cmt.author_id AS "authorId",
      COALESCE(author.display_name, author.email::text) AS "authorName",
      cmt.updated_at AS "updatedAt",
      CASE WHEN cmt.album_file_id IS NOT NULL THEN 'photo' ELSE 'diary' END AS "targetType",
      (cmt.author_id = ${userId} AND ${canEdit}) AS "canEdit"
    FROM comments cmt
    INNER JOIN users author ON author.id = cmt.author_id
    WHERE cmt.id = ${commentId}
      AND cmt.family_id = ${familyId}
    LIMIT 1
  `
  return rows[0] ?? null
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
    const authorization = await authorizeFamilyRequest(request, familyId)
    const sql = getDatabase()

    if (request.method === 'GET' || request.method === 'POST') {
      const target = targetFrom(request)
      if (!target) {
        sendJson(response, 400, { error: 'コメント対象の指定が正しくありません。' })
        return
      }
      const permission = requiredPermission(request.method, target.targetType)
      assertPermission(authorization, permission)
      if (!await targetExists(sql, familyId, target)) {
        sendJson(response, 404, { error: 'コメント対象が見つかりません。' })
        return
      }

      if (request.method === 'GET') {
        const canEdit = authorization.permissions.includes(requiredPermission('PATCH', target.targetType))
        sendJson(response, 200, {
          comments: await listComments(sql, familyId, authorization.userId, canEdit, target),
        })
        return
      }

      const body = commentBodyFrom(request)
      if (!body) {
        sendJson(response, 400, { error: `コメントは1〜${MAX_COMMENT_LENGTH}文字で入力してください。` })
        return
      }
      const targetColumns = target.targetType === 'diary'
        ? { diaryEntryId: target.targetId, albumFileId: null }
        : { diaryEntryId: null, albumFileId: target.targetId }
      const inserted = await sql`
        INSERT INTO comments (family_id, diary_entry_id, album_file_id, author_id, body)
        VALUES (
          ${familyId}, ${targetColumns.diaryEntryId}, ${targetColumns.albumFileId},
          ${authorization.userId}, ${body}
        )
        RETURNING id
      `
      sendJson(response, 201, {
        comment: await getComment(
          sql,
          familyId,
          authorization.userId,
          authorization.permissions.includes(requiredPermission('PATCH', target.targetType)),
          inserted[0].id,
        ),
      })
      return
    }

    const commentId = request.body?.id
    if (!UUID_PATTERN.test(commentId ?? '')) {
      sendJson(response, 400, { error: 'コメントIDが正しくありません。' })
      return
    }
    const existingComment = await getComment(sql, familyId, authorization.userId, false, commentId)
    if (!existingComment) {
      sendJson(response, 404, { error: 'コメントが見つかりません。' })
      return
    }
    const permission = requiredPermission(request.method, existingComment.targetType)
    assertPermission(authorization, permission)

    if (request.method === 'PATCH') {
      const body = commentBodyFrom(request)
      if (!body) {
        sendJson(response, 400, { error: `コメントは1〜${MAX_COMMENT_LENGTH}文字で入力してください。` })
        return
      }
      const rows = await sql`
        UPDATE comments
        SET body = ${body}, updated_at = now()
        WHERE id = ${commentId}
          AND family_id = ${familyId}
          AND author_id = ${authorization.userId}
        RETURNING id
      `
      if (rows.length === 0) {
        sendJson(response, 403, { error: '投稿者本人だけがコメントを編集できます。' })
        return
      }
      sendJson(response, 200, {
        comment: await getComment(sql, familyId, authorization.userId, true, commentId),
      })
      return
    }

    const rows = await sql`
      DELETE FROM comments
      WHERE id = ${commentId}
        AND family_id = ${familyId}
        AND author_id = ${authorization.userId}
      RETURNING id
    `
    if (rows.length === 0) {
      sendJson(response, 403, { error: '投稿者本人だけがコメントを削除できます。' })
      return
    }
    sendJson(response, 200, { id: rows[0].id })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Comment operation failed', error)
    sendJson(response, 500, { error: 'コメントの処理に失敗しました。' })
  }
}
