const STATUS_MESSAGES = {
  success: {
    title: 'アルバムを作成しました',
    message: 'Google Driveとの連携が完了しました。この画面を閉じて、招待した方へ完了したことをお伝えください。',
  },
  reconnected: {
    title: 'Google Drive連携を更新しました',
    message: '認証を更新しました。アルバムの写真を再び表示・追加できます。この画面は閉じて構いません。',
  },
  email_mismatch: {
    title: 'Googleアカウントが一致しません',
    message: '招待されたメールアドレスのGoogleアカウントを選択して、招待URLからもう一度お試しください。',
  },
  expired: {
    title: '招待URLの期限が切れています',
    message: 'Our Diaryの管理者に、新しい招待URLの発行を依頼してください。',
  },
  already_connected: {
    title: 'アルバムは作成済みです',
    message: 'この家族には、すでにGoogle Driveアルバムが設定されています。',
  },
  invalid_request: {
    title: '連携を完了できませんでした',
    message: '招待URLからもう一度お試しください。',
  },
  failed: {
    title: '連携に失敗しました',
    message: '時間をおいて再試行するか、Our Diaryの管理者へご連絡ください。',
  },
}

function DriveOwnerCompletePage() {
  const status = new URLSearchParams(window.location.search).get('status') ?? 'failed'
  const result = STATUS_MESSAGES[status] ?? STATUS_MESSAGES.failed
  return (
    <main className="page">
      <h1 className="page__title page__title--small">Our Diary</h1>
      <section className="card owner-connect-card">
        <h2>{result.title}</h2>
        <p className="info-text">{result.message}</p>
      </section>
    </main>
  )
}

export default DriveOwnerCompletePage
