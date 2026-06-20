import Hero from "../sections/Hero.jsx";
import About from "../sections/About.jsx";
import Pricing from "../sections/Pricing.jsx";
import HowItWorks from "../sections/HowItWorks.jsx";
import Contact from "../sections/Contact.jsx";

export default function Home() {
  return (
    <main>
      <Hero />
      <About />
      <Pricing />
      <HowItWorks />
      <Contact />
    </main>
  );
}
