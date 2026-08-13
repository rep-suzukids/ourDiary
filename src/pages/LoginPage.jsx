import { GoogleLogin } from '@react-oauth/google'

function LoginPage({ error, onLoginSuccess, onLoginFailure }) {
  return (
    <main className="page">
      <h1 className="page__title">Our Diary</h1>
      <p className="page__subtitle">限られた人だけのプライベート空間</p>

      <section className="card" aria-labelledby="login-heading">
        <p id="login-heading" className="card__heading">
          Googleアカウントでサインイン
        </p>

        <GoogleLogin
          onSuccess={onLoginSuccess}
          onError={onLoginFailure}
          useOneTap={false}
        />

        {error && (
          <div className="error-box" role="alert">
            ⚠️ {error}
          </div>
        )}
      </section>
    </main>
  )
}

export default LoginPage
