import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

const TIME_TYPES = new Set(['exact', 'period', 'unknown'])
const TIME_PERIODS = new Set(['late_night', 'early_morning', 'morning', 'noon', 'evening', 'night'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sendJson(response, status, body) {
  response.status(status).json(body)
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value
    && Number(value.slice(0, 4)) >= 2026
    && Number(value.slice(0, 4)) <= 2050
}

function isValidTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false
  const [hour, minute] = value.split(':').map(Number)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function validateInput(body) {
  const childId = typeof body?.childId === 'string' ? body.childId : ''
  const date = body?.date
  const timeType = typeof body?.timeType === 'string' ? body.timeType : ''
  const time = typeof body?.time === 'string' ? body.time : ''
  const timePeriod = typeof body?.timePeriod === 'string' ? body.timePeriod : ''
  const text = typeof body?.text === 'string' ? body.text.trim() : ''

  if (!UUID_PATTERN.test(childId) || !isValidDate(date)) return null
  if (!TIME_TYPES.has(timeType) || text.length < 1 || text.length > 5000) return null
  if (timeType === 'exact' && !isValidTime(time)) return null
  if (timeType === 'period' && !TIME_PERIODS.has(timePeriod)) return null

  return {
    childId,
    date,
    timeType,
    time: timeType === 'exact' ? time : null,
    timePeriod: timeType === 'period' ? timePeriod : null,
    text,
  }
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

async function getNotes(sql, familyId, userId, date) {
  return sql`
    SELECT
      tn.id,
      tn.child_id AS "childId",
      c.display_name AS "childName",
      to_char(tn.note_date, 'YYYY-MM-DD') AS date,
      tn.time_type AS "timeType",
      CASE WHEN tn.note_time IS NULL THEN NULL ELSE to_char(tn.note_time, 'HH24:MI') END AS time,
      tn.time_period AS "timePeriod",
      tn.body AS text,
      tn.author_id AS "authorId",
      COALESCE(u.display_name, u.email::text) AS "authorName",
      tn.created_at AS "createdAt",
      tn.updated_at AS "updatedAt",
      (tn.author_id = ${userId}) AS "canEdit"
    FROM timeline_notes tn
    INNER JOIN children c
      ON c.family_id = tn.family_id AND c.id = tn.child_id
    INNER JOIN users u ON u.id = tn.author_id
    WHERE tn.family_id = ${familyId}
      AND tn.note_date = ${date}
      AND tn.deleted_at IS NULL
    ORDER BY
      CASE
        WHEN tn.time_type = 'exact' THEN
          EXTRACT(HOUR FROM tn.note_time) * 60 + EXTRACT(MINUTE FROM tn.note_time)
        WHEN tn.time_period = 'late_night' THEN 120
        WHEN tn.time_period = 'early_morning' THEN 330
        WHEN tn.time_period = 'morning' THEN 540
        WHEN tn.time_period = 'noon' THEN 780
        WHEN tn.time_period = 'evening' THEN 1020
        WHEN tn.time_period = 'night' THEN 1290
        ELSE 2000
      END ASC,
      tn.created_at ASC
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
    const permissionByMethod = {
      GET: 'care:read',
      POST: 'care:create',
      PATCH: 'care:update',
      DELETE: 'care:delete',
    }
    const authorization = await authorizeFamilyRequest(request, familyId, permissionByMethod[request.method])
    const sql = getDatabase()

    if (request.method === 'GET') {
      const url = new URL(request.url, 'http://localhost')
      const date = request.query?.date ?? url.searchParams.get('date')
      if (!isValidDate(date)) {
        sendJson(response, 400, { error: '表示する日付が正しくありません。' })
        return
      }
      const [children, notes] = await Promise.all([
        getFixedChildren(sql, familyId),
        getNotes(sql, familyId, authorization.userId, date),
      ])
      sendJson(response, 200, { children, notes })
      return
    }

    if (request.method === 'POST') {
      const input = validateInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '時刻と本文を正しく入力してください。' })
        return
      }
      const children = await getFixedChildren(sql, familyId)
      if (!children.some((child) => child.id === input.childId)) {
        sendJson(response, 400, { error: '対象の子どもが正しくありません。' })
        return
      }
      const rows = await sql`
        INSERT INTO timeline_notes (
          family_id, child_id, note_date, time_type, note_time, time_period, body, author_id
        ) VALUES (
          ${familyId}, ${input.childId}, ${input.date}, ${input.timeType}, ${input.time},
          ${input.timePeriod}, ${input.text}, ${authorization.userId}
        )
        RETURNING id
      `
      sendJson(response, 201, { id: rows[0].id })
      return
    }

    const noteId = typeof request.body?.id === 'string' ? request.body.id : ''
    if (!UUID_PATTERN.test(noteId)) {
      sendJson(response, 400, { error: '記録IDが正しくありません。' })
      return
    }

    if (request.method === 'PATCH') {
      const input = validateInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '時刻と本文を正しく入力してください。' })
        return
      }
      const children = await getFixedChildren(sql, familyId)
      if (!children.some((child) => child.id === input.childId)) {
        sendJson(response, 400, { error: '対象の子どもが正しくありません。' })
        return
      }
      const rows = await sql`
        UPDATE timeline_notes
        SET
          child_id = ${input.childId},
          note_date = ${input.date},
          time_type = ${input.timeType},
          note_time = ${input.time},
          time_period = ${input.timePeriod},
          body = ${input.text},
          updated_at = now()
        WHERE id = ${noteId}
          AND family_id = ${familyId}
          AND author_id = ${authorization.userId}
          AND deleted_at IS NULL
        RETURNING id
      `
      if (rows.length === 0) {
        sendJson(response, 403, { error: '投稿者本人だけが記録を編集できます。' })
        return
      }
      sendJson(response, 200, { id: rows[0].id })
      return
    }

    const rows = await sql`
      UPDATE timeline_notes
      SET deleted_at = now(), updated_at = now()
      WHERE id = ${noteId}
        AND family_id = ${familyId}
        AND author_id = ${authorization.userId}
        AND deleted_at IS NULL
      RETURNING id
    `
    if (rows.length === 0) {
      sendJson(response, 403, { error: '投稿者本人だけが記録を削除できます。' })
      return
    }
    sendJson(response, 200, { id: rows[0].id })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Timeline note operation failed', error)
    sendJson(response, 500, { error: 'その他記録の処理に失敗しました。' })
  }
}
