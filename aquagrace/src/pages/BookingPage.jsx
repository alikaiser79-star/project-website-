import { Link } from "react-router-dom";
import PageShell from "../components/PageShell.jsx";
import Booking from "../sections/Booking.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { Shield, User } from "../components/Icons.jsx";

export default function BookingPage() {
  const { isAuthed } = useAuth();
  const { openLogin, openSignup } = useUI();

  if (!isAuthed) {
    return (
      <PageShell>
        <section className="relative py-24 md:py-32">
          <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-aqua/10 to-transparent" />
          <div className="mx-auto max-w-2xl px-4 md:px-8">
            <div className="rounded-3xl border border-aqua/20 bg-gradient-to-br from-aqua/10 via-white/[0.03] to-transparent p-8 md:p-12 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-aqua/15 text-aqua ring-1 ring-aqua/30">
                <Shield className="h-6 w-6" />
              </span>
              <p className="eyebrow mt-6">Members only</p>
              <h1 className="mt-3 font-display text-3xl md:text-4xl font-semibold text-white">
                Sign in to reserve a lane
              </h1>
              <p className="mt-3 text-white/70">
                Booking a session is a member benefit — it lets us hold your spot, sync sessions to
                your portal, and message you if anything changes. Create a free account in seconds.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <button onClick={openSignup} className="btn-primary">
                  <User className="h-4 w-4" /> Create an account
                </button>
                <button onClick={openLogin} className="btn-outline">
                  I already have an account
                </button>
              </div>
              <p className="mt-6 text-xs text-white/50">
                Just looking around? <Link to="/programs" className="text-aqua hover:underline">Browse our programs</Link>
                {" "}or <Link to="/membership" className="text-aqua hover:underline">view membership tiers</Link>.
              </p>
            </div>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Booking />
    </PageShell>
  );
}
