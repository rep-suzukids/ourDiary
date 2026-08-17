async function readSessionResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error ?? 'ログイン処理に失敗しました。')
    error.status = response.status
    throw error
  }
  return data
}

export async function createSession(credential) {
  const response = await fetch('/api/auth-session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  return readSessionResponse(response)
}

export async function restoreSession() {
  const response = await fetch('/api/auth-session', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  return readSessionResponse(response)
}

export async function deleteSession() {
  const response = await fetch('/api/auth-session', {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!response.ok && response.status !== 401) {
    throw new Error('ログアウト処理に失敗しました。')
  }
}

export function clearLegacySessionStorage() {
  sessionStorage.removeItem('ourdiary-google-credential')
  sessionStorage.removeItem('ourdiary-drive-access')
  sessionStorage.removeItem('ourdiary-drive-read')
  sessionStorage.removeItem('ourdiary-drive-write')
}
