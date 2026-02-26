import { useState } from 'react';
import { Mail, Phone, User, MessageSquareText, Send, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { catalogService } from '../services/catalogService';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

export default function ContactUsPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error('Name, email and message are required');
      return;
    }
    setLoading(true);
    try {
      await catalogService.submitContactQuery({ ...form, sourcePage: 'contact-us' });
      toast.success('Your query has been submitted');
      setForm(initialForm);
    } catch (err) {
      toast.error(err.message || 'Failed to submit query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-main py-10 sm:py-14">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 rounded-2xl border p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
          <div className="badge-brand mb-3 inline-flex">Support</div>
          <h1 className="text-2xl font-bold mb-2">Contact Us</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--color-content-secondary)' }}>
            Share your requirements, order issues, or partnership queries. Our team will get back to you soon.
          </p>

          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)' }}><Mail className="w-4 h-4" style={{ color: 'var(--color-brand)' }} /></div>
              <div>
                <div className="font-medium">Email</div>
                <div style={{ color: 'var(--color-content-secondary)' }}>phantomdistroinc@gmail.com</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)' }}><Phone className="w-4 h-4" style={{ color: 'var(--color-brand)' }} /></div>
              <div>
                <div className="font-medium">Phone</div>
                <div style={{ color: 'var(--color-content-secondary)' }}>17863092055</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)' }}><MapPin className="w-4 h-4" style={{ color: 'var(--color-brand)' }} /></div>
              <div>
                <div className="font-medium">Office</div>
                <div style={{ color: 'var(--color-content-secondary)' }}>Wholesale Support Desk</div>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-2 rounded-2xl border p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-secondary)' }}>
          <h2 className="text-xl font-semibold mb-4">Send a Message</h2>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label>
                <span className="text-xs block mb-1.5" style={{ color: 'var(--color-content-secondary)' }}>Name *</span>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-content-tertiary)' }} />
                  <input className="input-field pl-9" value={form.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Your full name" />
                </div>
              </label>
              <label>
                <span className="text-xs block mb-1.5" style={{ color: 'var(--color-content-secondary)' }}>Email *</span>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-content-tertiary)' }} />
                  <input type="email" className="input-field pl-9" value={form.email} onChange={(e) => onChange('email', e.target.value)} placeholder="you@example.com" />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label>
                <span className="text-xs block mb-1.5" style={{ color: 'var(--color-content-secondary)' }}>Phone</span>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-content-tertiary)' }} />
                  <input className="input-field pl-9" value={form.phone} onChange={(e) => onChange('phone', e.target.value)} placeholder="+91..." />
                </div>
              </label>
              <label>
                <span className="text-xs block mb-1.5" style={{ color: 'var(--color-content-secondary)' }}>Subject</span>
                <input className="input-field" value={form.subject} onChange={(e) => onChange('subject', e.target.value)} placeholder="Order support / Partnership / Billing" />
              </label>
            </div>

            <label>
              <span className="text-xs block mb-1.5" style={{ color: 'var(--color-content-secondary)' }}>Message *</span>
              <div className="relative">
                <MessageSquareText className="w-4 h-4 absolute left-3 top-3.5" style={{ color: 'var(--color-content-tertiary)' }} />
                <textarea rows={7} className="input-field pl-9 resize-y" value={form.message} onChange={(e) => onChange('message', e.target.value)} placeholder="Tell us how we can help..." />
              </div>
            </label>

            <button type="submit" disabled={loading} className="btn btn-primary btn-md">
              <Send className="w-4 h-4" /> {loading ? 'Submitting...' : 'Submit Query'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
