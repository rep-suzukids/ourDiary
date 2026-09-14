import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SEARCH_LIMIT = 30
const MAX_QUERY_LENGTH = 100
const SNIPPET_LENGTH = 90
const SNIPPET_CONTEXT_BEFORE = 32

function sendJson(response, status, body) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.status(status).json(body)
}

function buildSnippet(textValue, query) {
  const text = String(textValue ?? '')
  const matchIndex = text.toLocaleLowerCase('ja-JP').indexOf(query.toLocaleLowerCase('ja-JP'))
  if (matchIndex < 0) return text

  const characters = Array.from(text)
  const matchCharacterIndex = Array.from(text.slice(0, matchIndex)).length
  const matchLength = Array.from(text.slice(matchIndex, matchIndex + query.length)).length
  const minimumEnd = matchCharacterIndex + Math.max(matchLength, 1)
  let start = Math.max(0, matchCharacterIndex - SNIPPET_CONTEXT_BEFORE)
  let end = Math.min(characters.length, Math.max(start + SNIPPET_LENGTH, minimumEnd))

  if (end === characters.length) start = Math.max(0, end - SNIPPET_LENGTH)
  if (minimumEnd > end) end = Math.min(characters.length, minimumEnd)

  return `${start > 0 ? '…' : ''}${characters.slice(start, end).join('')}${end < characters.length ? '…' : ''}`
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const familyId = request.headers['x-family-id']
  if (!UUID_PATTERN.test(familyId ?? '')) {
    sendJson(response, 400, { error: '家族の指定が正しくありません。' })
    return
  }

  const url = new URL(request.url, 'http://localhost')
  const scope = request.query?.scope ?? url.searchParams.get('scope') ?? 'diary'
  const query = String(request.query?.q ?? url.searchParams.get('q') ?? '').trim()
  const offset = Number(request.query?.offset ?? url.searchParams.get('offset') ?? 0)
  if (scope !== 'diary') {
    sendJson(response, 400, { error: '検索対象が正しくありません。' })
    return
  }
  if (!query || query.length > MAX_QUERY_LENGTH) {
    sendJson(response, 400, { error: `検索語は1文字以上${MAX_QUERY_LENGTH}文字以内で入力してください。` })
    return
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000) {
    sendJson(response, 400, { error: '検索位置が正しくありません。' })
    return
  }

  try {
    await authorizeFamilyRequest(request, familyId, 'entry:read_shared')
    const sql = getDatabase()
    const rows = await sql`
      WITH matches AS (
        SELECT
          de.id,
          'diary'::text AS type,
          de.id AS entry_id,
          de.subject_type,
          de.child_id,
          CASE de.subject_type
            WHEN 'father' THEN 'お父さん'
            WHEN 'mother' THEN 'ママ'
            ELSE child.display_name
          END AS subject_name,
          to_char(de.diary_date, 'YYYY-MM-DD') AS date,
          de.body AS matched_text,
          COALESCE(author.display_name, author.email::text) AS author_name,
          de.updated_at
        FROM diary_entries de
        LEFT JOIN children child ON child.id = de.child_id AND child.family_id = de.family_id
        INNER JOIN users author ON author.id = de.author_id
        WHERE de.family_id = ${familyId}
          AND de.entry_type = 'note'
          AND de.deleted_at IS NULL
          AND strpos(lower(de.body), lower(${query})) > 0

        UNION ALL

        SELECT
          cmt.id,
          'comment'::text AS type,
          de.id AS entry_id,
          de.subject_type,
          de.child_id,
          CASE de.subject_type
            WHEN 'father' THEN 'お父さん'
            WHEN 'mother' THEN 'ママ'
            ELSE child.display_name
          END AS subject_name,
          to_char(de.diary_date, 'YYYY-MM-DD') AS date,
          cmt.body AS matched_text,
          COALESCE(author.display_name, author.email::text) AS author_name,
          cmt.updated_at
        FROM comments cmt
        INNER JOIN diary_entries de
          ON de.id = cmt.diary_entry_id
          AND de.family_id = cmt.family_id
          AND de.entry_type = 'note'
          AND de.deleted_at IS NULL
        LEFT JOIN children child ON child.id = de.child_id AND child.family_id = de.family_id
        INNER JOIN users author ON author.id = cmt.author_id
        WHERE cmt.family_id = ${familyId}
          AND strpos(lower(cmt.body), lower(${query})) > 0
      )
      SELECT
        id,
        type,
        entry_id AS "entryId",
        subject_type AS "subjectType",
        child_id AS "childId",
        subject_name AS "subjectName",
        date,
        matched_text AS text,
        author_name AS "authorName",
        updated_at AS "updatedAt",
        COUNT(*) OVER()::integer AS "totalCount"
      FROM matches
      ORDER BY date DESC, updated_at DESC, id
      LIMIT ${SEARCH_LIMIT}
      OFFSET ${offset}
    `

    const total = rows[0]?.totalCount ?? 0
    const results = rows.map(({ text, totalCount: _totalCount, ...row }) => ({
      ...row,
      snippet: buildSnippet(text, query),
    }))
    sendJson(response, 200, {
      query,
      scope,
      results,
      total,
      hasMore: offset + results.length < total,
    })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Search operation failed', error)
    sendJson(response, 500, { error: '検索処理に失敗しました。' })
  }
}
