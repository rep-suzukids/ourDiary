import { AuthorizationError, authorizeFamilyRequest } from './_lib/authorization.js'
import { getDatabase } from './_lib/db.js'

const EVENT_TYPES = new Set(['feeding', 'pumping'])
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
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  return { start, endExclusive: next }
}

function addUtcDays(value, difference) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + difference)
  return date.toISOString().slice(0, 10)
}

function weekRange(value) {
  const date = new Date(`${value}T00:00:00Z`)
  const start = addUtcDays(value, -date.getUTCDay())
  return {
    start,
    end: addUtcDays(start, 6),
    endExclusive: addUtcDays(start, 7),
  }
}

function isValidTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false
  const [hour, minute] = value.split(':').map(Number)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function validateEventInput(body) {
  const eventType = typeof body?.eventType === 'string' ? body.eventType : ''
  const childId = typeof body?.childId === 'string' ? body.childId : ''
  const amountText = String(body?.amountMl ?? '')
  const amountMl = Number(amountText)
  const date = body?.date
  const timeType = typeof body?.timeType === 'string' ? body.timeType : ''
  const time = typeof body?.time === 'string' ? body.time : ''
  const timePeriod = typeof body?.timePeriod === 'string' ? body.timePeriod : ''
  const memo = typeof body?.memo === 'string' ? body.memo.trim() : ''

  if (!EVENT_TYPES.has(eventType) || !isValidDate(date)) return null
  if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amountMl) || amountMl <= 0 || amountMl > 2000) return null
  if (!TIME_TYPES.has(timeType) || memo.length > 5000) return null
  if (eventType === 'feeding' && !UUID_PATTERN.test(childId)) return null
  if (timeType === 'exact' && !isValidTime(time)) return null
  if (timeType === 'period' && !TIME_PERIODS.has(timePeriod)) return null

  return {
    eventType,
    subjectType: eventType === 'feeding' ? 'child' : 'mother',
    childId: eventType === 'feeding' ? childId : null,
    amountMl,
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
      ce.id,
      ce.event_type AS "eventType",
      ce.subject_type AS "subjectType",
      ce.child_id AS "childId",
      c.display_name AS "childName",
      to_char(ce.event_date, 'YYYY-MM-DD') AS date,
      ce.time_type AS "timeType",
      CASE WHEN ce.event_time IS NULL THEN NULL ELSE to_char(ce.event_time, 'HH24:MI') END AS time,
      ce.time_period AS "timePeriod",
      md.amount_ml::float8 AS "amountMl",
      ce.memo,
      ce.author_id AS "authorId",
      COALESCE(u.display_name, u.email::text) AS "authorName",
      ce.created_at AS "createdAt",
      ce.updated_at AS "updatedAt",
      (ce.author_id = ${userId}) AS "canEdit"
    FROM care_events ce
    INNER JOIN milk_event_details md
      ON md.family_id = ce.family_id AND md.event_id = ce.id
    LEFT JOIN children c
      ON c.family_id = ce.family_id AND c.id = ce.child_id
    INNER JOIN users u ON u.id = ce.author_id
    WHERE ce.family_id = ${familyId}
      AND ce.event_date = ${date}
      AND ce.deleted_at IS NULL
    ORDER BY
      CASE
        WHEN ce.time_type = 'exact' THEN
          EXTRACT(HOUR FROM ce.event_time) * 60 + EXTRACT(MINUTE FROM ce.event_time)
        WHEN ce.time_period = 'late_night' THEN 120
        WHEN ce.time_period = 'early_morning' THEN 330
        WHEN ce.time_period = 'morning' THEN 540
        WHEN ce.time_period = 'noon' THEN 780
        WHEN ce.time_period = 'evening' THEN 1020
        WHEN ce.time_period = 'night' THEN 1290
        ELSE 2000
      END ASC,
      ce.created_at ASC
  `
}

async function getCareSummaries(sql, familyId, start, endExclusive) {
  return sql`
    SELECT
      to_char(ce.event_date, 'YYYY-MM-DD') AS date,
      ce.event_type AS "eventType",
      ce.child_id AS "childId",
      COUNT(*)::int AS count,
      COALESCE(SUM(md.amount_ml), 0)::float8 AS "amountMl"
    FROM care_events ce
    INNER JOIN milk_event_details md
      ON md.family_id = ce.family_id AND md.event_id = ce.id
    WHERE ce.family_id = ${familyId}
      AND ce.event_date >= ${start}
      AND ce.event_date < ${endExclusive}
      AND ce.deleted_at IS NULL
    GROUP BY ce.event_date, ce.event_type, ce.child_id
    ORDER BY ce.event_date, ce.event_type, ce.child_id
  `
}

async function getRecentAmounts(sql, familyId) {
  return sql`
    WITH latest_amounts AS (
      SELECT DISTINCT ON (ce.event_type, ce.child_id, md.amount_ml)
        ce.event_type,
        ce.child_id,
        md.amount_ml,
        ce.created_at AS last_used_at
      FROM care_events ce
      INNER JOIN milk_event_details md
        ON md.family_id = ce.family_id AND md.event_id = ce.id
      WHERE ce.family_id = ${familyId}
        AND ce.deleted_at IS NULL
      ORDER BY ce.event_type, ce.child_id, md.amount_ml, ce.created_at DESC
    ), ranked AS (
      SELECT
        event_type,
        child_id,
        amount_ml,
        ROW_NUMBER() OVER (
          PARTITION BY event_type, child_id
          ORDER BY last_used_at DESC
        ) AS position
      FROM latest_amounts
    )
    SELECT
      event_type AS "eventType",
      child_id AS "childId",
      amount_ml::float8 AS "amountMl"
    FROM ranked
    WHERE position <= 5
    ORDER BY event_type, child_id, position
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
    const authorization = await authorizeFamilyRequest(
      request,
      familyId,
      permissionByMethod[request.method],
    )
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
          getCareSummaries(sql, familyId, range.start, range.endExclusive),
        ])
        sendJson(response, 200, { children, summaries })
        return
      }

      const date = request.query?.date ?? url.searchParams.get('date')
      if (!isValidDate(date)) {
        sendJson(response, 400, { error: '表示する日付が正しくありません。' })
        return
      }
      const week = weekRange(date)
      const [children, events, amounts, weeklySummaries] = await Promise.all([
        getFixedChildren(sql, familyId),
        getEvents(sql, familyId, authorization.userId, date),
        getRecentAmounts(sql, familyId),
        getCareSummaries(sql, familyId, week.start, week.endExclusive),
      ])
      const recentAmounts = { pumping: [], children: {} }
      for (const amount of amounts) {
        if (amount.eventType === 'pumping') {
          recentAmounts.pumping.push(amount.amountMl)
        } else {
          recentAmounts.children[amount.childId] ??= []
          recentAmounts.children[amount.childId].push(amount.amountMl)
        }
      }
      sendJson(response, 200, {
        children,
        events,
        recentAmounts,
        weeklySummary: {
          start: week.start,
          end: week.end,
          summaries: weeklySummaries,
        },
      })
      return
    }

    if (request.method === 'POST') {
      const input = validateEventInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '記録内容を正しく入力してください。' })
        return
      }
      if (input.childId) {
        const children = await getFixedChildren(sql, familyId)
        if (!children.some((child) => child.id === input.childId)) {
          sendJson(response, 400, { error: '対象の子どもを選択してください。' })
          return
        }
      }
      const rows = await sql`
        WITH new_event AS (
          INSERT INTO care_events (
            family_id, event_type, subject_type, child_id, event_date,
            time_type, event_time, time_period, memo, author_id
          ) VALUES (
            ${familyId}, ${input.eventType}, ${input.subjectType}, ${input.childId}, ${input.date},
            ${input.timeType}, ${input.time}, ${input.timePeriod}, ${input.memo}, ${authorization.userId}
          )
          RETURNING id, family_id
        )
        INSERT INTO milk_event_details (family_id, event_id, amount_ml)
        SELECT family_id, id, ${input.amountMl}
        FROM new_event
        RETURNING event_id AS id
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
      const input = validateEventInput(request.body)
      if (!input) {
        sendJson(response, 400, { error: '記録内容を正しく入力してください。' })
        return
      }
      if (input.childId) {
        const children = await getFixedChildren(sql, familyId)
        if (!children.some((child) => child.id === input.childId)) {
          sendJson(response, 400, { error: '対象の子どもを選択してください。' })
          return
        }
      }
      const rows = await sql`
        WITH updated_event AS (
          UPDATE care_events
          SET
            event_type = ${input.eventType},
            subject_type = ${input.subjectType},
            child_id = ${input.childId},
            event_date = ${input.date},
            time_type = ${input.timeType},
            event_time = ${input.time},
            time_period = ${input.timePeriod},
            memo = ${input.memo},
            updated_at = now()
          WHERE id = ${eventId}
            AND family_id = ${familyId}
            AND author_id = ${authorization.userId}
            AND deleted_at IS NULL
          RETURNING id, family_id
        )
        UPDATE milk_event_details md
        SET amount_ml = ${input.amountMl}
        FROM updated_event ue
        WHERE md.family_id = ue.family_id AND md.event_id = ue.id
        RETURNING md.event_id AS id
      `
      if (rows.length === 0) {
        sendJson(response, 403, { error: '投稿者本人だけが記録を編集できます。' })
        return
      }
      sendJson(response, 200, { id: rows[0].id })
      return
    }

    const rows = await sql`
      UPDATE care_events
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
    console.error('Care event operation failed', error)
    sendJson(response, 500, { error: 'ミルク記録の処理に失敗しました。' })
  }
}
