// Von Kaiser Farms — Produce & Product Detail Screens
// ui_kits/website/ProduceScreens.jsx

const ProducePage = ({ onNav }) => {
  const [activeFilter, setActiveFilter] = React.useState('all');
  const filters = ['All', 'Leafy Greens', 'Herbs', 'Tomatoes', 'Seasonal Box'];
  const products = [
    { name: 'Baby Romaine', category: 'Leafy Greens', tower: 'Tower 3', day: 28, weight: '250g', price: 45 },
    { name: 'Wild Arugula', category: 'Leafy Greens', tower: 'Tower 4', day: 18, weight: '150g', price: 38 },
    { name: 'Butter Lettuce', category: 'Leafy Greens', tower: 'Tower 3', day: 25, weight: '200g', price: 42 },
    { name: 'Fresh Basil', category: 'Herbs', tower: 'Tower 1', day: 21, weight: '80g', price: 30 },
    { name: 'Flat Parsley', category: 'Herbs', tower: 'Tower 1', day: 19, weight: '100g', price: 25 },
    { name: 'Cherry Tomatoes', category: 'Tomatoes', tower: 'Tower 2', day: 42, weight: '300g', price: 65, accent: true },
    { name: 'Seasonal Box', category: 'Seasonal Box', tower: 'Mixed', day: null, weight: '1.2kg', price: 160, accent: true },
    { name: 'Mint', category: 'Herbs', tower: 'Tower 1', day: 14, weight: '60g', price: 22 },
  ];
  const filtered = activeFilter === 'all' ? products : products.filter(p => p.category.toLowerCase() === activeFilter.toLowerCase());

  return (
    <div style={{ background: '#F5F0E8', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ background: '#EDE6D6', padding: '48px 48px 40px', borderBottom: '1px solid #E2D9C5' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A9E87', marginBottom: 12 }}>This Week's Harvest</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 400, color: '#1A1A18', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8 }}>Fresh From The Towers</h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: '#7A7870' }}>Harvested this morning · Updated weekly · All chemical-free</p>
        </div>
      </div>
      {/* Filters */}
      <div style={{ padding: '20px 48px', borderBottom: '1px solid #E2D9C5', background: '#F5F0E8', position: 'sticky', top: 65, zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 8 }}>
          {filters.map(f => {
            const isActive = activeFilter === (f === 'All' ? 'all' : f);
            return (
              <button key={f} onClick={() => setActiveFilter(f === 'All' ? 'all' : f)}
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: isActive ? 500 : 400, padding: '7px 16px', borderRadius: 4, border: isActive ? '1px solid #1C3829' : '1px solid #D8D0C0', background: isActive ? '#1C3829' : 'white', color: isActive ? '#F5F0E8' : '#2C2C28', cursor: 'pointer', transition: 'all 150ms' }}>
                {f}
              </button>
            );
          })}
        </div>
      </div>
      {/* Grid */}
      <div style={{ padding: '40px 48px 80px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {filtered.map(p => <VKProductCard key={p.name} {...p} onClick={() => onNav('product')} />)}
        </div>
      </div>
      <VKFooter />
    </div>
  );
};

const ProductDetailPage = ({ onNav }) => {
  const [qty, setQty] = React.useState(1);
  const [added, setAdded] = React.useState(false);

  const handleAdd = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div style={{ background: '#F5F0E8', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 40, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#7A7870' }}>
          <span style={{ cursor: 'pointer', color: '#1C3829' }} onClick={() => onNav('produce')}>Produce</span>
          <span>→</span>
          <span>Leafy Greens</span>
          <span>→</span>
          <span style={{ color: '#1A1A18' }}>Baby Romaine</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>
          {/* Image */}
          <div>
            <div style={{ background: '#1C3829', borderRadius: 4, aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>PRODUCT PHOTOGRAPH</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {['Tower View', 'Close-up', 'Harvest', 'Packaged'].map(l => (
                <div key={l} style={{ background: '#2E5339', borderRadius: 4, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textAlign: 'center' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Info */}
          <div>
            <div style={{ marginBottom: 8 }}><VKTag variant="sage">Leafy Greens</VKTag></div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 400, color: '#1A1A18', letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 16 }}>Baby Romaine</h1>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              {[['Tower 3', 'Origin'], ['Day 28', 'Cycle Stage'], ['250g', 'Weight'], ['pH 6.2', 'Water Quality']].map(([val, label]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 500, color: '#1A1A18' }}>{val}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: '#7A7870', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #E2D9C5', borderBottom: '1px solid #E2D9C5', padding: '20px 0', marginBottom: 24 }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: '#2C2C28', lineHeight: 1.75 }}>
                Crisp, sweet baby romaine grown over 28 days in our hydroponic towers. No pesticides, no soil contaminants — just clean water, balanced nutrients, and Egyptian sunlight. Harvested this morning.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1A1A18' }}>EGP 45</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 32, height: 32, border: '1px solid #D8D0C0', borderRadius: 4, background: 'white', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}>−</button>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, width: 24, textAlign: 'center' }}>{qty}</span>
                <button onClick={() => setQty(qty + 1)} style={{ width: 32, height: 32, border: '1px solid #D8D0C0', borderRadius: 4, background: 'white', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}>+</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
              <VKButton variant="primary" size="lg" onClick={handleAdd} style={{ flex: 1 }}>
                {added ? '✓ Added to Order' : 'Add to Order'}
              </VKButton>
              <VKButton variant="ghost" size="lg">Save</VKButton>
            </div>
            <div style={{ background: '#EDE6D6', borderRadius: 4, padding: '16px 18px' }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: '#1A1A18', marginBottom: 4 }}>Harvested this morning</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#7A7870' }}>Available for delivery today · New Cairo, Maadi, Zamalek</div>
            </div>
          </div>
        </div>
      </div>
      <VKFooter />
    </div>
  );
};

Object.assign(window, { ProducePage, ProductDetailPage });
