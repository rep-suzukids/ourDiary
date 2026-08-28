import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

function sendJson(response, status, body) {
  response.status(status).json(body)
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validateEntryInput(body) {
  const subjectType = body?.subjectType
  const childId = subjectType === 'child' && typeof body?.childId === 'string' ? body.childId : null
  const diaryDate = body?.date
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!['child', 'father', 'mother'].includes(subjectType)) return null
  if (subjectType === 'child' && !childId) return null
  if (!isValidDate(diaryDate) || !text || text.length > 10_000) return null
  const year = Number(diaryDate.slice(0, 4))
  if (year < 2026 || year > 2050) return null
  return { subjectType, childId, diaryDate, text }
}

async function getFixedChildren(sql, familyId) {
  return sql`
    SELECT id, display_name AS name
    FROM children
    WHERE family_id = ${familyId}
      AND archived_at IS NULL
      AND display_name IN ('ともちゃん', 'ゆうちゃん')
    ORDER BY CASE display_name WHEN 'ともちゃん' THEN 1 WHEN 'ゆうちゃん' THEN 2 ELSE 3 END
  `
}

async function getEntries(sql, familyId, userId, year, month) {
  return sql`
    SELECT
      de.id,
      de.subject_type AS "subjectType",
      de.child_id AS "childId",
      CASE de.subject_type
        WHEN 'father' THEN 'お父さん'
        WHEN 'mother' THEN 'ママ'
        ELSE c.display_name
      END AS "subjectName",
      to_char(de.diary_date, 'YYYY-MM-DD') AS date,
      de.body AS text,
      de.author_id AS "authorId",
      COALESCE(u.display_name, u.email::text) AS "authorName",
      de.created_at AS "createdAt",
      de.updated_at AS "updatedAt",
      (de.author_id = ${userId}) AS "canEdit",
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', cmt.id,
            'text', cmt.body,
            'authorId', cmt.author_id,
            'authorName', COALESCE(comment_author.display_name, comment_author.email::text),
            'updatedAt', cmt.updated_at,
            'canEdit', cmt.author_id = ${userId}
          )
          ORDER BY cmt.created_at ASC
        )
        FROM comments cmt
        INNER JOIN users comment_author ON comment_author.id = cmt.author_id
        WHERE cmt.family_id = ${familyId}
          AND cmt.diary_entry_id = de.id
      ), '[]'::json) AS comments
    FROM diary_entries de
    LEFT JOIN children c ON c.id = de.child_id AND c.family_id = de.family_id
    INNER JOIN users u ON u.id = de.author_id
    WHERE de.family_id = ${familyId}
      AND de.entry_type = 'note'
      AND de.deleted_at IS NULL
      AND EXTRACT(YEAR FROM de.diary_date) = ${year}
      AND EXTRACT(MONTH FROM de.diary_date) = ${month}
    ORDER BY de.diary_date ASC, de.created_at ASC
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
    const requiredPermission = request.method === 'POST'
      ? 'entry:create'
      : request.method === 'PATCH'
        ? 'entry:update'
        : request.method === 'DELETE'
          ? 'entry:delete'
          : undefined
    const authorization = await authorizeFamilyRequest(request, familyId, requiredPermission)
    const sql = getDatabase()

    if (request.method === 'GET') {
      const url = new URL(request.url, 'http://localhost')
      const year = Number(request.query?.year ?? url.searchParams.get('year'))
      const month = Number(request.query?.month ?? url.searchParams.get('month'))
      if (!Number.isInteger(year) || year < 2026 || year > 2050 || !Number.isInteger(month) || month < 1 || month > 12) {
        sendJson(response, 400, { error: '表示する年月が正しくありません。' })
        return
      }
      const [children, entries] = await Promise.all([
        getFixedChildren(sql, familyId),
        getEntries(sql, familyId, authorization.userId, year, month),
      ])
      sendJson(response, 200, { children, entries })
      return
    }

    if (request.method === 'POST') {
      const input = validateEntryInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '日記の対象・日付・本文を正しく入力してください。' })
        return
      }
      const children = await getFixedChildren(sql, familyId)
      if (input.subjectType === 'child' && !children.some((child) => child.id === input.childId)) {
        sendJson(response, 400, { error: '対象の子どもを選択してください。' })
        return
      }
      const rows = await sql`
        INSERT INTO diary_entries (
          family_id, subject_type, child_id, author_id, entry_type, body, diary_date,
          recorded_at, audience
        ) VALUES (
          ${familyId}, ${input.subjectType}, ${input.childId}, ${authorization.userId}, 'note', ${input.text},
          ${input.diaryDate}, (${input.diaryDate}::date + time '12:00') AT TIME ZONE 'Asia/Tokyo',
          'family_members'
        )
        RETURNING id
      `
      sendJson(response, 201, { id: rows[0].id })
      return
    }

    const entryId = typeof request.body?.id === 'string' ? request.body.id : ''
    if (!entryId) {
      sendJson(response, 400, { error: '日記IDが正しくありません。' })
      return
    }

    if (request.method === 'PATCH') {
      const input = validateEntryInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '日記の対象・日付・本文を正しく入力してください。' })
        return
      }
      const children = await getFixedChildren(sql, familyId)
      if (input.subjectType === 'child' && !children.some((child) => child.id === input.childId)) {
        sendJson(response, 400, { error: '対象の子どもを選択してください。' })
        return
      }
      const rows = await sql`
        UPDATE diary_entries
        SET
          subject_type = ${input.subjectType},
          child_id = ${input.childId},
          body = ${input.text},
          diary_date = ${input.diaryDate},
          recorded_at = (${input.diaryDate}::date + time '12:00') AT TIME ZONE 'Asia/Tokyo',
          updated_at = now()
        WHERE id = ${entryId}
          AND family_id = ${familyId}
          AND author_id = ${authorization.userId}
          AND deleted_at IS NULL
        RETURNING id
      `
      if (rows.length === 0) {
        sendJson(response, 403, { error: '投稿者本人だけが日記を編集できます。' })
        return
      }
      sendJson(response, 200, { id: rows[0].id })
      return
    }

    const rows = await sql`
      WITH deleted_entry AS (
        UPDATE diary_entries
        SET deleted_at = now(), updated_at = now()
        WHERE id = ${entryId}
          AND family_id = ${familyId}
          AND author_id = ${authorization.userId}
          AND deleted_at IS NULL
        RETURNING id
      ), deleted_comments AS (
        DELETE FROM comments cmt
        USING deleted_entry
        WHERE cmt.family_id = ${familyId}
          AND cmt.diary_entry_id = deleted_entry.id
        RETURNING cmt.id
      ), deleted_reactions AS (
        DELETE FROM reactions reaction
        USING deleted_entry
        WHERE reaction.family_id = ${familyId}
          AND reaction.diary_entry_id = deleted_entry.id
        RETURNING reaction.id
      )
      SELECT
        deleted_entry.id,
        (SELECT COUNT(*)::integer FROM deleted_comments) AS "deletedCommentCount",
        (SELECT COUNT(*)::integer FROM deleted_reactions) AS "deletedReactionCount"
      FROM deleted_entry
    `
    if (rows.length === 0) {
      sendJson(response, 403, { error: '投稿者本人だけが日記を削除できます。' })
      return
    }
    sendJson(response, 200, { id: rows[0].id })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Diary operation failed', error)
    sendJson(response, 500, { error: '日記の処理に失敗しました。' })
  }
}
