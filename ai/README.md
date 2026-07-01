# Turning on the AI Tutor (free, about 2 minutes)

The tutor is off until you connect a free Google Gemini key through a tiny free
proxy. The proxy keeps your key private (it never appears in the website) and
free for every student. Nothing on the site changes until you finish step 3.

## 1. Get a free Gemini API key

1. Go to https://aistudio.google.com/apikey and sign in with a Google account.
2. Click **Create API key**. Copy it.
3. Leave billing **disabled** on that Google Cloud project. On the free tier the
   key cannot charge you. If the daily free limit is reached, students see a
   calm "the tutor has reached its free daily limit" message until the next day.

## 2. Deploy the proxy (Cloudflare Workers, free)

1. Create a free account at https://dash.cloudflare.com and open **Workers & Pages**.
2. **Create application -> Create Worker**. Give it a name like `tmc-tutor`. Deploy the starter.
3. Click **Edit code**, delete the sample, and paste the contents of
   [`gemini-worker.js`](gemini-worker.js). Click **Deploy**.
4. Open the Worker's **Settings -> Variables -> Add variable**:
   - Name: `GEMINI_KEY`, Value: your key from step 1. Tick **Encrypt**. Save.
   - (Optional) `GEMINI_MODEL` = `gemini-2.0-flash` (this is the default).
   - (Optional) `ALLOWED_ORIGIN` = the site origin the proxy should accept.
     It defaults to `https://governor6191.github.io`; add a comma separated
     second origin such as `http://localhost:8090` if you want to test locally.
5. Copy the Worker URL (looks like `https://tmc-tutor.<your-name>.workers.dev`).

## 3. Connect the site

1. Open [`js/ai-config.js`](../js/ai-config.js).
2. Set `AI_ENDPOINT` to your Worker URL, for example:
   ```js
   export const AI_ENDPOINT = 'https://tmc-tutor.yourname.workers.dev';
   ```
3. Commit and push. The tutor appears automatically: an **Ask the tutor** button
   floats on the practice, exam results and coding lab pages, and an
   **Explain this with AI** button appears under the explanation of any
   multiple-choice question a student answered wrongly or left unanswered
   (in practice feedback and in the exam review).

## Notes

- Cost: free. The Gemini free tier and the Cloudflare Workers free tier (100k
  requests a day) comfortably cover a class. Keep billing disabled to be safe.
- Privacy: with the tutor on, a student's typed question and the question text
  are sent to Google Gemini through your proxy. The tutor footer tells students
  this. If you would rather nothing leave the device, leave the tutor off; the
  written explanations on every question still work.
- Abuse: the Worker only answers requests whose Origin header matches
  `ALLOWED_ORIGIN`, so other websites cannot quietly use your quota from their
  visitors' browsers. A determined person faking that header from a script can
  still reach it; if that ever becomes a problem, add a Cloudflare rate
  limiting rule (free) on the Worker route.
- Quota errors and key errors from Google are never shown to students; the
  Worker replaces them with a friendly "try again later" message.
