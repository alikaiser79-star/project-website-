import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import AuthModal from "./components/AuthModal.jsx";
import LevelFinder from "./components/LevelFinder.jsx";
import WhatsAppButton from "./components/WhatsAppButton.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import ScrollProgress from "./components/ScrollProgress.jsx";
import TrialBar from "./components/TrialBar.jsx";
import Home from "./pages/Home.jsx";
import MemberPortal from "./pages/MemberPortal.jsx";
import MembershipCheck from "./pages/MembershipCheck.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-navy text-white">
      <ScrollProgress />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/portal" element={<MemberPortal />} />
        <Route path="/membership" element={<MembershipCheck />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
      <AuthModal />
      <LevelFinder />
      <WhatsAppButton />
      <ScrollToTop />
      <TrialBar />
    </div>
  );
}
