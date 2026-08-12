import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import SiteLayout from './layouts/SiteLayout';
import AdminLayout from './layouts/AdminLayout';
import { RequireAdmin, RequireAuth } from './components/RouteGuards';

import HomePage from './pages/HomePage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import TopicsPage from './pages/TopicsPage';
import QuestionBankPage from './pages/QuestionBankPage';
import ExamsPage from './pages/ExamsPage';
import ExamSessionPage from './pages/ExamSessionPage';
import ExamResultPage from './pages/ExamResultPage';
import { VideosPage, VideoDetailPage } from './pages/VideosPage';
import FlashcardsPage from './pages/FlashcardsPage';
import FlashcardStudyPage from './pages/FlashcardStudyPage';
import { BooksPage, BookTocPage, BookSectionPage } from './pages/BooksPage';
import { CalculatorsPage, CalculatorDetailPage } from './pages/CalculatorsPage';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import {
  AboutPage,
  AdvertisePage,
  ContactPage,
  NotFoundPage,
  PrivacyPage,
  TermsPage,
} from './pages/StaticPages';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminQuestions from './pages/admin/AdminQuestions';
import AdminTopics from './pages/admin/AdminTopics';
import AdminExams from './pages/admin/AdminExams';
import AdminVideos from './pages/admin/AdminVideos';
import AdminFlashcards from './pages/admin/AdminFlashcards';
import AdminBooks from './pages/admin/AdminBooks';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAds from './pages/admin/AdminAds';
import AdminBadges from './pages/admin/AdminBadges';

/** Sayfa degisiminde en uste don. */
function ScrollToTop() {
  const { pathname } = useLocation();
  // Blok govdesi sart: ok fonksiyonu kisa yazimla scrollTo'nun donusunu
  // cleanup fonksiyonu sanip React'i cokertiyor.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="giris" element={<LoginPage />} />
          <Route path="kayit" element={<RegisterPage />} />
          <Route path="konular" element={<TopicsPage />} />
          <Route path="soru-bankasi/:topicSlug" element={<QuestionBankPage />} />
          <Route path="sinavlar" element={<ExamsPage />} />
          <Route
            path="sinav/:sessionId"
            element={
              <RequireAuth>
                <ExamSessionPage />
              </RequireAuth>
            }
          />
          <Route
            path="sinav/:sessionId/sonuc"
            element={
              <RequireAuth>
                <ExamResultPage />
              </RequireAuth>
            }
          />
          <Route path="kartlar" element={<FlashcardsPage />} />
          <Route path="kartlar/:deckSlug" element={<FlashcardStudyPage />} />
          <Route path="kitaplar" element={<BooksPage />} />
          <Route path="kitaplar/:bookSlug" element={<BookTocPage />} />
          <Route path="kitaplar/:bookSlug/:sectionSlug" element={<BookSectionPage />} />
          <Route path="hesaplayicilar" element={<CalculatorsPage />} />
          <Route path="hesaplayicilar/:slug" element={<CalculatorDetailPage />} />
          <Route path="videolar" element={<VideosPage />} />
          <Route path="video/:id" element={<VideoDetailPage />} />
          <Route path="siralama" element={<LeaderboardPage />} />
          <Route
            path="profil"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route path="hakkimizda" element={<AboutPage />} />
          <Route path="iletisim" element={<ContactPage />} />
          <Route path="reklam" element={<AdvertisePage />} />
          <Route path="kullanim-kosullari" element={<TermsPage />} />
          <Route path="gizlilik" element={<PrivacyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="sorular" element={<AdminQuestions />} />
          <Route path="konular" element={<AdminTopics />} />
          <Route path="sinavlar" element={<AdminExams />} />
          <Route path="videolar" element={<AdminVideos />} />
          <Route path="kartlar" element={<AdminFlashcards />} />
          <Route path="kitaplar" element={<AdminBooks />} />
          <Route path="kullanicilar" element={<AdminUsers />} />
          <Route path="reklamlar" element={<AdminAds />} />
          <Route path="rozetler" element={<AdminBadges />} />
        </Route>
      </Routes>
    </>
  );
}
