import { useState, useEffect } from 'react';
import { catalogService } from '../services/catalogService';
import HeroBanner from '../components/home/HeroBanner';
import BrandCarousel from '../components/home/BrandCarousel';
import ProductSection from '../components/home/ProductSection';

export default function HomePage() {
  const [settings, setSettings] = useState(null);
  const [brands, setBrands] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [s, b, f, n] = await Promise.allSettled([
          catalogService.getSettings(),
          catalogService.getBrands(),
          catalogService.getFeatured(),
          catalogService.getNewArrivals(12),
        ]);

        if (cancelled) return;

        if (s.status === 'fulfilled') setSettings(s.value || null);
        if (b.status === 'fulfilled') setBrands(b.value || []);
        if (f.status === 'fulfilled') setFeatured(f.value || []);
        if (n.status === 'fulfilled') setNewArrivals(n.value || []);
      } catch (err) {
        console.error('Failed to load homepage:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const banners = settings?.banners?.filter((b) => b.isActive) || [];

  return (
    <div>
      <HeroBanner banners={banners} loading={loading} />

      {/* Banner strip / marquee */}
      {settings?.marqueeEnabled && settings?.marqueeText && (
        <div className="py-2 text-center text-sm font-medium" style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}>
          <div className="container-main overflow-hidden">
            <div className="animate-[scroll_20s_linear_infinite] whitespace-nowrap">{settings.marqueeText}</div>
          </div>
        </div>
      )}

      <BrandCarousel brands={brands} />

      {featured.length > 0 && (
        <ProductSection
          title="Trending Now"
          products={featured}
          linkTo="/products?featured=true"
          loading={loading}
        />
      )}

      {newArrivals.length > 0 && (
        <div style={{ backgroundColor: 'var(--color-surface-secondary)' }}>
          <ProductSection
            title="New Arrivals"
            products={newArrivals}
            linkTo="/products?sort=newest"
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
