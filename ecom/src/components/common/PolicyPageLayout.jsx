import { FileText } from 'lucide-react';

export default function PolicyPageLayout({ title, subtitle, icon: Icon = FileText, sections = [] }) {
  return (
    <div className="container-main py-10 sm:py-14">
      <div className="rounded-2xl border p-6 sm:p-8 mb-8" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
        <div className="inline-flex items-center gap-2 badge-brand mb-3"><Icon className="w-4 h-4" /> Policy</div>
        <h1 className="text-2xl sm:text-4xl font-bold mb-3">{title}</h1>
        <p className="text-sm sm:text-base" style={{ color: 'var(--color-content-secondary)' }}>{subtitle}</p>
      </div>

      <div className="space-y-4">
        {sections.map((section, idx) => (
          <section key={section.title || idx} className="rounded-xl border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
            {section.title && <h2 className="text-lg font-semibold mb-3">{section.title}</h2>}
            <div className="space-y-2 text-sm" style={{ color: 'var(--color-content-secondary)' }}>
              {(section.paragraphs || []).map((paragraph, pIdx) => (
                <p key={pIdx} className="leading-relaxed">{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
