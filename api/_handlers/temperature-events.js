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

function monthRange(yearValue, monthValue) {
  const year = Number(yearValue)
  const month = Number(monthValue)
  if (!Number.isInteger(year) || year < 2026 || year > 2050
    || !Number.isInteger(month) || month < 1 || month > 12) return null
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    endExclusive: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
  }
}

function isValidTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false
  const [hour, minute] = value.split(':').map(Number)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function validateInput(body) {
  const childId = typeof body?.childId === 'string' ? body.childId : ''
  const date = body?.date
  const temperature = Number(body?.temperature)
  const timeType = typeof body?.timeType === 'string' ? body.timeType : ''
  const time = typeof body?.time === 'string' ? body.time : ''
  const timePeriod = typeof body?.timePeriod === 'string' ? body.timePeriod : ''
  const memo = typeof body?.memo === 'string' ? body.memo.trim() : ''

  if (!UUID_PATTERN.test(childId) || !isValidDate(date)) return null
  if (!Number.isFinite(temperature) || temperature < 30 || temperature > 45) return null
  if (Math.abs(temperature * 10 - Math.round(temperature * 10)) > 0.00001) return null
  if (!TIME_TYPES.has(timeType) || memo.length > 5000) return null
  if (timeType === 'exact' && !isValidTime(time)) return null
  if (timeType === 'period' && !TIME_PERIODS.has(timePeriod)) return null

  return {
    childId,
    date,
    temperature: Number(temperature.toFixed(1)),
    timeType,
    time: timeType === 'exact' ? time : null,
    timePeriod: timeType === 'period' ? timePeriod : null,
    memo,
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

async function getEvents(sql, familyId, userId, date) {
  return sql`
    SELECT
      tr.id,
      tr.child_id AS "childId",
      c.display_name AS "childName",
      to_char(tr.measured_date, 'YYYY-MM-DD') AS date,
      tr.time_type AS "timeType",
      CASE WHEN tr.measured_time IS NULL THEN NULL ELSE to_char(tr.measured_time, 'HH24:MI') END AS time,
      tr.time_period AS "timePeriod",
      tr.temperature_c::text AS temperature,
      tr.memo,
      tr.author_id AS "authorId",
      COALESCE(u.display_name, u.email::text) AS "authorName",
      tr.created_at AS "createdAt",
      tr.updated_at AS "updatedAt",
      (tr.author_id = ${userId}) AS "canEdit"
    FROM temperature_readings tr
    INNER JOIN children c
      ON c.family_id = tr.family_id AND c.id = tr.child_id
    INNER JOIN users u ON u.id = tr.author_id
    WHERE tr.family_id = ${familyId}
      AND tr.measured_date = ${date}
      AND tr.deleted_at IS NULL
    ORDER BY
      CASE
        WHEN tr.time_type = 'exact' THEN
          EXTRACT(HOUR FROM tr.measured_time) * 60 + EXTRACT(MINUTE FROM tr.measured_time)
        WHEN tr.time_period = 'late_night' THEN 120
        WHEN tr.time_period = 'early_morning' THEN 330
        WHEN tr.time_period = 'morning' THEN 540
        WHEN tr.time_period = 'noon' THEN 780
        WHEN tr.time_period = 'evening' THEN 1020
        WHEN tr.time_period = 'night' THEN 1290
        ELSE 2000
      END ASC,
      tr.created_at ASC
  `
}

async function getLatestTemperatures(sql, familyId) {
  return sql`
    SELECT DISTINCT ON (child_id)
      child_id AS "childId",
      temperature_c::text AS temperature
    FROM temperature_readings
    WHERE family_id = ${familyId}
      AND deleted_at IS NULL
    ORDER BY
      child_id,
      measured_date DESC,
      CASE
        WHEN time_type = 'exact' THEN
          EXTRACT(HOUR FROM measured_time) * 60 + EXTRACT(MINUTE FROM measured_time)
        WHEN time_period = 'night' THEN 1290
        WHEN time_period = 'evening' THEN 1020
        WHEN time_period = 'noon' THEN 780
        WHEN time_period = 'morning' THEN 540
        WHEN time_period = 'early_morning' THEN 330
        WHEN time_period = 'late_night' THEN 120
        ELSE -1
      END DESC,
      created_at DESC
  `
}

async function getMonthlySummaries(sql, familyId, start, endExclusive) {
  return sql`
    SELECT
      to_char(measured_date, 'YYYY-MM-DD') AS date,
      child_id AS "childId",
      COUNT(*)::int AS count
    FROM temperature_readings
    WHERE family_id = ${familyId}
      AND measured_date >= ${start}
      AND measured_date < ${endExclusive}
      AND deleted_at IS NULL
    GROUP BY measured_date, child_id
    ORDER BY measured_date, child_id
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
      const view = request.query?.view ?? url.searchParams.get('view')
      if (view === 'month') {
        const range = monthRange(
          request.query?.year ?? url.searchParams.get('year'),
          request.query?.month ?? url.searchParams.get('month'),
        )
        if (!range) {
          sendJson(response, 400, { error: '表示する年月が正しくありません。' })
          return
        }
        const [children, summaries] = await Promise.all([
          getFixedChildren(sql, familyId),
          getMonthlySummaries(sql, familyId, range.start, range.endExclusive),
        ])
        sendJson(response, 200, { children, summaries })
        return
      }

      const date = request.query?.date ?? url.searchParams.get('date')
      if (!isValidDate(date)) {
        sendJson(response, 400, { error: '表示する日付が正しくありません。' })
        return
      }
      const [children, events, latestTemperatures] = await Promise.all([
        getFixedChildren(sql, familyId),
        getEvents(sql, familyId, authorization.userId, date),
        getLatestTemperatures(sql, familyId),
      ])
      sendJson(response, 200, { children, events, latestTemperatures })
      return
    }

    if (request.method === 'POST') {
      const input = validateInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '子ども・日付・体温・検温時間を正しく入力してください。' })
        return
      }
      const children = await getFixedChildren(sql, familyId)
      if (!children.some((child) => child.id === input.childId)) {
        sendJson(response, 400, { error: '対象の子どもを選択してください。' })
        return
      }
      const rows = await sql`
        INSERT INTO temperature_readings (
          family_id, child_id, measured_date, time_type, measured_time,
          time_period, temperature_c, memo, author_id
        ) VALUES (
          ${familyId}, ${input.childId}, ${input.date}, ${input.timeType}, ${input.time},
          ${input.timePeriod}, ${input.temperature}, ${input.memo}, ${authorization.userId}
        )
        RETURNING id
      `
      sendJson(response, 201, { id: rows[0].id })
      return
    }

    const eventId = typeof request.body?.id === 'string' ? request.body.id : ''
    if (!UUID_PATTERN.test(eventId)) {
      sendJson(response, 400, { error: '記録IDが正しくありません。' })
      return
    }

    if (request.method === 'PATCH') {
      const input = validateInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '子ども・日付・体温・検温時間を正しく入力してください。' })
        return
      }
      const children = await getFixedChildren(sql, familyId)
      if (!children.some((child) => child.id === input.childId)) {
        sendJson(response, 400, { error: '対象の子どもを選択してください。' })
        return
      }
      const rows = await sql`
        UPDATE temperature_readings
        SET
          child_id = ${input.childId},
          measured_date = ${input.date},
          time_type = ${input.timeType},
          measured_time = ${input.time},
          time_period = ${input.timePeriod},
          temperature_c = ${input.temperature},
          memo = ${input.memo},
          updated_at = now()
        WHERE id = ${eventId}
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
      UPDATE temperature_readings
      SET deleted_at = now(), updated_at = now()
      WHERE id = ${eventId}
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
    console.error('Temperature event operation failed', error)
    sendJson(response, 500, { error: '体温記録の処理に失敗しました。' })
  }
}
