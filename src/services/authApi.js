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
