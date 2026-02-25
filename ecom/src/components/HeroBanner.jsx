import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function HeroBanner({ banners = [] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const activeBanners = banners.filter((b) => b.isActive);
  if (!activeBanners.length) return null;

  const restart = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent((p) => (p + 1) % activeBanners.length), 5000);
  };

  useEffect(() => {
    restart();
    return () => clearInterval(timerRef.current);
  }, [activeBanners.length]);

  const go = (dir) => {
    setCurrent((p) => (p + dir + activeBanners.length) % activeBanners.length);
    restart();
  };

  const b = activeBanners[current];

  return (
    <div className="relative w-full aspect-[3/1] min-h-[280px] max-h-[500px] overflow-hidden bg-gray-900 group">
      {/* Image */}
      {b.image ? (
        <img src={b.image} alt={b.title} className="w-full h-full object-cover transition-all duration-700" />
      ) : (
        <div className="w-full h-full bg-gradient-to-r from-brand-900 to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-2">{b.title}</h2>
            {b.subtitle && <p className="text-lg text-gray-300">{b.subtitle}</p>}
          </div>
        </div>
      )}

      {/* Overlay with text */}
      {b.image && (b.title || b.subtitle) && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent flex items-center">
          <div className="px-8 md:px-16 max-w-xl">
            <h2 className="text-2xl md:text-4xl font-bold mb-2">{b.title}</h2>
            {b.subtitle && <p className="text-sm md:text-lg text-gray-300">{b.subtitle}</p>}
          </div>
        </div>
      )}

      {/* Arrows */}
      {activeBanners.length > 1 && (
        <>
          <button onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Dots */}
      {activeBanners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {activeBanners.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrent(i); restart(); }}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? 'bg-brand-400 w-6' : 'bg-white/40 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
