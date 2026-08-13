import { OAuth2Client } from 'google-auth-library'

const googleClient = new OAuth2Client()

export async function verifyGoogleCredential(credential) {
  const audience = process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID

  if (!audience) {
    throw new Error('GOOGLE_CLIENT_ID is not configured')
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience,
  })
  const payload = ticket.getPayload()

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new Error('The Google account could not be verified')
  }

  return {
    subject: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture ?? null,
  }
}
