# Yene Verify — Public Site Content Plan

Source of truth for all copy on `mekatanker.shop` (Phase 2+). Keep in `web/public/docs/`. Edited in the repo as TypeScript constants — no CMS.

Brand: Wise-style luxury fintech. Green `#16A34A` / accent `#00D54B`, Inter, 8pt grid, minimal + confident, Ethiopian context (ETB, CBE, Telebirr, etc.). No stock photos, no hype words ("revolutionary", "game-changing"). Bilingual EN primary, Amharic staged.

------------------------------------------------------------------
1. / — Landing page
------------------------------------------------------------------
Purpose: Convert merchants/prospects into waitlist signups and download interest. Single long page.

Sections (top to bottom):
- Header: logo (YV mark + "Yene Verify"), nav (How it works, Pricing, About, Contact), primary CTA "Get notified" → #download, language switcher EN / አማርኛ (EN active).
- Hero: kicker "Payment verification for Ethiopian businesses"; headline "Verify any Ethiopian bank payment. In seconds."; subhead (draft): "Capture a customer's payment receipt and we check it against official bank records — CBE, Telebirr, Awash, Dashen, Abyssinia, M-Pesa, Zemen. Know instantly if it's verified, fake, or duplicate, and keep a clean audit trail for your team." Primary CTA "Download the app" → #download (scroll); secondary "See how it works" → /how-it-works.
- Hero visual: verdict-screen screenshot placeholder (phone mockup) showing "Verified" result; replaced with Fuad's real screenshot in Phase 2.
- Trust bar: kicker "Works with Ethiopian banks & wallets"; chips CBE / Telebirr / Awash / Dashen / Abyssinia / M-Pesa / Zemen (text + colored dot fallback, no assets yet).
- Problem section: heading "The pain of fake receipts"; 3 pain points with icons:
  1. Fake receipts slip past staff at the till. — "A screenshot can look real. We check against the bank."
  2. Verification is slow and manual. — "Calling the bank costs minutes per customer."
  3. No audit trail for disputes. — "Every check is logged, dated, and exportable."
- Solution section: heading "Built for the till, not the back office"; 4 feature cards:
  - "Verify in under 10 seconds" — photo or upload → verdict in seconds.
  - "Detect duplicate receipts automatically" — reused receipts flagged before they cost you.
  - "Team management for branches" — sub-merchant access with controls the owner sets.
  - "Analytics that grow your business" — volume, outcomes, and trends per branch.
- How it works (summary): heading "Three steps to a verdict"; 3 steps with phone screenshots:
  1. Take a photo of the customer's payment.
  2. We check it against the bank's official records.
  3. Get Verified / Fake / Duplicate result instantly.
