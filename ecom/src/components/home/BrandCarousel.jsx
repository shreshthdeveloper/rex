import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function BrandCarousel({ brands = [] }) {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  if (!brands.length) return null;

  return (
    <section className="py-10">
      <div className="container-main">
        <h2 className="text-xl font-bold mb-6">Featured Brands</h2>

        <div className="relative">
          <button onClick={() => scroll(-1)} className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full border bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)] transition" style={{ borderColor: 'var(--color-border)' }}>
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-scrollbar px-6">
            {brands.map((b) => (
              <Link
                key={b._id}
                to={`/products?brand=${b._id}`}
                className="shrink-0 w-40 h-20 flex items-center justify-center rounded-lg border transition-all hover:border-[var(--color-brand)] hover:shadow-md"
                style={{ backgroundColor: 'var(--color-surface-tertiary)', borderColor: 'var(--color-border)' }}
              >
                {b.image ? (
                  <img src={b.image} alt={b.name} className="max-h-12 max-w-[120px] object-contain" />
                ) : (
                  <span className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-content-secondary)' }}>{b.name}</span>
                )}
              </Link>
            ))}
          </div>

          <button onClick={() => scroll(1)} className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full border bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)] transition" style={{ borderColor: 'var(--color-border)' }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
