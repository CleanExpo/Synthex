/**
 * Deploy-shell lead-capture binding for the multi-tenant site generator.
 *
 * `generateSite()` emits an always-present enquiry CTA — `<a data-intake
 * href="#enquire">` — but leaves the wiring to the deploy shell (see
 * builder.ts:renderTrust). This module is that wiring: it appends the
 * `#enquire` target section (the anchor the CTA lands on, no JS required) plus
 * a progressive-enhancement script that submits the enquiry to the Unite-Group
 * public lead-capture lane, `POST /api/leads` (UNI-2355 / Unite-Group #807).
 *
 * That route is JSON-only (`request.json()`), so a plain form POST would 400.
 * The script therefore serialises the enquiry to JSON via `fetch`, mapping the
 * on-page fields to the route's contract (`first_name` + `email` required;
 * `last_name`, `phone`, `message`, `business_key`, `referral_source` optional;
 * success is HTTP 201). The `tel:` call CTA remains the no-JS path.
 *
 * Pure function — no I/O. The caller writes the returned HTML into a deployed
 * page (Next.js `dangerouslySetInnerHTML`, static export, etc.).
 */

export interface LeadCaptureConfig {
  /**
   * The capture endpoint the enquiry is POSTed to. Defaults to the relative
   * `/api/leads`, which resolves to the #807 lane when the page is served from
   * the Unite-Group app. Per-brand deployments on their own origin (e.g.
   * disasterrecovery.com.au) pass the absolute Unite-Group URL instead.
   */
  endpoint?: string;
  /**
   * Brand slug stamped on the lead for founder-side attribution
   * (`dr`, `nrpg`, `carsi`, `restore`, …). Maps to the route's `business_key`.
   */
  businessKey?: string;
}

const DEFAULT_ENDPOINT = '/api/leads';

export function bindLeadCapture(
  html: string,
  config: LeadCaptureConfig = {}
): string {
  const endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
  const businessKey = config.businessKey?.trim();

  const businessKeyInput = businessKey
    ? `\n      <input type="hidden" name="business_key" value="${escAttr(businessKey)}" />`
    : '';

  const form = `
  <section id="enquire" class="enquire-form" aria-labelledby="enquire-heading">
    <h2 id="enquire-heading">Request an assessment</h2>
    <form data-lead-form method="post" action="${escAttr(endpoint)}">${businessKeyInput}
      <label>Your name
        <input type="text" name="name" autocomplete="name" required />
      </label>
      <label>Email
        <input type="email" name="email" autocomplete="email" required />
      </label>
      <label>Phone
        <input type="tel" name="phone" autocomplete="tel" />
      </label>
      <label>How can we help?
        <textarea name="message" rows="4"></textarea>
      </label>
      <button type="submit">Send enquiry</button>
      <p data-lead-status role="status" aria-live="polite"></p>
    </form>
  </section>`;

  const script = `
  <script>
  (function () {
    var form = document.querySelector('form[data-lead-form]');
    if (!form) return;
    var status = form.querySelector('[data-lead-status]');
    var endpoint = ${JSON.stringify(endpoint)};
    function set(msg) { if (status) status.textContent = msg; }
    Array.prototype.forEach.call(document.querySelectorAll('[data-intake]'), function (el) {
      el.addEventListener('click', function () {
        var f = form.querySelector('input[name="name"]');
        if (f) setTimeout(function () { f.focus(); }, 0);
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var name = String(data.get('name') || '').trim();
      var gap = name.indexOf(' ');
      var body = {
        first_name: gap === -1 ? name : name.slice(0, gap),
        email: String(data.get('email') || '').trim(),
        referral_source: 'ai-website'
      };
      var last = gap === -1 ? '' : name.slice(gap + 1).trim();
      if (last) body.last_name = last;
      var phone = String(data.get('phone') || '').trim();
      if (phone) body.phone = phone;
      var message = String(data.get('message') || '').trim();
      if (message) body.message = message;
      var bk = data.get('business_key');
      if (bk) body.business_key = String(bk);
      set('Sending…');
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (r.status === 201) {
          form.reset();
          set('Thanks — the team will be in touch shortly.');
          return;
        }
        return r.json().catch(function () { return {}; }).then(function (j) {
          set((j && j.error) || 'Something went wrong. Please call the team instead.');
        });
      }).catch(function () {
        set('Something went wrong. Please call the team instead.');
      });
    });
  })();
  </script>`;

  return `${html}\n${form}\n${script}`;
}

function escAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
