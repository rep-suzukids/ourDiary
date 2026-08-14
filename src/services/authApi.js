const SESSION_CREDENTIAL_KEY = 'ourdiary-google-credential'

export async function createSession(credential) {
  const response = await fetch('/api/auth-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ credential }),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error ?? 'ログイン処理に失敗しました。')
  }

  return data
}

export function loadSessionCredential() {
  return sessionStorage.getItem(SESSION_CREDENTIAL_KEY) ?? ''
}

export function saveSessionCredential(credential) {
  sessionStorage.setItem(SESSION_CREDENTIAL_KEY, credential)
}

export function clearSessionCredential() {
  sessionStorage.removeItem(SESSION_CREDENTIAL_KEY)
}
