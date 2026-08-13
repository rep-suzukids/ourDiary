import { useState } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import { createSession } from './services/authApi.js'
import './App.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function App() {
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const handleLoginSuccess = async (credentialResponse) => {
    if (!credentialResponse.credential) {
      setError('Google認証情報を取得できませんでした。')
      return
    }

    setIsAuthenticating(true)
    setError('')

    try {
      const authenticatedSession = await createSession(credentialResponse.credential)
      setSession(authenticatedSession)
    } catch (authenticationError) {
      setSession(null)
      setError(authenticationError.message)
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLoginFailure = () => {
    setError('Googleログインに失敗しました。再試行してください。')
  }

  const handleLogout = () => {
    setSession(null)
    setError('')
  }

  if (session) {
    return <HomePage session={session} onLogout={handleLogout} />
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LoginPage
        error={error}
        isAuthenticating={isAuthenticating}
        onLoginSuccess={handleLoginSuccess}
        onLoginFailure={handleLoginFailure}
      />
    </GoogleOAuthProvider>
  )
}

export default App
