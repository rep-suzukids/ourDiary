import { useEffect, useState } from 'react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import AlbumPage from './pages/AlbumPage.jsx'
import AlbumSetupPage from './pages/AlbumSetupPage.jsx'
import AlbumUploadPage from './pages/AlbumUploadPage.jsx'
import DriveOwnerCompletePage from './pages/DriveOwnerCompletePage.jsx'
import DriveOwnerConnectPage from './pages/DriveOwnerConnectPage.jsx'
import DiaryCreatePage from './pages/DiaryCreatePage.jsx'
import DiaryPage from './pages/DiaryPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import MilkFormPage from './pages/MilkFormPage.jsx'
import MilkCalendarPage from './pages/MilkCalendarPage.jsx'
import MilkPage from './pages/MilkPage.jsx'
import PoopCalendarPage from './pages/PoopCalendarPage.jsx'
import PoopFormPage from './pages/PoopFormPage.jsx'
import PoopPage from './pages/PoopPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx'
import ScheduleCreatePage from './pages/ScheduleCreatePage.jsx'
import SchedulePage from './pages/SchedulePage.jsx'
import TagManagementPage from './pages/TagManagementPage.jsx'
import TermsOfServicePage from './pages/TermsOfServicePage.jsx'
import TimelinePage from './pages/TimelinePage.jsx'
import TimelineNoteFormPage from './pages/TimelineNoteFormPage.jsx'
import TemperatureCalendarPage from './pages/TemperatureCalendarPage.jsx'
import TemperatureFormPage from './pages/TemperatureFormPage.jsx'
import TemperaturePage from './pages/TemperaturePage.jsx'
import {
  clearLegacySessionStorage,
  createSession,
  deleteSession,
  restoreSession,
} from './services/authApi.js'
import './App.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function SessionLoadingPage() {
  return (
    <main className="page">
      <h1 className="page__title page__title--small">Our Diary</h1>
      <section className="card">
        <p className="info-text">ログイン状態を確認しています…</p>
      </section>
    </main>
  )
}

function AppContent() {
  const [session, setSession] = useState(null)
  const [pathname, setPathname] = useState(window.location.pathname)
  const [error, setError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  useEffect(() => {
    clearLegacySessionStorage()
    let isActive = true
    restoreSession()
      .then((authenticatedSession) => {
        if (isActive) setSession(authenticatedSession)
      })
      .catch(() => {})
      .finally(() => {
        if (isActive) setIsRestoringSession(false)
      })

    return () => { isActive = false }
  }, [])

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (path, options = {}) => {
    const historyMethod = options.replace ? 'replaceState' : 'pushState'
    window.history[historyMethod]({}, '', path)
    setPathname(new URL(path, window.location.origin).pathname)
  }

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
      navigate('/')
    } catch (authenticationError) {
      setSession(null)
      setError(authenticationError.message)
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLogout = async () => {
    try {
      await deleteSession()
    } catch (logoutError) {
      console.error(logoutError)
    }
    setSession(null)
    setError('')
    navigate('/')
  }

  if (pathname === '/drive-owner-connect') return <DriveOwnerConnectPage />
  if (pathname === '/drive-owner-connect/complete') return <DriveOwnerCompletePage />

  // OAuth審査と利用者への事前説明のため、法務ページはログイン不要で公開します。
  if (pathname === '/privacy-policy') return <PrivacyPolicyPage onNavigate={navigate} />
  if (pathname === '/terms-of-service') return <TermsOfServicePage onNavigate={navigate} />

  if (isRestoringSession) return <SessionLoadingPage />

  if (pathname === '/album') {
    if (!session) return <NotFoundPage onNavigate={navigate} />
    return <AlbumPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/album/setup') {
    if (!session || session.families[0]?.role !== 'admin') {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <AlbumSetupPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/album/upload') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <AlbumUploadPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/admin/tags') {
    if (!session || session.families[0]?.role !== 'admin') {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <TagManagementPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/diary') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <DiaryPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/diary/new') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <DiaryCreatePage session={session} onNavigate={navigate} />
  }

  if (pathname === '/schedule') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <SchedulePage session={session} onNavigate={navigate} />
  }

  if (pathname === '/schedule/new') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <ScheduleCreatePage session={session} onNavigate={navigate} />
  }

  if (pathname === '/timeline') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <TimelinePage session={session} onNavigate={navigate} />
  }

  if (pathname === '/timeline/note/new') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <TimelineNoteFormPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/timeline/note/edit') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <TimelineNoteFormPage session={session} onNavigate={navigate} mode="edit" />
  }

  if (pathname === '/milk') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <MilkPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/milk/calendar') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <MilkCalendarPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/milk/new') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <MilkFormPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/milk/edit') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <MilkFormPage session={session} onNavigate={navigate} mode="edit" />
  }

  if (pathname === '/poop') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <PoopPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/poop/calendar') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <PoopCalendarPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/poop/new') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <PoopFormPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/poop/edit') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <PoopFormPage session={session} onNavigate={navigate} mode="edit" />
  }

  if (pathname === '/temperature') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <TemperaturePage session={session} onNavigate={navigate} />
  }

  if (pathname === '/temperature/calendar') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <TemperatureCalendarPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/temperature/new') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <TemperatureFormPage session={session} onNavigate={navigate} />
  }

  if (pathname === '/temperature/edit') {
    if (!session || !['parent', 'admin'].includes(session.families[0]?.role)) {
      return <NotFoundPage onNavigate={navigate} />
    }
    return <TemperatureFormPage session={session} onNavigate={navigate} mode="edit" />
  }

  if (pathname !== '/') return <NotFoundPage onNavigate={navigate} />

  if (session) {
    return <HomePage session={session} onLogout={handleLogout} onNavigate={navigate} />
  }

  return <LoginPage
    error={error}
    isAuthenticating={isAuthenticating}
    onNavigate={navigate}
    onLoginSuccess={handleLoginSuccess}
    onLoginFailure={() => setError('Googleログインに失敗しました。再試行してください。')}
  />
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AppContent />
    </GoogleOAuthProvider>
  )
}

export default App
