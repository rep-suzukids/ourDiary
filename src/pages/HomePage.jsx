import LegalFooter from '../components/LegalFooter.jsx'
import { DiaperIcon, ThermometerIcon } from '../components/CareEventIcons.jsx'

const ROLE_LABELS = {
  member: 'メンバー',
  parent: '両親',
  admin: '管理者',
}

function AlbumIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="6" y="9" width="36" height="30" rx="5" />
      <circle cx="17" cy="19" r="3" />
      <path d="m10 34 9-9 6 6 5-5 8 8" />
    </svg>
  )
}

function DiaryIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 10a5 5 0 0 1 5-5h11v35H13a5 5 0 0 0-5 3V10Z" />
      <path d="M40 10a5 5 0 0 0-5-5H24v35h11a5 5 0 0 1 5 3V10ZM13 14h6M13 21h6M29 14h6M29 21h6" />
    </svg>
  )
}

function MilkIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M18 5h12v6l4 5v23a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V16l4-5V5Z" />
      <path d="M17 20h14M17 27h9M17 34h14" />
    </svg>
  )
}

function TimelineIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M17 7v34M17 14h17M17 24h13M17 34h17" />
      <circle cx="17" cy="14" r="3" />
      <circle cx="17" cy="24" r="3" />
      <circle cx="17" cy="34" r="3" />
    </svg>
  )
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="7" y="10" width="34" height="31" rx="5" />
      <path d="M15 6v8M33 6v8M7 19h34" />
      <path d="M24 25v7M24 36v.5" />
    </svg>
  )
}

function HomePage({ session, onLogout, onNavigate }) {
  const activeFamily = session.families[0]

  const openAlbum = (event) => {
    event.preventDefault()
    onNavigate('/album')
  }

  return (
    <main className="page">
      <h1 className="page__title">Our Diary</h1>

      <section className="card" aria-labelledby="welcome-heading">
        {session.user.picture && (
          <img
            className="profile-avatar"
            src={session.user.picture}
            alt="プロフィール"
            referrerPolicy="no-referrer"
          />
        )}
        <p id="welcome-heading" className="welcome-text">
          ようこそ、{session.user.name} さん
        </p>
        <div className={`role-badge role-badge--${activeFamily.role}`}>
          {ROLE_LABELS[activeFamily.role] ?? activeFamily.role}
        </div>
        <p className="info-text">
          {activeFamily.name}のプライベート空間に安全に接続されています。
        </p>

        <a className="album-link home-nav-link" href="/album" onClick={openAlbum}>
          <AlbumIcon />
          <span>アルバム</span>
        </a>

        {['parent', 'admin'].includes(activeFamily.role) && (
          <>
            <a
              className="album-link home-nav-link home-diary-link"
              href="/diary"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/diary')
              }}
            >
              <DiaryIcon />
              <span>日記</span>
            </a>
            <a
              className="album-link home-nav-link home-schedule-link"
              href="/schedule"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/schedule')
              }}
            >
              <ScheduleIcon />
              <span>予定</span>
            </a>
            <a
              className="album-link home-nav-link home-timeline-link"
              href="/timeline"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/timeline')
              }}
            >
              <TimelineIcon />
              <span>タイムライン</span>
            </a>
            <a
              className="album-link home-nav-link home-milk-link"
              href="/milk/calendar"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/milk/calendar')
              }}
            >
              <MilkIcon />
              <span>ミルク</span>
            </a>
            <a
              className="album-link home-nav-link home-poop-link"
              href="/poop/calendar"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/poop/calendar')
              }}
            >
              <DiaperIcon />
              <span>おむつ</span>
            </a>
            <a
              className="album-link home-nav-link home-temperature-link"
              href="/temperature/calendar"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/temperature/calendar')
              }}
            >
              <ThermometerIcon />
              <span>体温</span>
            </a>
          </>
        )}

        {activeFamily.role === 'admin' && (
          <div className="admin-settings-links" aria-label="管理者メニュー">
            <a
              className="album-settings-link"
              href="/album/setup"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/album/setup')
              }}
            >
              Google Driveアルバム設定
            </a>
            <a
              className="album-settings-link"
              href="/admin/tags"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/admin/tags')
              }}
            >
              タグ管理
            </a>
          </div>
        )}

        <button className="logout-button" type="button" onClick={onLogout}>
          ログアウト
        </button>
      </section>

      <LegalFooter onNavigate={onNavigate} />
    </main>
  )
}

export default HomePage
