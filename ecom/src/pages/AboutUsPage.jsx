import { Sparkles, ShieldCheck, Truck, Store, Layers } from 'lucide-react';

const highlights = [
  {
    title: 'Wholesale Focused',
    icon: Store,
    text: 'Built for B2B buying with streamlined ordering, category-first browsing, and reliable bulk workflows.',
  },
  {
    title: 'Trusted Supply',
    icon: ShieldCheck,
    text: 'Products are sourced and managed with strong operational controls to support dependable fulfillment.',
  },
  {
    title: 'Faster Dispatch',
    icon: Truck,
    text: 'Smart stock and order systems are designed to reduce turnaround time from checkout to shipment.',
  },
  {
    title: 'Scalable Platform',
    icon: Layers,
    text: 'Flexible storefront and ERP architecture supports growth across categories, brands, and customer tiers.',
  },
];

export default function AboutUsPage() {
  return (
    <div className="container-main py-10 sm:py-14">
      <section className="rounded-2xl border p-6 sm:p-10 mb-8" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
        <div className="badge-brand mb-3 inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Our Story</div>
        <h1 className="text-3xl sm:text-5xl font-bold leading-tight mb-4">About Us</h1>
        <p className="text-sm sm:text-base max-w-3xl" style={{ color: 'var(--color-content-secondary)' }}>
          At Phantom Distro Inc., we bring Southern hospitality to wholesale. With over a decade of combined experience in wholesale and international supply chains, we connect retailers to sought-after brands — including products that are otherwise hard to source. We build trusted relationships with manufacturers and distributors to offer competitive pricing and reliable availability.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-8">
        {highlights.map(({ title, text, icon: Icon }) => (
          <div key={title} className="rounded-xl border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--color-brand-light)' }}>
              <Icon className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
            </div>
            <h2 className="text-lg font-semibold mb-2">{title}</h2>
            <p className="text-sm" style={{ color: 'var(--color-content-secondary)' }}>{text}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border p-6 sm:p-8" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
        <h2 className="text-xl sm:text-2xl font-semibold mb-3">What We Believe</h2>
        <p className="text-sm sm:text-base" style={{ color: 'var(--color-content-secondary)' }}>
          We simplify wholesale: reliable stock, fair pricing, and a clean buying experience that helps your business move faster.
        </p>
      </section>
    </div>
  );
}
