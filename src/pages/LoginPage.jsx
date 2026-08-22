import { GoogleLogin } from '@react-oauth/google'
import LegalFooter from '../components/LegalFooter.jsx'

function LoginPage({ error, isAuthenticating, onLoginSuccess, onLoginFailure, onNavigate }) {
  return (
    <main className="page">
      <h1 className="page__title">Our Diary</h1>
      <p className="page__subtitle">限られた人だけのプライベート空間</p>

      <p className="service-description">
        Our Diaryは、家族で子どもの写真や日記、ミルクの記録を共有し、
        日々の成長を大切に残すための招待制アプリです。
      </p>

      <section className="card" aria-labelledby="login-heading">
        <p id="login-heading" className="card__heading">
          Googleアカウントでサインイン
        </p>

        <GoogleLogin
          onSuccess={onLoginSuccess}
          onError={onLoginFailure}
          useOneTap={false}
        />

        {isAuthenticating && (
          <p className="status-message" role="status">
            アカウントと権限を確認しています…
          </p>
        )}

        {error && (
          <div className="error-box" role="alert">
            ⚠️ {error}
          </div>
        )}
      </section>

      <LegalFooter onNavigate={onNavigate} />
    </main>
  )
}

export default LoginPage
