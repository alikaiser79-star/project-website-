import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Hero from "../sections/Hero.jsx";
import WaterBallet from "../sections/WaterBallet.jsx";
import Programs from "../sections/Programs.jsx";
import Adults from "../sections/Adults.jsx";
import Schedule from "../sections/Schedule.jsx";
import Safety from "../sections/Safety.jsx";
import Membership from "../sections/Membership.jsx";
import Testimonials from "../sections/Testimonials.jsx";
import Showcases from "../sections/Showcases.jsx";
import About from "../sections/About.jsx";
import Faq from "../sections/Faq.jsx";
import Careers from "../sections/Careers.jsx";
import Contact from "../sections/Contact.jsx";

export default function Home() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = hash.replace("#", "");
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hash]);

  return (
    <main>
      <Hero />
      <WaterBallet />
      <Programs />
      <Adults />
      <Schedule />
      <Safety />
      <Membership />
      <Testimonials />
      <Showcases />
      <About />
      <Faq />
      <Careers />
      <Contact />
    </main>
  );
}
