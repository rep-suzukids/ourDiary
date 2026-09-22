import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function sendJson(response, status, body) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.status(status).json(body)
}

function isActualDate(value) {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function normalizeBirthDate(value) {
  if (value === null || value === '') return null
  return typeof value === 'string' && isActualDate(value) ? value : undefined
}

function currentDateInJapan() {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function listChildren(sql, familyId) {
  return sql`
    SELECT
      id,
      display_name AS name,
      to_char(birth_date, 'YYYY-MM-DD') AS "birthDate"
    FROM children
    WHERE family_id = ${familyId}
      AND archived_at IS NULL
      AND display_name IN ('ともちゃん', 'ゆうちゃん')
    ORDER BY CASE display_name WHEN 'ともちゃん' THEN 1 ELSE 2 END, created_at, id
  `
}

export default async function handler(request, response) {
  if (!['GET', 'PATCH'].includes(request.method)) {
    response.setHeader('Allow', 'GET, PATCH')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const familyId = request.headers['x-family-id']
  if (!UUID_PATTERN.test(familyId ?? '')) {
    sendJson(response, 400, { error: '家族の指定が正しくありません。' })
    return
  }

  try {
    await authorizeFamilyRequest(request, familyId, request.method === 'PATCH' ? 'care:manage' : null)
    const sql = getDatabase()

    if (request.method === 'GET') {
      sendJson(response, 200, { children: await listChildren(sql, familyId) })
      return
    }

    const children = await listChildren(sql, familyId)
    const requestedBirthdays = request.body?.birthdays
    if (!Array.isArray(requestedBirthdays) || requestedBirthdays.length !== children.length) {
      sendJson(response, 400, { error: '誕生日の指定が正しくありません。' })
      return
    }

    const allowedIds = new Set(children.map((child) => child.id))
    const normalized = requestedBirthdays.map((birthday) => ({
      childId: typeof birthday?.childId === 'string' ? birthday.childId : '',
      birthDate: normalizeBirthDate(birthday?.birthDate),
    }))
    const uniqueIds = new Set(normalized.map((birthday) => birthday.childId))
    if (
      normalized.some((birthday) => (
        !allowedIds.has(birthday.childId)
        || birthday.birthDate === undefined
        || (birthday.birthDate !== null && birthday.birthDate > currentDateInJapan())
      ))
      || uniqueIds.size !== children.length
    ) {
      sendJson(response, 400, { error: '誕生日の指定が正しくありません。' })
      return
    }

    const serializedBirthdays = JSON.stringify(normalized.map((birthday) => ({
      child_id: birthday.childId,
      birth_date: birthday.birthDate,
    })))
    await sql`
      UPDATE children child
      SET birth_date = birthday.birth_date::date, updated_at = now()
      FROM json_to_recordset(${serializedBirthdays}::json) AS birthday(child_id uuid, birth_date text)
      WHERE child.family_id = ${familyId}
        AND child.id = birthday.child_id
    `

    sendJson(response, 200, { children: await listChildren(sql, familyId) })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Child birthday operation failed', error)
    sendJson(response, 500, { error: '誕生日の処理に失敗しました。' })
  }
}
