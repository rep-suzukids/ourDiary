import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

const AMOUNTS = new Set(['tiny', 'small', 'normal', 'large'])
const CONSISTENCIES = new Set(['diarrhea', 'soft', 'normal', 'hard'])
const COLORS = new Set(['white', 'yellow', 'orange', 'brown', 'green', 'red', 'black'])
const URINE_AMOUNTS = new Set(['small', 'normal', 'large'])
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
  const amount = typeof body?.amount === 'string' ? body.amount : ''
  const consistency = typeof body?.consistency === 'string' ? body.consistency : ''
  const color = typeof body?.color === 'string' ? body.color : ''
  const urineAmount = typeof body?.urineAmount === 'string' ? body.urineAmount : ''
  const date = body?.date
  const timeType = typeof body?.timeType === 'string' ? body.timeType : ''
  const time = typeof body?.time === 'string' ? body.time : ''
  const timePeriod = typeof body?.timePeriod === 'string' ? body.timePeriod : ''
  const memo = typeof body?.memo === 'string' ? body.memo.trim() : ''

  if (!UUID_PATTERN.test(childId) || !isValidDate(date)) return null
  const hasBowel = amount !== '' || consistency !== '' || color !== ''
  const hasUrine = urineAmount !== ''
  if (!hasBowel && !hasUrine) return null
  if (hasBowel && (!AMOUNTS.has(amount) || !CONSISTENCIES.has(consistency) || !COLORS.has(color))) return null
  if (hasUrine && !URINE_AMOUNTS.has(urineAmount)) return null
  if (!TIME_TYPES.has(timeType) || memo.length > 5000) return null
  if (timeType === 'exact' && !isValidTime(time)) return null
  if (timeType === 'period' && !TIME_PERIODS.has(timePeriod)) return null

  return {
    childId,
    amount: hasBowel ? amount : null,
    consistency: hasBowel ? consistency : null,
    color: hasBowel ? color : null,
    urineAmount: hasUrine ? urineAmount : null,
    date,
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
      bm.id,
      bm.child_id AS "childId",
      c.display_name AS "childName",
      to_char(bm.event_date, 'YYYY-MM-DD') AS date,
      bm.time_type AS "timeType",
      CASE WHEN bm.event_time IS NULL THEN NULL ELSE to_char(bm.event_time, 'HH24:MI') END AS time,
      bm.time_period AS "timePeriod",
      bm.amount_code AS amount,
      bm.consistency_code AS consistency,
      bm.color_code AS color,
      bm.urine_amount_code AS "urineAmount",
      bm.memo,
      bm.author_id AS "authorId",
      COALESCE(u.display_name, u.email::text) AS "authorName",
      bm.created_at AS "createdAt",
      bm.updated_at AS "updatedAt",
      (bm.author_id = ${userId}) AS "canEdit"
    FROM bowel_movements bm
    INNER JOIN children c
      ON c.family_id = bm.family_id AND c.id = bm.child_id
    INNER JOIN users u ON u.id = bm.author_id
    WHERE bm.family_id = ${familyId}
      AND bm.event_date = ${date}
      AND bm.deleted_at IS NULL
    ORDER BY
      CASE
        WHEN bm.time_type = 'exact' THEN
          EXTRACT(HOUR FROM bm.event_time) * 60 + EXTRACT(MINUTE FROM bm.event_time)
        WHEN bm.time_period = 'late_night' THEN 120
        WHEN bm.time_period = 'early_morning' THEN 330
        WHEN bm.time_period = 'morning' THEN 540
        WHEN bm.time_period = 'noon' THEN 780
        WHEN bm.time_period = 'evening' THEN 1020
        WHEN bm.time_period = 'night' THEN 1290
        ELSE 2000
      END ASC,
      bm.created_at ASC
  `
}

async function getMonthlySummaries(sql, familyId, start, endExclusive) {
  return sql`
    SELECT
      to_char(event_date, 'YYYY-MM-DD') AS date,
      child_id AS "childId",
      COUNT(*)::int AS count
    FROM bowel_movements
    WHERE family_id = ${familyId}
      AND event_date >= ${start}
      AND event_date < ${endExclusive}
      AND deleted_at IS NULL
    GROUP BY event_date, child_id
    ORDER BY event_date, child_id
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
      const [children, events] = await Promise.all([
        getFixedChildren(sql, familyId),
        getEvents(sql, familyId, authorization.userId, date),
      ])
      sendJson(response, 200, { children, events })
      return
    }

    if (request.method === 'POST') {
      const input = validateInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '記録内容を正しく入力してください。' })
        return
      }
      const children = await getFixedChildren(sql, familyId)
      if (!children.some((child) => child.id === input.childId)) {
        sendJson(response, 400, { error: '対象の子どもを選択してください。' })
        return
      }
      const rows = await sql`
        INSERT INTO bowel_movements (
          family_id, child_id, event_date, time_type, event_time, time_period,
          amount_code, consistency_code, color_code, urine_amount_code, memo, author_id
        ) VALUES (
          ${familyId}, ${input.childId}, ${input.date}, ${input.timeType}, ${input.time}, ${input.timePeriod},
          ${input.amount}, ${input.consistency}, ${input.color}, ${input.urineAmount}, ${input.memo}, ${authorization.userId}
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
        sendJson(response, 400, { error: '記録内容を正しく入力してください。' })
        return
      }
      const children = await getFixedChildren(sql, familyId)
      if (!children.some((child) => child.id === input.childId)) {
        sendJson(response, 400, { error: '対象の子どもを選択してください。' })
        return
      }
      const rows = await sql`
        UPDATE bowel_movements
        SET
          child_id = ${input.childId},
          event_date = ${input.date},
          time_type = ${input.timeType},
          event_time = ${input.time},
          time_period = ${input.timePeriod},
          amount_code = ${input.amount},
          consistency_code = ${input.consistency},
          color_code = ${input.color},
          urine_amount_code = ${input.urineAmount},
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
      UPDATE bowel_movements
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
    console.error('Bowel event operation failed', error)
    sendJson(response, 500, { error: 'おむつ記録の処理に失敗しました。' })
  }
}
