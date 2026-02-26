import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import ProductCard from '../product/ProductCard';

export default function ProductSection({ title, products = [], linkTo, loading }) {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    <section className="py-10">
      <div className="container-main">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <div className="w-12 h-0.5 mt-1 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
          </div>
          {linkTo && (
            <Link to={linkTo} className="flex items-center gap-1 text-sm font-medium transition-colors hover:text-[var(--color-brand)]" style={{ color: 'var(--color-content-secondary)' }}>
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Carousel */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden">
                <div className="skeleton h-44 w-full" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            <button onClick={() => scroll(-1)} className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full border bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)] transition" style={{ borderColor: 'var(--color-border)' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div ref={scrollRef} className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth px-1">
              {products.map((p) => (
                <div key={p._id} className="shrink-0 w-[230px]">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>

            <button onClick={() => scroll(1)} className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full border bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)] transition" style={{ borderColor: 'var(--color-border)' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
