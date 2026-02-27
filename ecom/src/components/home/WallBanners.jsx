import { Link } from 'react-router-dom';

export default function WallBanners({ banners = [] }) {
  if (!banners.length) return null;

  return (
    <section className="w-full pt-0 pb-0 sm:pb-0">
      <div className="w-full space-y-0">
        {banners.map((banner, index) => {
          const CardTag = banner.link ? Link : 'div';
          const cardProps = banner.link ? { to: banner.link } : {};

          return (
            <CardTag
              key={`${banner.image || banner.title || 'wall'}-${index}`}
              {...cardProps}
              className={`group block overflow-hidden w-full ${banner.link ? 'cursor-pointer' : ''}`}
            >
              <div className="relative h-36 sm:h-44 md:h-48 w-full">
                {banner.image ? (
                  <img
                    src={banner.image}
                    alt={banner.title || `Wall banner ${index + 1}`}
                    className="block h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    style={{ display: 'block' }}
                  />
                ) : (
                  <div className="h-full w-full" style={{ backgroundColor: 'var(--color-surface-tertiary)' }} />
                )}

                {(banner.title || banner.subtitle) && (
                  <div className="absolute inset-0 bg-black/35 px-4 py-3 sm:px-5 sm:py-4 flex flex-col justify-end">
                    {banner.title && (
                      <h3 className="text-base sm:text-lg font-semibold text-white leading-tight">
                        {banner.title}
                      </h3>
                    )}
                    {banner.subtitle && (
                      <p className="text-xs sm:text-sm text-white/90 mt-1 line-clamp-2">
                        {banner.subtitle}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardTag>
          );
        })}
      </div>
    </section>
  );
}
