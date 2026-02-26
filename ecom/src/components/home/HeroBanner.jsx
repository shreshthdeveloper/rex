import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function HeroBanner({ banners = [], loading = false }) {
  const [idx, setIdx] = useState(0);

  const next = useCallback(() => setIdx((i) => (i + 1) % banners.length), [banners.length]);
  const prev = useCallback(() => setIdx((i) => (i - 1 + banners.length) % banners.length), [banners.length]);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [banners.length, next]);

  useEffect(() => {
    setIdx(0);
  }, [banners]);

  if (loading) {
    return (
      <div className="w-full h-[420px] animate-pulse" style={{ backgroundColor: 'var(--color-surface-tertiary)' }} />
    );
  }

  if (!banners.length) {
    return (
      <div className="w-full h-[420px] flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-tertiary)' }}>
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Welcome to the Store</h1>
          <p className="text-lg" style={{ color: 'var(--color-content-secondary)' }}>Browse our products below</p>
        </div>
      </div>
    );
  }

  const banner = banners[idx];

  return (
    <div className="relative w-full h-[320px] sm:h-[420px] overflow-hidden" style={{ backgroundColor: 'var(--color-surface-tertiary)' }}>
      {/* Image */}
      {banner.image ? (
        <div className="w-full h-full overflow-hidden">
          <img src={banner.image} alt={banner.title} className="w-full h-full object-cover transition-transform duration-500 ease-out hover:scale-105" />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center px-4">
            <h2 className="text-3xl sm:text-5xl font-extrabold mb-2">{banner.title}</h2>
            {banner.subtitle && <p className="text-lg" style={{ color: 'var(--color-content-secondary)' }}>{banner.subtitle}</p>}
          </div>
        </div>
      )}

      {/* Overlay text for images */}
      {banner.image && (banner.title || banner.subtitle) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="text-center text-white px-4">
            <h2 className="text-3xl sm:text-5xl font-extrabold mb-2 drop-shadow-lg">{banner.title}</h2>
            {banner.subtitle && <p className="text-base sm:text-lg drop-shadow">{banner.subtitle}</p>}
          </div>
        </div>
      )}

      {/* Arrows */}
      {banners.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors">
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
