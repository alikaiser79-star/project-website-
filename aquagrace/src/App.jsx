import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import AuthModal from "./components/AuthModal.jsx";
import WhatsAppButton from "./components/WhatsAppButton.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import Home from "./pages/Home.jsx";
import MemberPortal from "./pages/MemberPortal.jsx";
import MembershipCheck from "./pages/MembershipCheck.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-navy text-white">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/portal" element={<MemberPortal />} />
        <Route path="/membership" element={<MembershipCheck />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <Footer />
      <AuthModal />
      <WhatsAppButton />
      <ScrollToTop />
    </div>
  );
}
