import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

const TIME_TYPES = new Set(['exact', 'period', 'unknown'])
const TIME_PERIODS = new Set(['late_night', 'early_morning', 'morning', 'noon', 'evening', 'night'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_MEDICATION_NAME_LENGTH = 100

function sendJson(response, status, body) {
  response.status(status).json(body)
}

function requestUrl(request) {
  return new URL(request.url, 'http://localhost')
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

function uniqueUuidArray(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item) => typeof item === 'string' && UUID_PATTERN.test(item)))]
}

function uniqueWeekdays(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6))]
    .sort((left, right) => left - right)
}

function validateMedicationInput(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const childIds = uniqueUuidArray(body?.childIds)
  const weekdays = uniqueWeekdays(body?.weekdays)
  if (!name || [...name].length > MAX_MEDICATION_NAME_LENGTH || childIds.length === 0 || weekdays.length === 0) {
    return null
  }
  return { name, childIds, weekdays }
}

function validateAdministrationInput(body) {
  const medicationId = typeof body?.medicationId === 'string' ? body.medicationId : ''
  const scheduleId = typeof body?.scheduleId === 'string' ? body.scheduleId : ''
  const childId = typeof body?.childId === 'string' ? body.childId : ''
  const date = body?.date
  const timeType = typeof body?.timeType === 'string' ? body.timeType : ''
  const time = typeof body?.time === 'string' ? body.time : ''
  const timePeriod = typeof body?.timePeriod === 'string' ? body.timePeriod : ''
  const memo = typeof body?.memo === 'string' ? body.memo.trim() : ''

  if (!UUID_PATTERN.test(medicationId) || !UUID_PATTERN.test(scheduleId)
    || !UUID_PATTERN.test(childId) || !isValidDate(date)) return null
  if (!TIME_TYPES.has(timeType) || memo.length > 5000) return null
  if (timeType === 'exact' && !isValidTime(time)) return null
  if (timeType === 'period' && !TIME_PERIODS.has(timePeriod)) return null

  return {
    medicationId,
    scheduleId,
    childId,
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

async function getManagement(sql, familyId) {
  const [children, medications, targets, schedules] = await Promise.all([
    getFixedChildren(sql, familyId),
    sql`
      SELECT id, name, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM medications
      WHERE family_id = ${familyId}
      ORDER BY is_active DESC, created_at ASC, id ASC
    `,
    sql`
      SELECT medication_id AS "medicationId", child_id AS "childId"
      FROM medication_targets
      WHERE family_id = ${familyId} AND is_active = true
    `,
    sql`
      SELECT medication_id AS "medicationId", weekday
      FROM medication_schedules
      WHERE family_id = ${familyId}
        AND schedule_type = 'weekly'
        AND timing_code = 'anytime'
        AND is_active = true
      ORDER BY weekday
    `,
  ])
  return {
    children,
    medications: medications.map((medication) => ({
      ...medication,
      childIds: targets.filter((target) => target.medicationId === medication.id).map((target) => target.childId),
      weekdays: schedules.filter((schedule) => schedule.medicationId === medication.id).map((schedule) => schedule.weekday),
    })),
  }
}

async function getDueSchedules(sql, familyId, date) {
  return sql`
    SELECT
      m.id AS "medicationId",
      m.name AS "medicationName",
      ms.id AS "scheduleId",
      mt.child_id AS "childId",
      c.display_name AS "childName",
      EXISTS (
        SELECT 1
        FROM medication_administrations ma
        WHERE ma.family_id = ${familyId}
          AND ma.schedule_id = ms.id
          AND ma.child_id = mt.child_id
          AND ma.administered_date = ${date}
          AND ma.deleted_at IS NULL
      ) AS "isAdministered"
    FROM medications m
    INNER JOIN medication_targets mt
      ON mt.family_id = m.family_id AND mt.medication_id = m.id AND mt.is_active = true
    INNER JOIN children c
      ON c.family_id = mt.family_id AND c.id = mt.child_id AND c.archived_at IS NULL
    INNER JOIN medication_schedules ms
      ON ms.family_id = m.family_id AND ms.medication_id = m.id AND ms.is_active = true
    WHERE m.family_id = ${familyId}
      AND m.is_active = true
      AND ms.schedule_type = 'weekly'
      AND ms.weekday = EXTRACT(DOW FROM ${date}::date)::integer
    ORDER BY
      CASE c.display_name WHEN 'ともちゃん' THEN 1 WHEN 'ゆうちゃん' THEN 2 ELSE 3 END,
      m.created_at,
      m.id
  `
}

async function getAdministrations(sql, familyId, userId, date) {
  return sql`
    SELECT
      ma.id,
      ma.medication_id AS "medicationId",
      ma.schedule_id AS "scheduleId",
      ma.child_id AS "childId",
      c.display_name AS "childName",
      m.name AS "medicationName",
      to_char(ma.administered_date, 'YYYY-MM-DD') AS date,
      ma.time_type AS "timeType",
      CASE WHEN ma.administered_time IS NULL THEN NULL ELSE to_char(ma.administered_time, 'HH24:MI') END AS time,
      ma.time_period AS "timePeriod",
      ma.memo,
      ma.author_id AS "authorId",
      COALESCE(u.display_name, u.email::text) AS "authorName",
      ma.created_at AS "createdAt",
      ma.updated_at AS "updatedAt",
      (ma.author_id = ${userId}) AS "canEdit"
    FROM medication_administrations ma
    INNER JOIN medications m
      ON m.family_id = ma.family_id AND m.id = ma.medication_id
    INNER JOIN children c
      ON c.family_id = ma.family_id AND c.id = ma.child_id
    INNER JOIN users u ON u.id = ma.author_id
    WHERE ma.family_id = ${familyId}
      AND ma.administered_date = ${date}
      AND ma.deleted_at IS NULL
    ORDER BY
      CASE
        WHEN ma.time_type = 'exact' THEN
          EXTRACT(HOUR FROM ma.administered_time) * 60 + EXTRACT(MINUTE FROM ma.administered_time)
        WHEN ma.time_period = 'late_night' THEN 120
        WHEN ma.time_period = 'early_morning' THEN 330
        WHEN ma.time_period = 'morning' THEN 540
        WHEN ma.time_period = 'noon' THEN 780
        WHEN ma.time_period = 'evening' THEN 1020
        WHEN ma.time_period = 'night' THEN 1290
        ELSE 2000
      END,
      ma.created_at
  `
}

async function validateMedicationChildren(sql, familyId, childIds) {
  const children = await getFixedChildren(sql, familyId)
  return childIds.every((childId) => children.some((child) => child.id === childId))
}

async function createMedication(sql, familyId, userId, input) {
  const rows = await sql`
    WITH new_medication AS (
      INSERT INTO medications (family_id, name, created_by)
      VALUES (${familyId}, ${input.name}, ${userId})
      RETURNING id
    ), inserted_targets AS (
      INSERT INTO medication_targets (family_id, medication_id, child_id)
      SELECT ${familyId}, new_medication.id, selected.child_id
      FROM new_medication
      CROSS JOIN unnest(${input.childIds}::uuid[]) AS selected(child_id)
    ), inserted_schedules AS (
      INSERT INTO medication_schedules (family_id, medication_id, schedule_type, weekday, timing_code)
      SELECT ${familyId}, new_medication.id, 'weekly', selected.weekday, 'anytime'
      FROM new_medication
      CROSS JOIN unnest(${input.weekdays}::smallint[]) AS selected(weekday)
    )
    SELECT id FROM new_medication
  `
  return rows[0]
}

async function editMedication(sql, familyId, id, input) {
  const rows = await sql`
    WITH updated_medication AS (
      UPDATE medications
      SET name = ${input.name}, updated_at = now()
      WHERE family_id = ${familyId} AND id = ${id}
      RETURNING id
    ), updated_targets AS (
      UPDATE medication_targets
      SET
        is_active = child_id = ANY(${input.childIds}::uuid[]),
        updated_at = now()
      WHERE family_id = ${familyId}
        AND medication_id = (SELECT id FROM updated_medication)
    ), inserted_targets AS (
      INSERT INTO medication_targets (family_id, medication_id, child_id)
      SELECT ${familyId}, updated_medication.id, selected.child_id
      FROM updated_medication
      CROSS JOIN unnest(${input.childIds}::uuid[]) AS selected(child_id)
      ON CONFLICT (medication_id, child_id) DO NOTHING
    ), updated_schedules AS (
      UPDATE medication_schedules
      SET
        is_active = weekday = ANY(${input.weekdays}::smallint[]),
        updated_at = now()
      WHERE family_id = ${familyId}
        AND medication_id = (SELECT id FROM updated_medication)
        AND schedule_type = 'weekly'
        AND timing_code = 'anytime'
    ), inserted_schedules AS (
      INSERT INTO medication_schedules (family_id, medication_id, schedule_type, weekday, timing_code)
      SELECT ${familyId}, updated_medication.id, 'weekly', selected.weekday, 'anytime'
      FROM updated_medication
      CROSS JOIN unnest(${input.weekdays}::smallint[]) AS selected(weekday)
      ON CONFLICT (medication_id, schedule_type, weekday, timing_code) DO NOTHING
    )
    SELECT id FROM updated_medication
  `
  return rows[0]
}

async function validAdministrationTarget(sql, familyId, input, requireActive) {
  const rows = await sql`
    SELECT ms.id
    FROM medication_schedules ms
    INNER JOIN medications m
      ON m.family_id = ms.family_id AND m.id = ms.medication_id
    INNER JOIN medication_targets mt
      ON mt.family_id = m.family_id
      AND mt.medication_id = m.id
      AND mt.child_id = ${input.childId}
    WHERE ms.family_id = ${familyId}
      AND ms.id = ${input.scheduleId}
      AND ms.medication_id = ${input.medicationId}
      AND ms.schedule_type = 'weekly'
      AND ms.weekday = EXTRACT(DOW FROM ${input.date}::date)::integer
      AND (${requireActive} = false OR (m.is_active = true AND ms.is_active = true AND mt.is_active = true))
  `
  return rows.length > 0
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

  const url = requestUrl(request)
  const view = request.query?.view ?? url.searchParams.get('view') ?? 'day'
  const resource = request.body?.resource ?? 'medication'
  const permission = request.method === 'GET'
    ? view === 'management' ? 'medication:manage' : 'medication:read'
    : resource === 'medication' ? 'medication:manage' : 'medication:use'

  try {
    const authorization = await authorizeFamilyRequest(request, familyId, permission)
    const sql = getDatabase()

    if (request.method === 'GET') {
      if (view === 'management') {
        sendJson(response, 200, await getManagement(sql, familyId))
        return
      }
      const date = request.query?.date ?? url.searchParams.get('date')
      if (!isValidDate(date)) {
        sendJson(response, 400, { error: '表示する日付が正しくありません。' })
        return
      }
      const dueSchedules = await getDueSchedules(sql, familyId, date)
      if (view === 'status') {
        sendJson(response, 200, { outstanding: dueSchedules.filter((item) => !item.isAdministered) })
        return
      }
      if (view !== 'day') {
        sendJson(response, 400, { error: '表示方法が正しくありません。' })
        return
      }
      const [children, administrations] = await Promise.all([
        getFixedChildren(sql, familyId),
        getAdministrations(sql, familyId, authorization.userId, date),
      ])
      sendJson(response, 200, { children, dueSchedules, administrations })
      return
    }

    if (resource === 'medication') {
      if (!['POST', 'PATCH'].includes(request.method)) {
        sendJson(response, 405, { error: 'おくすり情報ではこの操作を利用できません。' })
        return
      }
      if (request.method === 'PATCH' && request.body?.action === 'setActive') {
        const id = typeof request.body?.id === 'string' ? request.body.id : ''
        if (!UUID_PATTERN.test(id) || typeof request.body?.isActive !== 'boolean') {
          sendJson(response, 400, { error: 'おくすりの状態が正しくありません。' })
          return
        }
        const rows = await sql`
          UPDATE medications
          SET is_active = ${request.body.isActive}, updated_at = now()
          WHERE family_id = ${familyId} AND id = ${id}
          RETURNING id, is_active AS "isActive"
        `
        if (rows.length === 0) {
          sendJson(response, 404, { error: 'おくすりが見つかりません。' })
          return
        }
        sendJson(response, 200, { medication: rows[0] })
        return
      }

      const input = validateMedicationInput(request.body)
      if (!input || !await validateMedicationChildren(sql, familyId, input.childIds)) {
        sendJson(response, 400, { error: 'おくすり名・対象児・曜日を正しく入力してください。' })
        return
      }
      if (request.method === 'POST') {
        const medication = await createMedication(sql, familyId, authorization.userId, input)
        sendJson(response, 201, { medication })
        return
      }
      const id = typeof request.body?.id === 'string' ? request.body.id : ''
      if (!UUID_PATTERN.test(id)) {
        sendJson(response, 400, { error: 'おくすりIDが正しくありません。' })
        return
      }
      const medication = await editMedication(sql, familyId, id, input)
      if (!medication) {
        sendJson(response, 404, { error: 'おくすりが見つかりません。' })
        return
      }
      sendJson(response, 200, { medication })
      return
    }

    if (resource !== 'administration') {
      sendJson(response, 400, { error: '操作対象が正しくありません。' })
      return
    }

    const administrationId = typeof request.body?.id === 'string' ? request.body.id : ''
    if (request.method === 'DELETE') {
      if (!UUID_PATTERN.test(administrationId)) {
        sendJson(response, 400, { error: '投薬記録IDが正しくありません。' })
        return
      }
      const rows = await sql`
        UPDATE medication_administrations
        SET deleted_at = now(), updated_at = now()
        WHERE family_id = ${familyId}
          AND id = ${administrationId}
          AND author_id = ${authorization.userId}
          AND deleted_at IS NULL
        RETURNING id
      `
      if (rows.length === 0) {
        sendJson(response, 403, { error: '登録者本人だけが投薬記録を削除できます。' })
        return
      }
      sendJson(response, 200, { id: rows[0].id })
      return
    }

    const input = validateAdministrationInput(request.body)
    if (!input || !await validAdministrationTarget(sql, familyId, input, request.method === 'POST')) {
      sendJson(response, 400, { error: '対象児・おくすり・日付・時間を正しく入力してください。' })
      return
    }

    if (request.method === 'POST') {
      const rows = await sql`
        INSERT INTO medication_administrations (
          family_id, medication_id, schedule_id, child_id, administered_date,
          time_type, administered_time, time_period, memo, author_id
        ) VALUES (
          ${familyId}, ${input.medicationId}, ${input.scheduleId}, ${input.childId}, ${input.date},
          ${input.timeType}, ${input.time}, ${input.timePeriod}, ${input.memo}, ${authorization.userId}
        )
        RETURNING id
      `
      sendJson(response, 201, { id: rows[0].id })
      return
    }

    if (!UUID_PATTERN.test(administrationId)) {
      sendJson(response, 400, { error: '投薬記録IDが正しくありません。' })
      return
    }
    const rows = await sql`
      UPDATE medication_administrations
      SET
        medication_id = ${input.medicationId},
        schedule_id = ${input.scheduleId},
        child_id = ${input.childId},
        administered_date = ${input.date},
        time_type = ${input.timeType},
        administered_time = ${input.time},
        time_period = ${input.timePeriod},
        memo = ${input.memo},
        updated_at = now()
      WHERE family_id = ${familyId}
        AND id = ${administrationId}
        AND author_id = ${authorization.userId}
        AND deleted_at IS NULL
      RETURNING id
    `
    if (rows.length === 0) {
      sendJson(response, 403, { error: '登録者本人だけが投薬記録を編集できます。' })
      return
    }
    sendJson(response, 200, { id: rows[0].id })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    if (error?.code === '23505') {
      sendJson(response, 409, { error: 'このおくすりはすでに投薬済みです。' })
      return
    }
    console.error('Medication operation failed', error)
    sendJson(response, 500, { error: 'おくすりの処理に失敗しました。' })
  }
}
