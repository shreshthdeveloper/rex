import { useState, useEffect } from 'react';
import PolicyPageLayout from '../components/common/PolicyPageLayout';
import { catalogService } from '../services/catalogService';

const STATIC_CONTENT = `
Privacy Policy — Phantom Distribution

This Privacy Policy explains how Phantom Distribution ("we", "us", "our") collects, uses, discloses, and protects your personal information when you access or use our website, products, or services. By using our services you consent to the practices described in this policy.

1. Information We Collect
We collect information you provide directly to us when you create an account, place an order, contact customer support, or otherwise communicate with us. This may include your name, email address, phone number, billing and shipping addresses, tax/resale identification, payment information, and order history.

2. Use of Information
We use the information we collect to process orders, provide customer service, improve our products and services, and communicate with you regarding promotions and updates. We may also use this information for fraud prevention and to comply with legal obligations.

3. Sharing and Disclosure
We may share your information with third-party service providers who perform services on our behalf, such as payment processors, shipping carriers, and marketing platforms. We require these parties to protect your information and use it only for the specific services they provide to us.

4. Security
We implement reasonable technical and organizational measures to protect the information we collect. However, no method of transmission over the Internet or electronic storage is completely secure, and we cannot guarantee absolute security.

5. Your Choices
You can access, update, or delete your account information by contacting customer service. You can opt out of marketing communications at any time by following the unsubscribe instructions in the email or contacting us directly.

6. Children's Privacy
Our services are intended for wholesale customers age 18 and older. We do not knowingly collect personal information from children under 18.

7. Changes to This Policy
We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on our website with an updated effective date.

Contact: For questions about this policy, please contact our support team.
`;

export default function PrivacyPolicyPage() {
  const [htmlContent, setHtmlContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    catalogService
      .getSettings()
      .then((s) => {
        if (s?.privacyContent) setHtmlContent(s.privacyContent);
      })
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
    return (
      <PolicyPageLayout title="Privacy Policy" subtitle="Last updated: February 2026" htmlContent={htmlContent} />
    );
  }

  const paragraphs = STATIC_CONTENT.split('\n\n').map((p) => p.trim()).filter(Boolean);
  const sections = paragraphs.map((para, i) => ({ paragraphs: [para], title: i === 0 ? 'Privacy Policy' : undefined }));
  return <PolicyPageLayout title="Privacy Policy" subtitle="Last updated: February 2026" sections={sections} />;
}
