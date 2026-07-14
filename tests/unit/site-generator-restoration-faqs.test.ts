import { getStarter } from '@/lib/site-generator';

// UNI-2368 finding #4: the restoration starter's FAQs should be insurance-first
// (for a distress/insurance-driven trade, the insurer question is the primary
// concern), and the lead answer should be grounded in what the business does —
// documentation of the loss — not a coverage promise it can't make.
describe('restoration starter FAQs — insurance-first', () => {
  const restoration = getStarter('restoration')!;

  it('leads with the insurance FAQ', () => {
    expect(restoration.faqs[0].question.toLowerCase()).toContain('insurance');
  });

  it('the insurance answer is grounded in documentation of the loss', () => {
    const answer = restoration.faqs[0].answer.toLowerCase();
    expect(answer).toContain('document');
    expect(answer).toContain('claim');
  });

  it('the fast-response FAQ is still present, just not first', () => {
    const questions = restoration.faqs.map(f => f.question.toLowerCase());
    const sooner = questions.findIndex(q => q.includes('soon'));
    expect(sooner).toBeGreaterThan(0);
  });

  it('makes no unqualified coverage guarantee (ACL-safe)', () => {
    const all = restoration.faqs
      .map(f => `${f.question} ${f.answer}`)
      .join(' ')
      .toLowerCase();
    // never promise the claim is covered / guaranteed — coverage is the insurer's call
    expect(all).not.toMatch(/\b(guarantee|guaranteed)\b/);
    expect(all).not.toMatch(/fully covered|always covered|we cover your/);
  });
});
