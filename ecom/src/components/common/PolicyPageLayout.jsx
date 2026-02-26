import { FileText } from 'lucide-react';

export default function PolicyPageLayout({ title, subtitle, icon: Icon = FileText, sections = [], htmlContent = null }) {
  return (
    <div className="container-main py-10 sm:py-14">
      <div className="rounded-2xl border p-6 sm:p-8 mb-8" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
        <div className="inline-flex items-center gap-2 badge-brand mb-3"><Icon className="w-4 h-4" /> Policy</div>
        <h1 className="text-2xl sm:text-4xl font-bold mb-3">{title}</h1>
        <p className="text-sm sm:text-base" style={{ color: 'var(--color-content-secondary)' }}>{subtitle}</p>
      </div>

      {htmlContent ? (
        <div className="rounded-xl border p-5 sm:p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
          <div
            className="text-sm leading-relaxed space-y-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_p]:mb-2"
            style={{ color: 'var(--color-content-secondary)' }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      ) : (
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
      )}
    </div>
  );
}
