import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import AuthModal from "./components/AuthModal.jsx";
import WhatsAppButton from "./components/WhatsAppButton.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";

const Home = lazy(() => import("./pages/Home.jsx"));
const ProgramsPage = lazy(() => import("./pages/ProgramsPage.jsx"));
const BalletPage = lazy(() => import("./pages/BalletPage.jsx"));
const SafetyPage = lazy(() => import("./pages/SafetyPage.jsx"));
const MembershipPage = lazy(() => import("./pages/MembershipPage.jsx"));
const BookingPage = lazy(() => import("./pages/BookingPage.jsx"));
const AboutPage = lazy(() => import("./pages/AboutPage.jsx"));
const CareersPage = lazy(() => import("./pages/CareersPage.jsx"));
const ContactPage = lazy(() => import("./pages/ContactPage.jsx"));
const MemberPortal = lazy(() => import("./pages/MemberPortal.jsx"));
const MembershipCheck = lazy(() => import("./pages/MembershipCheck.jsx"));

function PageLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center pt-20">
      <div className="flex items-center gap-3 text-white/70">
        <span className="h-3 w-3 animate-ping rounded-full bg-aqua" />
        <span className="text-sm tracking-wide">Loading…</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-navy text-white">
      <ScrollToTop />
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/programs" element={<ProgramsPage />} />
          <Route path="/water-ballet" element={<BalletPage />} />
          <Route path="/safety" element={<SafetyPage />} />
          <Route path="/membership" element={<MembershipPage />} />
          <Route path="/membership/status" element={<MembershipCheck />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/portal" element={<MemberPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Footer />
      <AuthModal />
      <WhatsAppButton />
    </div>
  );
}
