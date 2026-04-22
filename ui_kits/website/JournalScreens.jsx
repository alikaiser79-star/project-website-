// Von Kaiser Farms — Journal & Story Screens
// ui_kits/website/JournalScreens.jsx

const JournalPage = ({ onNav }) => {
  const episodes = [
    { ep: '01', title: 'Setting Up The First Tower', date: 'March 1, 2026', duration: '12 min', desc: 'The beginning. We document the full setup of our first hydroponic tower system — from the frame assembly to the first water cycle.' },
    { ep: '02', title: 'Choosing Our First Seeds', date: 'March 8, 2026', duration: '8 min', desc: 'Why romaine? Why basil? The decisions behind our first grow selection, and what we learned from German hydroponic operators.' },
    { ep: '03', title: 'Week Two — The First Signs of Life', date: 'March 15, 2026', duration: '10 min', desc: 'Something is growing. We track the first two weeks of the lettuce cycle, measure pH levels, and adjust the nutrient solution.' },
    { ep: '04', title: 'Day 28 — Our First Harvest', date: 'April 1, 2026', duration: '15 min', desc: 'The moment we had been building toward. A full harvest walkthrough, yield measurements, and an honest reflection on what worked.' },
    { ep: '05', title: 'From Tower to Table', date: 'April 8, 2026', duration: '11 min', desc: 'Following the produce from harvest through packaging to our first customer delivery in New Cairo. The complete chain documented.' },
  ];

  return (
    <div style={{ background: '#F5F0E8', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#1C3829', padding: '64px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A9E87', marginBottom: 16 }}>The Farm Journal</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 60, fontWeight: 300, color: '#F5F0E8', letterSpacing: '-0.02em', lineHeight: 1.05, maxWidth: 640, marginBottom: 18 }}>We document everything.</h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: '#B4CCBA', lineHeight: 1.7, maxWidth: 480 }}>Every tower setup, every grow cycle, every harvest — filmed and shared authentically. This is the full story of Von Kaiser Farms.</p>
        </div>
      </div>
      {/* Featured episode */}
      <div style={{ padding: '48px 48px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, background: 'white', border: '1px solid #D8D0C0', borderRadius: 4, overflow: 'hidden', boxShadow: '0 2px 12px rgba(26,26,24,0.07)' }}>
            <div style={{ background: '#2E5339', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <div style={{ position: 'absolute', bottom: 16, left: 16, fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>LATEST EPISODE · 15 MIN</div>
            </div>
            <div style={{ padding: '36px 36px 36px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ marginBottom: 10 }}><VKTag variant="terra">Latest</VKTag></div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#7A7870', marginBottom: 10 }}>Episode 05 · April 8, 2026</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: '#1A1A18', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>From Tower to Table</h2>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#2C2C28', lineHeight: 1.7, marginBottom: 24 }}>Following the produce from harvest through packaging to our first customer delivery. The complete chain, documented.</p>
              <VKButton variant="primary">Watch Episode</VKButton>
            </div>
          </div>
        </div>
      </div>
      {/* Episode list */}
      <div style={{ padding: '40px 48px 80px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A9E87', marginBottom: 20 }}>All Episodes</div>
          {episodes.map((ep, i) => (
            <div key={ep.ep} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 24, alignItems: 'start', padding: '24px 0', borderBottom: '1px solid #E2D9C5', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#EDE6D6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#7A9E87', paddingTop: 4 }}>0{ep.ep.slice(-1)}</div>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#7A7870', marginBottom: 5 }}>{ep.date}</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: '#1A1A18', letterSpacing: '-0.01em', marginBottom: 6 }}>{ep.title}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#7A7870', lineHeight: 1.6, maxWidth: 560 }}>{ep.desc}</div>
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#7A7870', whiteSpace: 'nowrap', paddingTop: 4 }}>{ep.duration}</div>
            </div>
          ))}
        </div>
      </div>
      <VKFooter />
    </div>
  );
};

const StoryPage = ({ onNav }) => (
  <div style={{ background: '#F5F0E8', minHeight: '100vh' }}>
    {/* Full-bleed header */}
    <div style={{ background: '#1C3829', padding: '96px 48px', textAlign: 'center' }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A9E87', marginBottom: 16 }}>Our Story</div>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 64, fontWeight: 300, color: '#F5F0E8', letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 24, maxWidth: 720, margin: '0 auto 24px' }}>
        Where European roots meet Egyptian earth
      </h1>
    </div>
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '72px 48px' }}>
      {[
        ['The Beginning', "Von Kaiser Farms began with a simple frustration: the produce available in Cairo was inconsistent, chemically treated, and difficult to trace. We knew there was a better way — and we'd seen it work in Germany."],
        ['The Method', "We studied hydroponic tower farming techniques refined over decades in northern Europe, then adapted them for Egypt's climate. The result: a controlled growing environment that produces clean, predictable, traceable crops year-round."],
        ['The Name', "'Von Kaiser' is both a statement and a promise. 'Von' — meaning 'from' in German — signals our European methodology. 'Kaiser' means emperor: a commitment to the highest standard. And 'Farms' keeps us grounded in the earth."],
        ['The Journey', "We document everything. Not for marketing — because we believe transparency builds the trust that the food industry has spent decades eroding. Every tower, every grow cycle, every harvest: filmed, measured, and shared."],
      ].map(([title, body], i) => (
        <div key={i} style={{ marginBottom: 48, paddingBottom: 48, borderBottom: i < 3 ? '1px solid #E2D9C5' : 'none' }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 500, color: '#1A1A18', letterSpacing: '-0.01em', marginBottom: 14 }}>{title}</h3>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: '#2C2C28', lineHeight: 1.8 }}>{body}</p>
        </div>
      ))}
      <blockquote style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 300, fontStyle: 'italic', color: '#1C3829', lineHeight: 1.3, letterSpacing: '-0.01em', borderLeft: '2px solid #7A9E87', paddingLeft: 24, margin: '48px 0' }}>
        "From our towers to your table — no chemicals, no shortcuts, no compromise."
      </blockquote>
    </div>
    <VKFooter />
  </div>
);

Object.assign(window, { JournalPage, StoryPage });
