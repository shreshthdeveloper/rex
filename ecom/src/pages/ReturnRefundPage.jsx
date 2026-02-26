import { useState, useEffect } from 'react';
import PolicyPageLayout from '../components/common/PolicyPageLayout';
import { catalogService } from '../services/catalogService';

const STATIC_SECTIONS = [
  { title: 'Return & Refund Policy', paragraphs: ['Only manufacturer defects or items damaged during shipping will be authorized for full credit. All returns must be accompanied by an approved Return Authorization (RA) number issued by Phantom Distribution. Damaged or missing items must be reported within 48 hours of delivery. Unless the fault of Phantom Distribution, returned items are subject to a 15% restocking fee and the customer is responsible for return shipping charges.'] },
  { title: 'Perishable Items', paragraphs: ['Perishable items are not eligible for return or credit under any circumstances.'] },
  { title: 'Hazmat Returns', paragraphs: ['Due to federal and carrier regulations, hazardous materials cannot be accepted as returns unless arranged with Phantom Distribution and shipped by an authorized carrier. Unauthorized returns containing hazardous materials will not be credited.'] },
  { title: 'Refused or Unclaimed Shipments', paragraphs: ['Refused or unclaimed shipments will incur a 15% restocking fee plus all freight charges. If the customer requests reshipment, all additional freight charges will apply.'] },
  { title: 'Return Process', paragraphs: ['Contact your Sales Account Manager or customer service to obtain an RA number. Clearly mark the RA number on the packing slip and outside of the package. Returns without an RA number may be refused.'] },
  { title: 'Contact', paragraphs: ['For questions about returns or refunds, please contact your Sales Account Manager or our customer support team during normal business hours.'] },
];

export default function ReturnRefundPage() {
  const [htmlContent, setHtmlContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    catalogService.getSettings()
      .then((s) => { if (s?.returnRefundContent) setHtmlContent(s.returnRefundContent); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container-main py-10">
        <div className="animate-pulse h-64 rounded-2xl" style={{ backgroundColor: 'var(--color-surface-tertiary)' }} />
      </div>
    );
  }

  if (htmlContent) {
    return <PolicyPageLayout title="Return & Refund Policy" subtitle="Last updated: February 2026" htmlContent={htmlContent} />;
  }

  return <PolicyPageLayout title="Return & Refund Policy" subtitle="Last updated: February 2026" sections={STATIC_SECTIONS} />;
}
