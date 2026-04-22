// Von Kaiser Farms — Shared UI Components
// ui_kits/website/Components.jsx

const VKNav = ({ dark = false, activePage = 'farm', onNav }) => {
  const bg = dark ? '#1C3829' : '#F5F0E8';
  const border = dark ? '#2E5339' : '#E2D9C5';
  const linkColor = dark ? '#B4CCBA' : '#2C2C28';
  const activeColor = dark ? '#F5F0E8' : '#1C3829';
  const links = [
    { id: 'farm', label: 'The Farm' },
    { id: 'produce', label: 'Produce' },
    { id: 'journal', label: 'Journal' },
    { id: 'story', label: 'Our Story' },
  ];
  return (
    <nav style={{ background: bg, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 48px', position: 'sticky', top: 0, zIndex: 100 }}>
      <img src="../../assets/logo.svg" alt="Von Kaiser Farms" style={{ height: 32, filter: dark ? 'brightness(0) invert(1)' : 'none' }} />
      <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        {links.map(l => (
          <a key={l.id} href="#" onClick={e => { e.preventDefault(); onNav && onNav(l.id); }}
            style={{ fontSize: 13, fontWeight: activePage === l.id ? 500 : 400, color: activePage === l.id ? activeColor : linkColor, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif", transition: 'color 200ms' }}>
            {l.label}
          </a>
        ))}
        <a href="#" onClick={e => { e.preventDefault(); onNav && onNav('order'); }}
          style={{ fontSize: 13, fontWeight: 500, background: dark ? '#C4714A' : '#1C3829', color: dark ? '#fff' : '#F5F0E8', padding: '8px 18px', borderRadius: 4, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
          Order Fresh
        </a>
      </div>
    </nav>
  );
};

const VKTag = ({ children, variant = 'default' }) => {
  const styles = {
    default: { background: '#EDE6D6', color: '#2C2C28', border: '1px solid #D8D0C0' },
    green: { background: '#1C3829', color: '#B4CCBA', border: 'none' },
    sage: { background: '#E8F0EA', color: '#2E5339', border: 'none' },
    terra: { background: '#F5E8E0', color: '#A85D39', border: 'none' },
    gold: { background: '#F5F0E0', color: '#8B6F2A', border: 'none' },
  };
  return (
    <span style={{ ...styles[variant], display: 'inline-flex', alignItems: 'center', borderRadius: 4, fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 9px', fontFamily: "'DM Sans', sans-serif" }}>
      {children}
    </span>
  );
};

const VKButton = ({ children, variant = 'primary', size = 'md', onClick }) => {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, borderRadius: 4, transition: 'all 200ms cubic-bezier(0.25,0.46,0.45,0.94)' };
  const variants = {
    primary: { background: '#1C3829', color: '#F5F0E8', border: 'none' },
    secondary: { background: 'transparent', color: '#1C3829', border: '1px solid #1C3829' },
    accent: { background: '#C4714A', color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#2C2C28', border: '1px solid #D8D0C0' },
  };
  const sizes = {
    sm: { padding: '6px 14px', fontSize: 12 },
    md: { padding: '10px 22px', fontSize: 14 },
    lg: { padding: '14px 30px', fontSize: 16 },
  };
  return <button style={{ ...base, ...variants[variant], ...sizes[size] }} onClick={onClick}>{children}</button>;
};

const VKFooter = () => (
  <footer style={{ background: '#142A1F', padding: '48px', color: '#7A9E87' }}>
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40 }}>
      <div>
        <img src="../../assets/logo-light.svg" alt="Von Kaiser Farms" style={{ height: 36, marginBottom: 16 }} />
        <p style={{ fontSize: 13, lineHeight: 1.7, color: '#7A9E87', maxWidth: 280, fontFamily: "'DM Sans', sans-serif" }}>Chemical-free vegetables grown in hydroponic tower systems. From our garden to your table.</p>
      </div>
      {[['Farm', ['The Setup', 'Tower Systems', 'Our Process', 'Certifications']], ['Produce', ['Leafy Greens', 'Herbs', 'Tomatoes', 'Seasonal Box']], ['Company', ['Our Story', 'Journal', 'Press', 'Contact']]].map(([title, links]) => (
        <div key={title}>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A9E87', marginBottom: 14, fontFamily: "'DM Sans', sans-serif" }}>{title}</div>
          {links.map(l => <div key={l} style={{ fontSize: 13, color: '#B4CCBA', marginBottom: 8, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>{l}</div>)}
        </div>
      ))}
    </div>
    <div style={{ maxWidth: 1200, margin: '32px auto 0', paddingTop: 24, borderTop: '1px solid #2E5339', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: '#7A9E87', fontFamily: "'DM Mono', monospace" }}>© 2026 Von Kaiser Farms. All rights reserved.</span>
      <span style={{ fontSize: 11, color: '#7A9E87', fontFamily: "'DM Mono', monospace" }}>Cairo, Egypt</span>
    </div>
  </footer>
);

const VKProductCard = ({ name, category, tower, day, weight, price, accent = false, onClick }) => (
  <div onClick={onClick} style={{ background: 'white', border: '1px solid #D8D0C0', borderRadius: 4, overflow: 'hidden', boxShadow: '0 2px 12px rgba(26,26,24,0.07)', cursor: 'pointer', transition: 'box-shadow 200ms, transform 200ms' }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(26,26,24,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(26,26,24,0.07)'; e.currentTarget.style.transform = 'none'; }}>
    <div style={{ height: 160, background: accent ? '#6B4E35' : '#1C3829', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>PRODUCT PHOTO</span>
    </div>
    <div style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent ? '#B8973A' : '#7A9E87', marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>{category}</div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 400, color: '#1A1A18', letterSpacing: '-0.01em', marginBottom: 6 }}>{name}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#7A7870' }}>{tower} · Day {day} · {weight}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A18', fontFamily: "'DM Sans', sans-serif" }}>EGP {price}</span>
        <VKButton variant="primary" size="sm">Add</VKButton>
      </div>
    </div>
  </div>
);

Object.assign(window, { VKNav, VKTag, VKButton, VKFooter, VKProductCard });
