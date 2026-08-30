import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'
import {
  GoogleDriveConfigurationError,
  GoogleDriveNotConnectedError,
  GoogleDriveRequestError,
  GoogleDriveServiceAccountAccessError,
  getFamilyDriveOwnerEmail,
  listGoogleDrivePhotos,
} from '../_lib/google-drive.js'

function sendJson(response, status, body) {
  response.status(status).json(body)
}

function normalizeCapturedOn(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})/.exec(value.trim())
  if (!match) return null

  const [, year, month, day] = match
  const candidate = new Date(`${year}-${month}-${day}T00:00:00Z`)
  if (
    Number.isNaN(candidate.getTime())
    || candidate.getUTCFullYear() !== Number(year)
    || candidate.getUTCMonth() + 1 !== Number(month)
    || candidate.getUTCDate() !== Number(day)
  ) return null

  return `${year}-${month}-${day}`
}

function normalizeCapturedAt(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim())
  if (!match || !normalizeCapturedOn(value)) return null

  const [, year, month, day, hour, minute, second = '00'] = match
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}

async function synchronizeDriveFiles(sql, familyId, drivePhotos) {
  const registeredFiles = await sql`
    SELECT google_drive_file_id
    FROM drive_album_files
    WHERE family_id = ${familyId}
  `
  const driveFileIds = new Set(drivePhotos.map((photo) => photo.id))
  const missingFileIds = registeredFiles
    .map((file) => file.google_drive_file_id)
    .filter((fileId) => !driveFileIds.has(fileId))

  if (missingFileIds.length > 0) {
    await sql`
      DELETE FROM drive_album_files
      WHERE family_id = ${familyId}
        AND google_drive_file_id IN (
          SELECT jsonb_array_elements_text(${JSON.stringify(missingFileIds)}::jsonb)
        )
    `
  }

  if (drivePhotos.length === 0) return
  const driveMetadata = drivePhotos.map((photo) => ({
    id: photo.id,
    captured_on: normalizeCapturedOn(photo.capturedTime),
    captured_at: normalizeCapturedAt(photo.capturedTime),
  }))
  await sql`
    UPDATE drive_album_files AS album_file
    SET
      captured_on = drive_file.captured_on,
      captured_at = drive_file.captured_at,
      updated_at = now()
    FROM jsonb_to_recordset(${JSON.stringify(driveMetadata)}::jsonb)
      AS drive_file(id text, captured_on date, captured_at timestamp without time zone)
    WHERE album_file.family_id = ${familyId}
      AND album_file.google_drive_file_id = drive_file.id
      AND (
        album_file.captured_on IS DISTINCT FROM drive_file.captured_on
        OR album_file.captured_at IS DISTINCT FROM drive_file.captured_at
      )
  `
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }
  const familyId = request.headers['x-family-id']
  if (!familyId) {
    sendJson(response, 400, { error: 'Family ID is required' })
    return
  }

  let authorization
  try {
    authorization = await authorizeFamilyRequest(
      request,
      familyId,
      request.method === 'POST' ? 'album:upload' : undefined,
    )
    const sql = getDatabase()
    const albums = await sql`
      SELECT id, title, google_drive_folder_id
      FROM drive_albums
      WHERE family_id = ${familyId}
      LIMIT 1
    `
    if (albums.length === 0) throw new GoogleDriveNotConnectedError()

    const album = albums[0]

    if (request.method === 'POST') {
      const submittedFiles = Array.isArray(request.body?.files)
        ? request.body.files
        : [request.body?.file]
      const files = submittedFiles.filter((file) => (
        file
        && typeof file.id === 'string'
        && file.id.length > 0
        && typeof file.name === 'string'
        && file.name.trim().length > 0
        && typeof file.mimeType === 'string'
        && file.mimeType.startsWith('image/')
      )).slice(0, 100)

      if (files.length === 0 || files.length !== submittedFiles.length) {
        sendJson(response, 400, { error: '登録する画像情報が正しくありません。' })
        return
      }

      for (const file of files) {
        const size = file.size && /^\d+$/.test(String(file.size)) ? String(file.size) : null
        const width = Number.isInteger(Number(file.width)) && Number(file.width) > 0 ? Number(file.width) : null
        const height = Number.isInteger(Number(file.height)) && Number(file.height) > 0 ? Number(file.height) : null
        const createdTime = file.createdTime && !Number.isNaN(Date.parse(file.createdTime))
          ? file.createdTime
          : null
        const capturedOn = normalizeCapturedOn(file.capturedTime)
        const capturedAt = normalizeCapturedAt(file.capturedTime)

        await sql`
          INSERT INTO drive_album_files (
            family_id, album_id, google_drive_file_id, name, mime_type,
            size_bytes, width, height, drive_created_at, captured_on, captured_at, created_by
          ) VALUES (
            ${familyId}, ${album.id}, ${file.id}, ${file.name.trim()}, ${file.mimeType},
            ${size}, ${width}, ${height}, ${createdTime}, ${capturedOn}, ${capturedAt}, ${authorization.userId}
          )
          ON CONFLICT (family_id, google_drive_file_id) DO UPDATE SET
            name = EXCLUDED.name,
            mime_type = EXCLUDED.mime_type,
            size_bytes = EXCLUDED.size_bytes,
            width = EXCLUDED.width,
            height = EXCLUDED.height,
            drive_created_at = COALESCE(EXCLUDED.drive_created_at, drive_album_files.drive_created_at),
            captured_on = EXCLUDED.captured_on,
            captured_at = EXCLUDED.captured_at,
            updated_at = now()
        `
      }

      const registered = await sql`
        SELECT
          daf.id AS "albumFileId",
          google_drive_file_id AS id,
          name,
          mime_type AS "mimeType",
          drive_created_at AS "createdTime",
          size_bytes AS size,
          width,
          height,
          captured_on AS "capturedOn",
          to_char(captured_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "capturedAt",
          is_published AS "isPublished",
          EXISTS (
            SELECT 1
            FROM photo_favorites favorite
            WHERE favorite.family_id = ${familyId}
              AND favorite.album_file_id = daf.id
              AND favorite.user_id = ${authorization.userId}
          ) AS "isFavorite",
          COALESCE((
            SELECT json_agg(daft.tag_id ORDER BY daft.created_at)
            FROM drive_album_file_tags daft
            WHERE daft.family_id = ${familyId} AND daft.album_file_id = daf.id
          ), '[]'::json) AS "tagIds"
        FROM drive_album_files daf
        WHERE daf.family_id = ${familyId}
        ORDER BY daf.drive_created_at DESC NULLS LAST, daf.created_at DESC
      `
      sendJson(response, 201, { photos: registered })
      return
    }

    const driveAlbum = await listGoogleDrivePhotos(familyId)
    await synchronizeDriveFiles(sql, familyId, driveAlbum.photos)

    const photos = await sql`
      SELECT
        daf.id AS "albumFileId",
        google_drive_file_id AS id,
        name,
        mime_type AS "mimeType",
        drive_created_at AS "createdTime",
        size_bytes AS size,
        width,
        height,
        captured_on AS "capturedOn",
        to_char(captured_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "capturedAt",
        is_published AS "isPublished",
        EXISTS (
          SELECT 1
          FROM photo_favorites favorite
          WHERE favorite.family_id = ${familyId}
            AND favorite.album_file_id = daf.id
            AND favorite.user_id = ${authorization.userId}
        ) AS "isFavorite",
        COALESCE((
          SELECT json_agg(daft.tag_id ORDER BY daft.created_at)
          FROM drive_album_file_tags daft
          WHERE daft.family_id = ${familyId} AND daft.album_file_id = daf.id
        ), '[]'::json) AS "tagIds"
      FROM drive_album_files daf
      WHERE daf.family_id = ${familyId}
        AND (${authorization.role} <> 'member' OR daf.is_published = true)
      ORDER BY daf.drive_created_at DESC NULLS LAST, daf.created_at DESC
    `
    response.setHeader('Cache-Control', 'private, no-store')
    sendJson(response, 200, {
      title: album.title,
      folderId: album.google_drive_folder_id,
      driveCredentialSource: 'service-account',
      photos,
    })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    if (error instanceof GoogleDriveNotConnectedError) {
      sendJson(response, error.status, { error: error.message, code: 'ALBUM_NOT_CONNECTED' })
      return
    }
    if (error instanceof GoogleDriveServiceAccountAccessError) {
      const ownerEmail = await getFamilyDriveOwnerEmail(familyId).catch(() => null)
      const canConfigure = Boolean(
        ownerEmail
        && authorization?.googleUser?.email
        && ownerEmail.toLowerCase() === authorization.googleUser.email.toLowerCase(),
      )
      sendJson(response, error.status, {
        error: canConfigure
          ? '写真閲覧用アカウントをGoogle Driveフォルダへ接続してください。'
          : `写真閲覧用の設定が必要です。アルバム所有者（${ownerEmail ?? '作成者'}）に設定を依頼してください。`,
        code: 'DRIVE_SERVICE_ACCOUNT_ACCESS_REQUIRED',
        canReconnect: canConfigure,
        ownerEmail,
      })
      return
    }
    if (error instanceof GoogleDriveConfigurationError) {
      console.error('Google Drive service account configuration failed', error.message)
      sendJson(response, 503, {
        error: '写真閲覧用のGoogle Drive設定が完了していません。管理者に確認してください。',
        code: 'DRIVE_SERVICE_ACCOUNT_NOT_CONFIGURED',
      })
      return
    }
    if (error instanceof GoogleDriveRequestError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Drive album list failed', error)
    sendJson(response, 502, { error: 'アルバムを読み込めませんでした。' })
  }
}
