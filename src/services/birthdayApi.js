async function readResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? '誕生日の処理に失敗しました。')
  return body
}

export async function getChildBirthdays(familyId) {
  const response = await fetch('/api/child-birthdays', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'x-family-id': familyId },
  })
  return readResponse(response)
}

export async function updateChildBirthdays(familyId, birthdays) {
  const response = await fetch('/api/child-birthdays', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'x-family-id': familyId,
    },
    body: JSON.stringify({ birthdays }),
  })
  return readResponse(response)
}