- Who it's for: heading "For Ethiopian businesses that take payments"; 4 use-case cards: Coffee shops & cafes, Restaurants, Retail shops, Delivery services & freelancers.
- Pricing (summary): heading "Simple plans, ETB pricing"; tier cards Free / Premium / Business / Business Pro from packages data; "Contact us → API Integration" row.
- Download (required, #download): heading "Get notified when we launch"; subhead "Yene Verify is preparing for Google Play. Leave your email and we'll tell you when it's live." WaitlistForm (email input + submit). States: idle / submitting / success ("Thanks! We'll be in touch.") / error. Android device mockup placeholder. Note: Play Store submission pending (Step 27) — primary state is coming-soon + email list.
- FAQ (summary): heading "Questions"; 6-8 Q&A (How does verification work? Does it work with all Ethiopian banks? Is my data safe? Do I need a special phone? How much does it cost? Can my employees use it? What happens if a receipt is fake? How do I get support?).
- Footer: logo + tagline "Verify Ethiopian bank payments in seconds."; columns Product (How it works, Pricing) / Company (About, Contact) / Support (Terms, Privacy); language switcher; contact support@mekatanker.shop; social links (only real ones — Telegram, LinkedIn, X if confirmed); "© 2026 Yene Verify. Made in Ethiopia."

Assets needed (Phase 2):
- Hero phone screenshot: verdict screen VERIFIED (Fuad's phone, hi-res).
- How-it-works screenshots ×3 (camera, checking, verdict).
- Verdict screenshots FAKE / DUPLICATE (FAQ + how-it-works).
- Android device mockup for download section.
- Bank wordmark fallback colors from shared/constants/bank-codes.json (fallbackColor).
- App icon (YV mark).

SEO:
- Title: "Yene Verify — Verify Ethiopian bank payments in seconds"
- Description: "Verify CBE, Telebirr, Awash, Dashen, Abyssinia, M-Pesa, and Zemen payment receipts instantly. Detect duplicates and fake receipts for Ethiopian businesses."
- OG image: hero verdict screenshot (generated later).
- sitemap.xml / robots.txt already scaffolded.

CTAs:
- Header "Get notified" → #download
- Hero primary "Download the app" → #download (scroll)
- Hero secondary "See how it works" → /how-it-works
- Download section WaitlistForm submit → POST /api/v1/waitlist
- Footer links → /terms, /privacy, /contact

------------------------------------------------------------------
2. /how-it-works
------------------------------------------------------------------
Purpose: Expanded visual walkthrough proving the product works with real screenshots.
Sections: hero intro, 3 expanded steps (each with screenshot + detail + "what the verdict means"), bank support table (7 banks with method + status), FAQ subset (verification-specific).
CTA: "Get notified" → #download (anchor) + link to /pricing.
SEO title: "How Yene Verify works — payment verification in 3 steps"
SEO desc: "See exactly how Yene Verify checks a payment receipt against official Ethiopian bank records and returns a Verified, Fake, or Duplicate verdict."
Assets: ×3 phone screenshots (camera, records check, verdict), bank method table.

------------------------------------------------------------------
3. /pricing
------------------------------------------------------------------
Purpose: Full pricing comparison table driving plan selection and waitlist/CTA.
Sections: hero intro, comparison table (Free / Premium / Business / Business Pro / API Integration) with price ETB, credits, features, CTA per tier, "Contact us → API Integration" row, FAQ subset (cost, employees, plans).
CTA: per-tier "Choose [plan]" → waitlist/download; "Contact sales" → /contact.
SEO title: "Yene Verify Pricing — ETB plans for Ethiopian businesses"
SEO desc: "Simple ETB pricing for verifying Ethiopian bank payments. Free, Premium, Business, Business Pro, and custom API Integration. Compare plans and get started."
Assets: none (uses packages.json data).

------------------------------------------------------------------
4. /about
------------------------------------------------------------------
Purpose: The story — why we built this, who it's for, the team (Fuad). Trust builder.
Sections: hero "About Yene Verify", "Why we built this" (problem → solution narrative in plain Amharic-friendly English), "Who it's for" (merchant segments), "Meet the team" (Fuad), "Built in Ethiopia" note.
CTA: "Get notified" → #download + link to /contact.
SEO title: "About Yene Verify — Ethiopian payment verification, built in Addis"
SEO desc: "Yene Verify helps Ethiopian businesses confirm bank and wallet payments, reduce fake receipts, and keep trusted records. Built in Ethiopia, for Ethiopia."
Assets: Fuad photo (optional, real — no stock).

------------------------------------------------------------------
5. /contact
------------------------------------------------------------------
Purpose: Lead capture + support. Form + support email + waitlist mention.
Sections: hero "Contact us", support email support@mekatanker.shop, contact form (name, business, email, message), waitlist note ("joining the launch list"), office/location note (Addis Ababa, Ethiopia).
CTA: form submit → placeholder (Phase 3: form handler); "Join waitlist" → /#download.
SEO title: "Contact Yene Verify — support@mekatanker.shop"
SEO desc: "Get in touch with Yene Verify. Support: support@mekatanker.shop. Join the launch waitlist for the Ethiopian payment verification app."
Assets: none.

------------------------------------------------------------------
6. /terms
------------------------------------------------------------------
Purpose: Legal terms of service (generic template, reviewed later).
Sections: effective date, acceptance, service description (best-effort verification), user responsibilities, disclaimer of warranties, limitation of liability, governing law, changes to terms, contact.
CTA: none.
SEO title: "Terms of Service — Yene Verify"
SEO desc: "Yene Verify Terms of Service. Effective 2026-11-08."

------------------------------------------------------------------
7. /privacy
------------------------------------------------------------------
Purpose: Privacy policy (generic template, reviewed later).
Sections: effective date, information collected, how it's used, sharing, security, retention, user rights, cookies, changes, contact.
CTA: none.
SEO title: "Privacy Policy — Yene Verify"
SEO desc: "Yene Verify Privacy Policy. Effective 2026-11-08."

------------------------------------------------------------------
Content decision
------------------------------------------------------------------
Stick with TypeScript constants (not MDX) for Phase 2: simpler, no build config changes, easy to type, and content volume is small. Re-evaluate MDX if copy grows beyond ~15 pages.
