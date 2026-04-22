// Von Kaiser Farms — Homepage Screen
// ui_kits/website/HomePage.jsx

const HomePage = ({ onNav }) => {
  const [email, setEmail] = React.useState('');

  return (
    <div style={{ background: '#F5F0E8' }}>

      {/* Hero */}
      <section style={{ background: '#1C3829', minHeight: '88vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 48px', position: 'relative', overflow: 'hidden' }}>
        {/* Subtle texture overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 70% 40%, rgba(46,83,57,0.6) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center', position: 'relative' }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A9E87', marginBottom: 24 }}>Cairo, Egypt · Est. 2023</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 72, fontWeight: 300, color: '#F5F0E8', lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 28 }}>
              From our towers<br />to your table
            </h1>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, color: '#B4CCBA', lineHeight: 1.7, marginBottom: 36, maxWidth: 420 }}>
              Chemical-free vegetables grown in hydroponic tower systems. We document every step of the journey — from setup to harvest.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <VKButton variant="accent" size="lg" onClick={() => onNav('produce')}>Shop This Week's Harvest</VKButton>
              <VKButton variant="ghost" size="lg" onClick={() => onNav('journal')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Watch the Journey
              </VKButton>
            </div>
          </div>
          {/* Tower illustration placeholder */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 340, height: 420, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <img src="../../assets/logo-mark.svg" style={{ width: 64, opacity: 0.3 }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>FARM PHOTOGRAPHY</span>
            </div>
          </div>
        </div>
        {/* Stats bar */}
        <div style={{ maxWidth: 1200, margin: '64px auto 0', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, position: 'relative' }}>
          {[['12', 'Active Towers'], ['28', 'Day Grow Cycle'], ['0', 'Chemicals Used'], ['6+', 'Crops In Season']].map(([num, label]) => (
            <div key={label} style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 24 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 300, color: '#F5F0E8', lineHeight: 1 }}>{num}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#7A9E87', marginTop: 6, letterSpacing: '0.04em' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Intro strip */}
      <section style={{ background: '#EDE6D6', padding: '64px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A9E87', marginBottom: 12 }}>The Von Kaiser Difference</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 400, color: '#1A1A18', lineHeight: 1.15, letterSpacing: '-0.02em' }}>German precision.<br />Egyptian warmth.</h2>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: '#2C2C28', lineHeight: 1.75, maxWidth: 580 }}>
            We combine the discipline of European farming methodology with the richness of Egypt's growing climate. Our hydroponic towers produce clean, traceable vegetables — and we document every stage of the journey authentically, because we believe you deserve to know exactly where your food comes from.
          </p>
        </div>
      </section>

      {/* Featured Produce */}
      <section style={{ padding: '80px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A9E87', marginBottom: 10 }}>This Week</div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 400, color: '#1A1A18', lineHeight: 1.1, letterSpacing: '-0.02em' }}>Fresh From The Towers</h2>
            </div>
            <VKButton variant="ghost" onClick={() => onNav('produce')}>See Full Harvest →</VKButton>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <VKProductCard name="Baby Romaine" category="Leafy Greens" tower="Tower 3" day={28} weight="250g" price={45} onClick={() => onNav('product')} />
            <VKProductCard name="Fresh Basil" category="Herbs" tower="Tower 1" day={21} weight="80g" price={30} onClick={() => onNav('product')} />
            <VKProductCard name="Wild Arugula" category="Leafy Greens" tower="Tower 4" day={18} weight="150g" price={38} onClick={() => onNav('product')} />
            <VKProductCard name="Cherry Tomatoes" category="Premium" tower="Tower 2" day={42} weight="300g" price={65} accent onClick={() => onNav('product')} />
          </div>
        </div>
      </section>

      {/* Journal CTA */}
      <section style={{ background: '#1C3829', padding: '80px 48px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A9E87', marginBottom: 16 }}>The Journal</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 300, color: '#F5F0E8', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>We document<br />everything.</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: '#B4CCBA', lineHeight: 1.7, marginBottom: 28, maxWidth: 380 }}>From the moment we set up the first tower to this morning's harvest — every step is filmed, written, and shared with you.</p>
            <VKButton variant="accent" onClick={() => onNav('journal')}>Watch The Journey</VKButton>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {['Setup · Day 1', 'Week 2 · Growth', 'Day 28 · Harvest', 'To Your Table'].map((label, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, aspectRatio: '16/10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textAlign: 'center' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section style={{ padding: '72px 48px', borderTop: '1px solid #E2D9C5' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A9E87', marginBottom: 14 }}>Weekly Harvest Notes</div>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1A1A18', letterSpacing: '-0.02em', marginBottom: 14 }}>Get notified when we harvest</h3>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#7A7870', lineHeight: 1.7, marginBottom: 28 }}>Weekly notes on what's ready, what's growing, and what's coming next season.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '11px 14px', border: '1px solid #D8D0C0', borderRadius: 4, background: 'white', outline: 'none', color: '#1A1A18' }} />
            <VKButton variant="primary">Subscribe</VKButton>
          </div>
        </div>
      </section>

      <VKFooter />
    </div>
  );
};

Object.assign(window, { HomePage });
