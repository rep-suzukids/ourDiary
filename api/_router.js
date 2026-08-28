import albumFilesHandler from './_handlers/album-files.js'
import authSessionHandler from './_handlers/auth-session.js'
import bowelEventsHandler from './_handlers/bowel-events.js'
import careEventsHandler from './_handlers/care-events.js'
import commentsHandler from './_handlers/comments.js'
import diaryEntriesHandler from './_handlers/diary-entries.js'
import driveAccessTokenHandler from './_handlers/drive-access-token.js'
import driveOwnerInvitationHandler from './_handlers/drive-owner-invitation.js'
import driveOwnerInvitationsHandler from './_handlers/drive-owner-invitations.js'
import driveOwnerOauthStartHandler from './_handlers/drive-owner-oauth-start.js'
import driveUserOauthStartHandler from './_handlers/drive-user-oauth-start.js'
import googleDriveCallbackHandler from './_handlers/google-drive-callback.js'
import photoFavoriteHandler from './_handlers/photo-favorite.js'
import photoTagsHandler from './_handlers/photo-tags.js'
import reactionsHandler from './_handlers/reactions.js'
import tagsHandler from './_handlers/tags.js'

const ROUTES = new Map([
  ['album-files', albumFilesHandler],
  ['auth-session', authSessionHandler],
  ['bowel-events', bowelEventsHandler],
  ['care-events', careEventsHandler],
  ['comments', commentsHandler],
  ['diary-entries', diaryEntriesHandler],
  ['drive-access-token', driveAccessTokenHandler],
  ['drive-owner-invitation', driveOwnerInvitationHandler],
  ['drive-owner-invitations', driveOwnerInvitationsHandler],
  ['drive-owner-oauth-start', driveOwnerOauthStartHandler],
  ['drive-user-oauth-start', driveUserOauthStartHandler],
  ['google-drive-callback', googleDriveCallbackHandler],
  ['photo-favorite', photoFavoriteHandler],
  ['photo-tags', photoTagsHandler],
  ['reactions', reactionsHandler],
  ['tags', tagsHandler],
])

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function routeFromRequest(request) {
  const url = new URL(request.url, 'http://localhost')
  const rewrittenPath = firstValue(request.query?.path) ?? url.searchParams.get('path')
  const route = rewrittenPath ?? url.pathname.replace(/^\/api\//, '')
  return typeof route === 'string' ? route.replace(/^\/+|\/+$/g, '') : ''
}

export function getApiRouteNames() {
  return [...ROUTES.keys()]
}

export default function dispatchApiRequest(request, response) {
  const route = routeFromRequest(request)
  const handler = ROUTES.get(route)

  if (!handler) {
    response.setHeader('Cache-Control', 'private, no-store')
    response.status(404).json({ error: 'APIが見つかりません。' })
    return
  }

  return handler(request, response)
}
