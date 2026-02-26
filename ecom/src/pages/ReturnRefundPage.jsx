import PolicyPageLayout from '../components/common/PolicyPageLayout';

const content = `
Return & Refund Policy — Phantom Distribution

Only manufacturer defects or items damaged during shipping will be authorized for full credit. All returns must be accompanied by an approved Return Authorization (RA) number issued by Phantom Distribution. Damaged or missing items must be reported within 48 hours of delivery. Unless the fault of Phantom Distribution, returned items are subject to a 15% restocking fee and the customer is responsible for return shipping charges.

Perishable Items
Perishable items are not eligible for return or credit under any circumstances.

Hazmat Returns
Due to federal and carrier regulations, hazardous materials cannot be accepted as returns unless arranged with Phantom Distribution and shipped by an authorized carrier. Unauthorized returns containing hazardous materials will not be credited.

Refused or Unclaimed Shipments
Refused or unclaimed shipments will incur a 15% restocking fee plus all freight charges. If the customer requests reshipment, all additional freight charges will apply.

Return Process
To initiate a return, contact your Sales Account Manager or customer service to obtain an RA number. Clearly mark the RA number on the packing slip and the outside of the package. Returns without an RA number may be refused.

Inspection and Credit
All returns are subject to inspection upon arrival. If the item is determined to be defective or incorrectly shipped, Phantom Distribution will issue full credit or replacement at our discretion. If the return is due to customer error or non-defective condition, applicable restocking and shipping fees will be deducted from the credit.

Contact
For questions about returns or refunds, please contact your Sales Account Manager or our customer support team during normal business hours.
`;

const paragraphs = content.split('\n\n').map(p => p.trim()).filter(Boolean);

export default function ReturnRefundPage() {
  const sections = paragraphs.map((para, i) => ({ paragraphs: [para], title: i === 0 ? 'Return & Refund Policy' : undefined }));
  return <PolicyPageLayout title="Return & Refund Policy" subtitle="Last updated: February 2026" sections={sections} />;
}
