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

function optionalTime(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return undefined
  const [hour, minute] = value.split(':').map(Number)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined
  return value
}

function validateScheduleInput(body) {
  const scheduleDate = body?.date
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const startTime = optionalTime(body?.startTime)
  const endTime = optionalTime(body?.endTime)
  if (!isValidDate(scheduleDate) || !text || text.length > 10_000) return null
  if (startTime === undefined || endTime === undefined) return null
  const year = Number(scheduleDate.slice(0, 4))
  if (year < 2026 || year > 2050) return null
  return { scheduleDate, startTime, endTime, text }
}

async function getSchedules(sql, familyId, userId, canModify, year, month) {
  return sql`
    SELECT
      schedule.id,
      to_char(schedule.schedule_date, 'YYYY-MM-DD') AS date,
      CASE WHEN schedule.start_time IS NULL THEN NULL ELSE to_char(schedule.start_time, 'HH24:MI') END AS "startTime",
      CASE WHEN schedule.end_time IS NULL THEN NULL ELSE to_char(schedule.end_time, 'HH24:MI') END AS "endTime",
      schedule.body AS text,
      schedule.author_id AS "authorId",
      COALESCE(author.display_name, author.email::text) AS "authorName",
      schedule.created_at AS "createdAt",
      schedule.updated_at AS "updatedAt",
      (schedule.author_id = ${userId} AND ${canModify}) AS "canEdit"
    FROM family_schedules schedule
    INNER JOIN users author ON author.id = schedule.author_id
    WHERE schedule.family_id = ${familyId}
      AND schedule.deleted_at IS NULL
      AND EXTRACT(YEAR FROM schedule.schedule_date) = ${year}
      AND EXTRACT(MONTH FROM schedule.schedule_date) = ${month}
    ORDER BY
      schedule.schedule_date ASC,
      COALESCE(schedule.start_time, schedule.end_time) ASC NULLS LAST,
      schedule.created_at ASC
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
      GET: 'schedule:read',
      POST: 'schedule:create',
      PATCH: 'schedule:update',
      DELETE: 'schedule:delete',
    }
    const authorization = await authorizeFamilyRequest(request, familyId, permissionByMethod[request.method])
    const sql = getDatabase()

    if (request.method === 'GET') {
      const url = new URL(request.url, 'http://localhost')
      const year = Number(request.query?.year ?? url.searchParams.get('year'))
      const month = Number(request.query?.month ?? url.searchParams.get('month'))
      if (!Number.isInteger(year) || year < 2026 || year > 2050 || !Number.isInteger(month) || month < 1 || month > 12) {
        sendJson(response, 400, { error: '表示する年月が正しくありません。' })
        return
      }
      const schedules = await getSchedules(
        sql,
        familyId,
        authorization.userId,
        authorization.permissions.includes('schedule:update'),
        year,
        month,
      )
      sendJson(response, 200, { schedules })
      return
    }

    if (request.method === 'POST') {
      const input = validateScheduleInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '予定の日付・時刻・内容を正しく入力してください。' })
        return
      }
      const rows = await sql`
        INSERT INTO family_schedules (
          family_id, schedule_date, start_time, end_time, body, author_id
        ) VALUES (
          ${familyId}, ${input.scheduleDate}, ${input.startTime}, ${input.endTime}, ${input.text}, ${authorization.userId}
        )
        RETURNING id
      `
      sendJson(response, 201, { id: rows[0].id })
      return
    }

    const scheduleId = typeof request.body?.id === 'string' ? request.body.id : ''
    if (!scheduleId) {
      sendJson(response, 400, { error: '予定IDが正しくありません。' })
      return
    }

    if (request.method === 'PATCH') {
      const input = validateScheduleInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '予定の日付・時刻・内容を正しく入力してください。' })
        return
      }
      const rows = await sql`
        UPDATE family_schedules
        SET
          schedule_date = ${input.scheduleDate},
          start_time = ${input.startTime},
          end_time = ${input.endTime},
          body = ${input.text},
          updated_at = now()
        WHERE id = ${scheduleId}
          AND family_id = ${familyId}
          AND author_id = ${authorization.userId}
          AND deleted_at IS NULL
        RETURNING id
      `
      if (rows.length === 0) {
        sendJson(response, 403, { error: '登録した本人だけが予定を編集できます。' })
        return
      }
      sendJson(response, 200, { id: rows[0].id })
      return
    }

    const rows = await sql`
      UPDATE family_schedules
      SET deleted_at = now(), updated_at = now()
      WHERE id = ${scheduleId}
        AND family_id = ${familyId}
        AND author_id = ${authorization.userId}
        AND deleted_at IS NULL
      RETURNING id
    `
    if (rows.length === 0) {
      sendJson(response, 403, { error: '登録した本人だけが予定を削除できます。' })
      return
    }
    sendJson(response, 200, { id: rows[0].id })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Schedule operation failed', error)
    sendJson(response, 500, { error: '予定の処理に失敗しました。' })
  }
}
