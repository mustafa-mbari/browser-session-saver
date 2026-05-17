import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Browser Hub',
  description: 'How Browser Hub collects, uses, and protects your data.',
}

const EFFECTIVE_DATE = 'May 17, 2026'
const CONTACT_EMAIL = 'mbari.info@gmail.com'

export default function PrivacyPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-10">
          Effective date: {EFFECTIVE_DATE}
        </p>

        <div className="prose prose-stone dark:prose-invert max-w-none space-y-10">

          <Section title="Overview">
            <p>
              Browser Hub (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the extension&rdquo;) is a Chrome extension
              that saves, restores, and manages your browser sessions. This policy explains what data
              we collect, why we collect it, and how we protect it.
            </p>
            <p>
              <strong>By default, almost all your data stays entirely on your device.</strong> Session
              data, bookmarks, notes, and todos are stored in your browser&rsquo;s local storage and
              never leave your computer unless you explicitly sign in.
            </p>
          </Section>

          <Section title="Data We Collect">
            <Subsection title="1. Account data (optional — only if you sign in)">
              <ul>
                <li>
                  <strong>Email address</strong> — used for authentication only. We use{' '}
                  <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    Supabase
                  </a>{' '}
                  to manage accounts. Your email is never sold or shared with third parties.
                </li>
                <li>
                  <strong>Action usage counters</strong> — daily and monthly counts of how many
                  sessions, bookmarks, prompts, and subscriptions you create or modify. These are used
                  to enforce your plan&rsquo;s usage limits. Counters are stored locally and synced to
                  Supabase only when you are signed in.
                </li>
                <li>
                  <strong>Plan tier</strong> — your subscription tier (Free, Pro, or Lifetime) is
                  fetched from Supabase on sign-in and cached locally.
                </li>
              </ul>
            </Subsection>

            <Subsection title="2. Guest usage (no account required)">
              <ul>
                <li>
                  <strong>Guest identifier</strong> — a random UUID generated locally and stored in
                  your browser. It has no connection to your identity. It is used to track daily and
                  monthly action limits for unauthenticated users. It is deleted when you sign in and
                  your counts are merged into your account.
                </li>
                <li>
                  <strong>Action usage counters</strong> — same counters as above, but associated
                  with your guest ID instead of an email address. These are reported to Supabase in
                  aggregate to enforce rate limits.
                </li>
              </ul>
            </Subsection>

            <Subsection title="3. Weather widget (optional — only if you enable it)">
              <ul>
                <li>
                  <strong>GPS coordinates</strong> — if you grant location permission, your
                  latitude/longitude is sent to{' '}
                  <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    Open-Meteo
                  </a>{' '}
                  to fetch a weather forecast. Coordinates are not stored on our servers.
                </li>
                <li>
                  <strong>IP address</strong> — if you do not grant location permission, your IP
                  address is sent to{' '}
                  <a href="https://ipinfo.io" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    ipinfo.io
                  </a>{' '}
                  to approximate your city for the weather widget. Your IP is not stored on our
                  servers. Weather data is cached locally for 30 minutes.
                </li>
              </ul>
            </Subsection>

            <Subsection title="4. Prompt sharing (optional — only if you share a prompt)">
              <ul>
                <li>
                  When you click &ldquo;Share&rdquo; on a prompt, the prompt&rsquo;s title, content,
                  description, and tags are sent to our web app to create a shareable link. No
                  personal identifying information is attached unless you choose to include it.
                </li>
              </ul>
            </Subsection>
          </Section>

          <Section title="Data We Do NOT Collect">
            <ul>
              <li>Your browsing history or visited URLs</li>
              <li>Tab titles, URLs, or session contents — all stored locally on your device only</li>
              <li>Passwords or payment card details</li>
              <li>Keystroke data or screen content</li>
            </ul>
          </Section>

          <Section title="Local Storage">
            <p>
              The following data is stored exclusively in your browser and never transmitted to any
              server:
            </p>
            <ul>
              <li>Saved sessions and auto-save history (IndexedDB)</li>
              <li>Bookmarks, notes, and todo lists (IndexedDB)</li>
              <li>Quick links, wallpapers, and widget layout (IndexedDB)</li>
              <li>Subscriptions and tab group templates (chrome.storage.local)</li>
              <li>Extension settings and preferences (chrome.storage.local)</li>
            </ul>
            <p>
              This data is cleared when you uninstall the extension or clear browser storage for the
              extension.
            </p>
          </Section>

          <Section title="Third-Party Services">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-700">
                  <th className="text-left py-2 pr-4 font-semibold text-stone-700 dark:text-stone-300">Service</th>
                  <th className="text-left py-2 pr-4 font-semibold text-stone-700 dark:text-stone-300">Purpose</th>
                  <th className="text-left py-2 font-semibold text-stone-700 dark:text-stone-300">Data sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                <tr>
                  <td className="py-2 pr-4 text-stone-600 dark:text-stone-400">Supabase</td>
                  <td className="py-2 pr-4 text-stone-600 dark:text-stone-400">Authentication &amp; usage limits</td>
                  <td className="py-2 text-stone-600 dark:text-stone-400">Email, action counts, guest ID</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-stone-600 dark:text-stone-400">Open-Meteo</td>
                  <td className="py-2 pr-4 text-stone-600 dark:text-stone-400">Weather forecast</td>
                  <td className="py-2 text-stone-600 dark:text-stone-400">GPS coordinates (if permitted)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-stone-600 dark:text-stone-400">ipinfo.io</td>
                  <td className="py-2 pr-4 text-stone-600 dark:text-stone-400">Geolocation fallback for weather</td>
                  <td className="py-2 text-stone-600 dark:text-stone-400">IP address (if no GPS permission)</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="Data Retention">
            <ul>
              <li>
                <strong>Local data</strong> — retained until you uninstall the extension or manually
                clear storage.
              </li>
              <li>
                <strong>Account data</strong> — retained until you delete your account. You can
                request deletion at any time by contacting us.
              </li>
              <li>
                <strong>Guest data</strong> — action usage counters associated with a guest ID are
                automatically cleared after 90 days of inactivity.
              </li>
            </ul>
          </Section>

          <Section title="Your Rights">
            <p>You can:</p>
            <ul>
              <li>Access and export your local data via the Import/Export feature in the extension.</li>
              <li>Delete your account and associated server-side data by contacting us.</li>
              <li>Disable the weather widget to prevent any location or IP data from being sent.</li>
              <li>Use the extension without creating an account — guest usage requires no personal data.</li>
            </ul>
          </Section>

          <Section title="Children's Privacy">
            <p>
              Browser Hub is not directed at children under 13. We do not knowingly collect personal
              information from children under 13.
            </p>
          </Section>

          <Section title="Changes to This Policy">
            <p>
              If we make material changes to this policy, we will update the effective date above and,
              where appropriate, notify users via the extension or the web app.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions or requests regarding your data can be sent to:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

        </div>

        <div className="mt-12 pt-8 border-t border-stone-200 dark:border-stone-800 text-sm text-stone-500 dark:text-stone-400">
          <Link href="/" className="hover:text-stone-700 dark:hover:text-stone-200 transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100 mb-3">{title}</h2>
      <div className="text-stone-700 dark:text-stone-300 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-medium text-stone-800 dark:text-stone-200 mb-2">{title}</h3>
      <div className="text-stone-700 dark:text-stone-300 leading-relaxed">{children}</div>
    </div>
  )
}
