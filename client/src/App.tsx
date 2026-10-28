import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import AuthPage from './pages/Auth'
import Home from './pages/Home'
import Discography from './pages/Discography'
import ListingForm from './pages/ListingForm'
import { Profile } from './pages/Misc'
import ReleaseView from './pages/ReleaseView'
import SharedTrackView from './pages/SharedTrackView'
import Splits from './pages/Splits'
import SongView from './pages/SongView'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Extension from './pages/Extension'
import CoWriterNotice from './pages/CoWriterNotice'
import Glossary from './pages/Glossary'
import RegisterRights from './pages/RegisterRights'
import Performance from './pages/Performance'
import Earnings from './pages/Earnings'
import Settings from './pages/Settings'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'

function Protected() {
  const { user, loading } = useAuth()
  if (loading) return <Loading what="Signing you in" />
  return user ? <Layout /> : <Navigate to="/login" replace />
}

// A data router, so the unsaved-changes guard can stop navigation from anywhere (sidebar links, the back button).
function Root() {
  return <AuthProvider><Outlet /></AuthProvider>
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/login', element: <AuthPage mode="login" /> },
      { path: '/register', element: <AuthPage mode="register" /> },
      { path: '/verify-email', element: <VerifyEmail /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password', element: <ResetPassword /> },
      { path: '/extension', element: <Extension /> },
      { path: '/notice/:token', element: <CoWriterNotice /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/terms', element: <Terms /> },
      {
        element: <Protected />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/discography', element: <Discography /> },
          { path: '/new/song', element: <ListingForm mode="song" /> },
          { path: '/new/album', element: <ListingForm mode="album" /> },
          { path: '/releases/:id', element: <ReleaseView /> },
          { path: '/releases/:id/edit', element: <ListingForm mode="song" /> },
          { path: '/releases/:id/splits', element: <Splits /> },
          { path: '/releases/:releaseId/tracks/:trackId', element: <SongView /> },
          { path: '/shared-tracks/:id', element: <SharedTrackView /> },
          { path: '/profile', element: <Profile /> },
          { path: '/settings', element: <Settings /> },
          { path: '/glossary', element: <Glossary /> },
          { path: '/performance', element: <Performance /> },
          { path: '/earnings', element: <Earnings /> },
          { path: '/royalty-rights', element: <RegisterRights /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') })

export default function App() {
  return <RouterProvider router={router} />
}
