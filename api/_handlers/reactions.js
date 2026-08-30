import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'

const TARGET_TYPES = new Set(['diary', 'photo', 'comment'])
const REACTION_KEY_PATTERN = /^reaction-(0[1-9]|1[0-9]|20)$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sendJson(response, status, body) {
  response.status(status).json(body)
}

function targetFrom(request) {
  const url = new URL(request.url, 'http://localhost')
  const targetType = request.body?.targetType ?? request.query?.targetType ?? url.searchParams.get('targetType')
  const targetId = request.body?.targetId ?? request.query?.targetId ?? url.searchParams.get('targetId')
  if (!TARGET_TYPES.has(targetType) || !UUID_PATTERN.test(targetId ?? '')) return null
  return { targetType, targetId }
}

async function targetExists(sql, familyId, target, role) {
  if (target.targetType === 'diary') {
    const rows = await sql`
      SELECT id FROM diary_entries
      WHERE id = ${target.targetId} AND family_id = ${familyId}
        AND entry_type = 'note' AND deleted_at IS NULL
      LIMIT 1
    `
    return rows.length > 0
  }
  if (target.targetType === 'photo') {
    const rows = await sql`
      SELECT id FROM drive_album_files
      WHERE id = ${target.targetId} AND family_id = ${familyId}
        AND (${role} <> 'member' OR is_published = true)
      LIMIT 1
    `
    return rows.length > 0
  }
  const rows = await sql`
    SELECT cmt.id
    FROM comments cmt
    LEFT JOIN drive_album_files album_file ON album_file.id = cmt.album_file_id
    WHERE cmt.id = ${target.targetId} AND cmt.family_id = ${familyId}
      AND (
        cmt.album_file_id IS NULL
        OR ${role} <> 'member'
        OR album_file.is_published = true
      )
    LIMIT 1
  `
  return rows.length > 0
}

async function targetDomain(sql, familyId, target) {
  if (target.targetType !== 'comment') return target.targetType
  const rows = await sql`
    SELECT CASE WHEN album_file_id IS NOT NULL THEN 'photo' ELSE 'diary' END AS domain
    FROM comments
    WHERE id = ${target.targetId} AND family_id = ${familyId}
    LIMIT 1
  `
  return rows[0]?.domain ?? null
}

function assertReactionPermission(authorization, method, domain) {
  const action = method === 'GET' ? 'read' : 'use'
  const prefix = domain === 'photo' ? 'photo:reaction' : 'reaction'
  if (!authorization.permissions.includes(`${prefix}:${action}`)) {
    throw new AuthorizationError('この操作を行う権限がありません。')
  }
}

async function listReactions(sql, familyId, userId, target) {
  const rows = await sql`
    SELECT
      reaction.reaction_key AS "reactionKey",
      reaction.user_id AS "userId",
      COALESCE(person.display_name, person.email::text) AS "userName",
      (reaction.user_id = ${userId}) AS "reactedByMe"
    FROM reactions reaction
    INNER JOIN users person ON person.id = reaction.user_id
    WHERE reaction.family_id = ${familyId}
      AND (
        (${target.targetType} = 'diary' AND reaction.diary_entry_id = ${target.targetId})
        OR (${target.targetType} = 'photo' AND reaction.album_file_id = ${target.targetId})
        OR (${target.targetType} = 'comment' AND reaction.comment_id = ${target.targetId})
      )
    ORDER BY reaction.created_at ASC
  `
  const grouped = new Map()
  for (const row of rows) {
    if (!grouped.has(row.reactionKey)) {
      grouped.set(row.reactionKey, {
        reactionKey: row.reactionKey,
        count: 0,
        reactedByMe: false,
        reactors: [],
      })
    }
    const group = grouped.get(row.reactionKey)
    group.count += 1
    group.reactedByMe ||= row.reactedByMe
    group.reactors.push({ userId: row.userId, name: row.userName })
  }
  return [...grouped.values()]
}

async function getRecentReactionKeys(sql, familyId, userId) {
  const rows = await sql`
    SELECT reaction_key AS "reactionKey"
    FROM reaction_usage_history
    WHERE family_id = ${familyId} AND user_id = ${userId}
    ORDER BY last_used_at DESC, reaction_key ASC
  `
  return rows.map((row) => row.reactionKey)
}

