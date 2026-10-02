import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
import SongView from './pages/SongView'

function Protected() {
  const { user, loading } = useAuth()
  if (loading) return <Loading what="Signing you in" />
  return user ? <Layout /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route element={<Protected />}>
            <Route path="/" element={<Home />} />
            <Route path="/discography" element={<Discography />} />
            <Route path="/new/song" element={<ListingForm mode="song" />} />
            <Route path="/new/album" element={<ListingForm mode="album" />} />
            <Route path="/releases/:id" element={<ReleaseView />} />
            <Route path="/releases/:id/edit" element={<ListingForm mode="song" />} />
            <Route path="/releases/:releaseId/tracks/:trackId" element={<SongView />} />
            <Route path="/shared-tracks/:id" element={<SharedTrackView />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
