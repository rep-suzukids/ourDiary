import { useState } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import './App.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

const ALLOWED_USERS = import.meta.env.VITE_ALLOWED_USERS
  ? import.meta.env.VITE_ALLOWED_USERS.split(',').map((email) => email.trim())
  : []

function App() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  const handleLoginSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential)

      if (ALLOWED_USERS.includes(decoded.email)) {
        setUser(decoded)
        setError('')
        return
      }

      setUser(null)
      setError('アクセス権限がありません。このアプリは限定されたユーザー専用です。')
    } catch {
      setError('認証エラーが発生しました。')
    }
  }

  const handleLoginFailure = () => {
    setError('Googleログインに失敗しました。再試行してください。')
  }

  const handleLogout = () => {
    setUser(null)
    setError('')
  }

  if (user) {
    return <HomePage user={user} onLogout={handleLogout} />
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LoginPage
        error={error}
        onLoginSuccess={handleLoginSuccess}
        onLoginFailure={handleLoginFailure}
      />
    </GoogleOAuthProvider>
  )
}

export default App