async function toggleDiaryReaction(sql, familyId, userId, targetId, reactionKey) {
  return sql`
    WITH removed AS (
      DELETE FROM reactions
      WHERE family_id = ${familyId} AND diary_entry_id = ${targetId}
        AND user_id = ${userId} AND reaction_key = ${reactionKey}
      RETURNING id
    ), inserted AS (
      INSERT INTO reactions (family_id, reaction_key, user_id, diary_entry_id)
      SELECT ${familyId}, ${reactionKey}, ${userId}, ${targetId}
      WHERE NOT EXISTS (SELECT 1 FROM removed)
      ON CONFLICT (family_id, diary_entry_id, user_id, reaction_key)
        WHERE diary_entry_id IS NOT NULL DO NOTHING
      RETURNING id
    ), usage AS (
      INSERT INTO reaction_usage_history (family_id, user_id, reaction_key)
      SELECT ${familyId}, ${userId}, ${reactionKey} FROM inserted
      ON CONFLICT (family_id, user_id, reaction_key) DO UPDATE
      SET last_used_at = now(), use_count = reaction_usage_history.use_count + 1
      RETURNING reaction_key
    )
    SELECT EXISTS (SELECT 1 FROM inserted) AS active
  `
}

async function togglePhotoReaction(sql, familyId, userId, targetId, reactionKey) {
  return sql`
    WITH removed AS (
      DELETE FROM reactions
      WHERE family_id = ${familyId} AND album_file_id = ${targetId}
        AND user_id = ${userId} AND reaction_key = ${reactionKey}
      RETURNING id
    ), inserted AS (
      INSERT INTO reactions (family_id, reaction_key, user_id, album_file_id)
      SELECT ${familyId}, ${reactionKey}, ${userId}, ${targetId}
      WHERE NOT EXISTS (SELECT 1 FROM removed)
      ON CONFLICT (family_id, album_file_id, user_id, reaction_key)
        WHERE album_file_id IS NOT NULL DO NOTHING
      RETURNING id
    ), usage AS (
      INSERT INTO reaction_usage_history (family_id, user_id, reaction_key)
      SELECT ${familyId}, ${userId}, ${reactionKey} FROM inserted
      ON CONFLICT (family_id, user_id, reaction_key) DO UPDATE
      SET last_used_at = now(), use_count = reaction_usage_history.use_count + 1
      RETURNING reaction_key
    )
    SELECT EXISTS (SELECT 1 FROM inserted) AS active
  `
}

async function toggleCommentReaction(sql, familyId, userId, targetId, reactionKey) {
  return sql`
    WITH removed AS (
      DELETE FROM reactions
      WHERE family_id = ${familyId} AND comment_id = ${targetId}
        AND user_id = ${userId} AND reaction_key = ${reactionKey}
      RETURNING id
    ), inserted AS (
      INSERT INTO reactions (family_id, reaction_key, user_id, comment_id)
      SELECT ${familyId}, ${reactionKey}, ${userId}, ${targetId}
      WHERE NOT EXISTS (SELECT 1 FROM removed)
      ON CONFLICT (family_id, comment_id, user_id, reaction_key)
        WHERE comment_id IS NOT NULL DO NOTHING
      RETURNING id
    ), usage AS (
      INSERT INTO reaction_usage_history (family_id, user_id, reaction_key)
      SELECT ${familyId}, ${userId}, ${reactionKey} FROM inserted
      ON CONFLICT (family_id, user_id, reaction_key) DO UPDATE
      SET last_used_at = now(), use_count = reaction_usage_history.use_count + 1
      RETURNING reaction_key
    )
    SELECT EXISTS (SELECT 1 FROM inserted) AS active
  `
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST')
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
    const target = targetFrom(request)
    if (!target) {
      sendJson(response, 400, { error: 'リアクション対象の指定が正しくありません。' })
      return
    }
    const sql = getDatabase()
    if (!await targetExists(sql, familyId, target, authorization.role)) {
      sendJson(response, 404, { error: 'リアクション対象が見つかりません。' })
      return
    }
    const domain = await targetDomain(sql, familyId, target)
    assertReactionPermission(authorization, request.method, domain)

    if (request.method === 'POST') {
      const reactionKey = request.body?.reactionKey
      if (!REACTION_KEY_PATTERN.test(reactionKey ?? '')) {
        sendJson(response, 400, { error: 'リアクションの指定が正しくありません。' })
        return
      }
      const togglers = {
        diary: toggleDiaryReaction,
        photo: togglePhotoReaction,
        comment: toggleCommentReaction,
      }
      await togglers[target.targetType](sql, familyId, authorization.userId, target.targetId, reactionKey)
    }

    const [reactions, recentReactionKeys] = await Promise.all([
      listReactions(sql, familyId, authorization.userId, target),
      getRecentReactionKeys(sql, familyId, authorization.userId),
    ])
    sendJson(response, 200, { reactions, recentReactionKeys })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Reaction operation failed', error)
    sendJson(response, 500, { error: 'リアクションの処理に失敗しました。' })
  }
}
