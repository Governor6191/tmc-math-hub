import { renderChrome, escapeHtml } from './app.js';

renderChrome();
const root = document.getElementById('feedback-root');

// Free Web3Forms access key (get one at https://web3forms.com, it routes
// submissions to Sylvester's inbox without exposing the address). Replace the
// placeholder below with the real key.
const WEB3FORMS_KEY = 'c213a3b5-92af-4847-b955-5c073ce2c0e5';

// Free imgbb API key (get one at https://api.imgbb.com). An optional screenshot
// is uploaded there and its link is included in the feedback email; the static
// site has no storage of its own.
const IMGBB_KEY = '9f60dc41e1e594ed5285655c2e2763f5';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const TOPICS = [
  'General feedback',
  'About a question or its answer',
  'A bug or an error',
  'Something else',
];

const fromContext = new URLSearchParams(location.search).get('about') || document.referrer || '';

function crumb() {
  return `<p class="crumb"><a class="crumb-back" href="index.html" aria-label="Back to the library">&#8592;</a><a href="index.html">Library</a> · Feedback</p>`;
}

function formMarkup() {
  return `
    ${crumb()}
    <h1>Talk to us</h1>
    <p class="feedback-intro">Leave Sylvester feedback on how to improve the site. Got a question?
    Spotted an error in a question or its answer? Tell us, and help make this better for the next fellow.</p>
    <form id="feedback-form" class="feedback-form" novalidate>
      <label class="field">
        <span>What is this about?</span>
        <select name="topic">${TOPICS.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}</select>
      </label>
      <label class="field">
        <span>Your message</span>
        <textarea name="message" rows="6" required
          placeholder="What is on your mind? If it is about a specific question, paste it or say where you saw it."></textarea>
      </label>
      <label class="field">
        <span>Your email <em>(optional, only if you want a reply)</em></span>
        <input type="email" name="email" autocomplete="email" placeholder="you@example.com">
      </label>
      <label class="field">
        <span>Screenshot <em>(optional, e.g. the question that looks wrong)</em></span>
        <input type="file" name="screenshot" accept="image/*">
      </label>
      <input type="hidden" name="from_page" value="${escapeHtml(fromContext)}">
      <input type="text" name="nickname" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="form-row">
        <button type="submit" class="next-btn">Send feedback</button>
        <span id="feedback-status" class="feedback-status" aria-live="polite"></span>
      </div>
    </form>`;
}

function showThanks() {
  root.innerHTML = `
    ${crumb()}
    <div class="feedback-thanks">
      <h1>Thank you.</h1>
      <p>Your note is on its way to Sylvester. Every one gets read.</p>
      <p><a class="next-btn" style="display: inline-block; text-decoration: none;" href="index.html">Back to the library</a></p>
    </div>`;
}

function wire() {
  const form = document.getElementById('feedback-form');
  const status = document.getElementById('feedback-status');
  const btn = form.querySelector('button[type="submit"]');

  async function uploadScreenshot(file) {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.success || !data.data || !data.data.url) throw new Error('image-upload');
    return data.data.url;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = form.message.value.trim();
    if (message.length < 3) {
      status.textContent = 'Please write a little more first.';
      status.className = 'feedback-status err';
      form.message.focus();
      return;
    }
    const file = form.screenshot.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        status.textContent = 'The attachment must be an image (png, jpg, and the like).';
        status.className = 'feedback-status err';
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        status.textContent = 'That image is over 5 MB. Please attach a smaller one.';
        status.className = 'feedback-status err';
        return;
      }
    }
    if (form.nickname.value) { showThanks(); return; } // honeypot: silently drop bots

    btn.disabled = true;
    try {
      let screenshotUrl = '';
      if (file) {
        status.textContent = 'Uploading screenshot...';
        status.className = 'feedback-status';
        screenshotUrl = await uploadScreenshot(file);
      }
      status.textContent = 'Sending...';
      status.className = 'feedback-status';

      const payload = {
        access_key: WEB3FORMS_KEY,
        subject: `TMC Math Hub feedback: ${form.topic.value}`,
        from_name: 'TMC Math Hub visitor',
        topic: form.topic.value,
        message: screenshotUrl ? `${message}\n\nScreenshot: ${screenshotUrl}` : message,
        from_page: form.from_page.value,
      };
      if (screenshotUrl) payload.screenshot = screenshotUrl;
      const email = form.email.value.trim();
      if (email) payload.email = email;

      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Submission failed');
      showThanks();
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      status.textContent = err.message === 'image-upload'
        ? 'The screenshot would not upload. Try a smaller image, or remove it and send just the message.'
        : 'Sorry, that did not send. Check your connection and try again.';
      status.className = 'feedback-status err';
    }
  });
}

root.innerHTML = formMarkup();
wire();
