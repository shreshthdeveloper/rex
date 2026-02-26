import { useState, useEffect } from 'react';
import PolicyPageLayout from '../components/common/PolicyPageLayout';
import { catalogService } from '../services/catalogService';

const STATIC_SECTIONS = [
  { title: 'Important', paragraphs: ['WHOLESALE SITE / 18+ ONLY. This site is intended for wholesale customers who are 18 years of age or older. All customers are required to provide a tax/resale identification number prior to their first order.'] },
  { title: 'Notice to Our Customers', paragraphs: ["Seller is not liable for any incidental, consequential or special damages, interest, costs or expenses, or for loss of use, loss of data or lost profits or wages, whether or not Seller knew such damages might be incurred. Seller's liability is in all cases limited to refunding the purchase price or current value of the services, at Seller's option."] },
  { title: 'Payment Methods', paragraphs: ['Accepted payment methods include Visa, MasterCard, Discover, American Express, Wire Transfer, COD Company Check, or COD Secure Payment. All prices and payments are in US Dollars (USD).'] },
  { title: 'Return Policy', paragraphs: ['Only manufacturer defects or items damaged during shipping will be authorized for full credit. All returns must be accompanied by a Return Authorization Number. Damaged or missing items must be reported within 48 hours of delivery. Unless the fault of Phantom Distribution, all returned items will incur a restocking fee of 15%, and the customer will be responsible for any shipping charges.'] },
  { title: 'Shipping', paragraphs: ['Our goal is to ship every order within 1 business day. Phantom Distribution is not liable for shipping delays due to unforeseen circumstances, weather or natural disaster, carrier demand or disputes, domestic/international customs or embargos, or seasonal shipping demand.'] },
  { title: 'Taxes & Exemptions', paragraphs: ['Laws governing taxes & exemptions vary, and you will be held liable for any tax, interest, and possible penalties imposed by your local jurisdiction if your purchase is not legally exempt or if you fail to pay any due tax.'] },
  { title: 'Contact', paragraphs: ['All rights reserved by Phantom Distribution. By doing business with Phantom Distribution, you hereby agree to these terms & conditions and declare any information you provide is correct and complete.'] },
];

export default function TermsConditionsPage() {
  const [htmlContent, setHtmlContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    catalogService.getSettings()
      .then((s) => { if (s?.termsContent) setHtmlContent(s.termsContent); })
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
    return <PolicyPageLayout title="Terms & Conditions" subtitle="Last updated: February 2026" htmlContent={htmlContent} />;
  }

  return <PolicyPageLayout title="Terms & Conditions" subtitle="Last updated: February 2026" sections={STATIC_SECTIONS} />;
}
