import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Carousel({ children, title, rightSlot }) {
  const ref = useRef(null);

  const scroll = (dir) => {
    if (ref.current) {
      ref.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
    }
  };

  return (
    <section className="relative">
      {/* Header */}
      {(title || rightSlot) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <div className="w-12 h-0.5 bg-brand-500 mt-1 rounded-full" />
          </div>
          {rightSlot}
        </div>
      )}

      {/* Scrollable */}
      <div className="relative group">
        <div ref={ref} className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
          {children}
        </div>

        {/* Arrows */}
        <button onClick={() => scroll(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 bg-gray-900/90 hover:bg-gray-800 border border-gray-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => scroll(1)} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 bg-gray-900/90 hover:bg-gray-800 border border-gray-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
