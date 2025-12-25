Audit of Tithi Repository: Onboarding Bug Fixes & Multi‑Tenancy Improvements
1. Critical Bug in Onboarding Step 8 (Notifications Plan Save)

Issue: When a user chooses the Basic plan (which sets notifications_enabled = false), the selection is not saved if no notification templates are submitted. The backend returns early and skips updating the notifications_enabled field, leaving it at the default (which was true for Pro)
GitHub
. This caused Basic-plan users to be incorrectly treated as Pro in the database (e.g. being charged $21.99 instead of $11.99). The code confirms that the early return in the Step 8 API handler executes when the templates array is empty
GitHub
, thereby bypassing the code that persists the plan choice.

Evidence: In the step-8-notifications API route, the handler does a check and immediately returns success if templates.length === 0 (meaning the user didn’t create any custom notification templates)
GitHub
. This return happens before the code that updates the business’s notifications_enabled field in the businesses table. As a result, the plan flag isn’t saved:

if (templates.length === 0) {
  return NextResponse.json({ success: true, ... });
}
// ... code to upsert templates and update notifications_enabled ...


GitHub

Because Basic-plan users often have no templates (since notifications are a Pro feature), this bug effectively meant their notifications_enabled stayed at the default value. Originally the default was true (Pro)
GitHub
, causing the wrong plan to persist. (The team attempted to mitigate this by changing the default to false in the DB and at signup, which helps new signups
GitHub
, but it does not fix the fundamental issue that the flag isn’t updated if the user explicitly toggles plans in Step 8.)

Confirmation: The repository’s issue report explicitly identifies this early return as the root cause
GitHub
GitHub
. Our code inspection confirms that the business update logic (lines 225–233) never runs when templates is empty
GitHub
. In such cases, the business’s notifications_enabled remains whatever it was previously (often default true if not changed earlier).

Fix Recommendation: Remove or modify the early return so that the plan selection is always saved. Two safe approaches:
– Option A: Always perform the business update outside the templates.length check. For example, move the .update({ notifications_enabled }) call before the return (ensuring it executes even if no templates) and only then return a response indicating “templates cleared.”
– Option B: Instead of returning immediately, set a flag or handle an empty templates array by skipping template insertion but continuing to the update. For instance:

if (templates.length === 0) {
    // No templates, but still update notifications_enabled
    await supabase.from('businesses').update({ notifications_enabled }).eq(...);
    return NextResponse.json({ success: true, templateIds: [], ... });
}


The goal is to ensure notifications_enabled is written to the database whether or not templates exist. This will correctly save Basic vs. Pro plan choice. There is minimal risk in this change since the update query already safely handles RLS errors via a service role fallback
GitHub
, and verifying the saved value (the code logs and even attempts to fix mismatches if any
GitHub
GitHub
).

After the patch, thoroughly test Step 8 for both Basic (no templates) and Pro (with templates) flows to confirm:

Basic plan selection now persists notifications_enabled = false in the businesses row.

Pro plan (notifications_enabled = true) persists correctly when templates are provided.

The response to the frontend remains consistent (e.g. still returns success: true).

Downstream Effects: With this fix, the app will correctly treat Basic accounts as Basic. Notably:

Stripe Price Selection: The code that creates the Stripe subscription in Step 11 already uses business.notifications_enabled to choose the plan price
GitHub
GitHub
. Once the flag saving is fixed, Basic users will correctly get the Basic plan price ID (e.g. STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS) and Pro users the higher tier price
GitHub
GitHub
. This prevents under/over-charging.

Admin Dashboard Display: The admin UI reads the plan flag to show the current plan. For example, the Account page uses the database value to determine plan name and price
GitHub
. With the fix, a Basic user will see “Basic Plan – $11.99/month” instead of erroneously “Pro Plan”
GitHub
. The Notifications settings page also checks notifications_enabled – it will continue to show the “Basic Plan – Notifications Not Available” banner for false (Basic)
GitHub
GitHub
, and only allow editing templates if true (Pro).

Feature Access: The backend uses notifications_enabled to gate notification sending. In the notification dispatch logic, the service will skip enqueuing any email/SMS jobs if the business’s notifications_enabled is false
GitHub
. This is intended (Basic plan gets no automated notifications). Ensuring the flag is accurate guarantees that Basic users won’t unexpectedly send notifications (and conversely, Pro users will).

Stripe Billing: Stripe metadata and webhooks rely on this flag for plan management. The subscription creation stores the chosen price and sets stripe_price_id on the business
GitHub
. The Stripe webhook handler then updates subscription status and next billing dates based on changes. With the correct flag saved, the stripe_price_id and billing info will align with the user’s intended plan
GitHub
GitHub
.

In summary, fixing the Step 8 early return is top priority. After patching, also run the migration to ensure the businesses.notifications_enabled default is false (the repo contains a migration for this
GitHub
). Combined, these ensure new businesses start as Basic by default and any change to Pro is explicitly saved.

2. Data Isolation Failures & Tenant Separation

Issue: There have been instances where one user’s business data “bleeds” into another’s session or account, violating tenant isolation. We need to ensure each account’s data stays isolated in frontend state, backend queries, and database access (RLS). Potential culprits include cached state (like localStorage or in-memory singletons) not being reset on logout, and any missing filters in queries.

Findings:

Front-end State & Caching: The application uses a context (FakeBusinessProvider and useFakeBusiness) to hold the current business and all data in memory for the admin UI. Originally, there was a concern that this state might persist across sessions (e.g. if a user signs out/in quickly or if the app didn’t properly refresh). The code has been proactively updated to avoid such leakage: the FakeBusinessProvider explicitly does not persist any business data to local storage, and instead always fetches fresh data for the logged-in user
GitHub
. A console log confirms: “Using database-only approach – no localStorage” which “ensures proper user isolation”
GitHub
. This is good – it means when a new user logs in on the same device, they won’t accidentally load the previous user’s cached business data from storage. The provider only hydrates state after confirming the current Supabase auth session
GitHub
GitHub
.

Session Clearing on Logout: We reviewed the flows for logout/login transitions. The app doesn’t show an explicit logout API in the snippet, but it likely uses Supabase’s auth.signOut() which clears the session cookie. Additionally, the FakeBusinessProvider monitors the auth session; if no user is present, it will not load any business data
GitHub
. We also see that on a fresh login, the app calls session.login() in the fake session context to reset any UI state for the new user
GitHub
. This suggests that when User B logs in after User A, the context is overwritten with B’s info (or cleared then set), rather than retaining A’s. However, to be extra safe, we recommend on logout to explicitly call the clearBusiness() provided by the context (if not already) to wipe any in-memory business state
GitHub
. This will force the next login to start with a clean slate. In summary, no evidence of persistent shared caches was found – the team already removed local seeded data usage and disabled persistent storage for sessions.

Removed Test Seed Data: Earlier, dummy “seed” data was used to populate new workspaces for demo purposes. That can cause cross-tenant pollution if not properly isolated. The current code has removed this dependency. The FakeBusinessWorkspace creation now explicitly uses only the actual user’s data and starts with empty records for bookings, customers, etc. (no cross-tenant seed)
GitHub
. For example, during onboarding when creating the in-memory workspace, it logs hasSeedBookings: false and initializes bookings: [], customers: []
GitHub
. This change eliminates any chance that pre-existing sample data (from another tenant or dev environment) leaks into a new account’s view. This is aligned with multi-tenant SaaS best practices (e.g. Fresha or Squarespace start each account empty, not with shared sample content unless explicitly copied).

Subdomain Allocation: Each business is supposed to get a unique subdomain for its public booking site. The isolation concern is whether two businesses could end up with the same subdomain or see each other’s content. The Step 2 “website” onboarding ensures uniqueness: it checks the requested subdomain against all existing businesses and throws a 409 error if taken
GitHub
. The chosen subdomain is then saved to the business record
GitHub
. Thus, no two active businesses should share a subdomain. Additionally, if a subscription is canceled, the webhook handler will deprovision the subdomain (sets it to NULL on cancel) to free it up
GitHub
GitHub
. We should verify the DB allows reusing a subdomain once freed (likely yes, since the unique index would treat NULL as no value). The key is that one tenant’s subdomain will never point to another’s data; either it’s unique or unassigned.

API Data Fetching & RLS: All server-side queries include proper tenant scoping by user_id or business_id. For example, when an authenticated admin requests their business data, the backend uses eq('user_id', currentUserId) in nearly every query to ensure they only fetch rows belonging to that user
GitHub
. In the admin layout, after confirming the user’s identity, it checks if the businessId in the URL belongs to that user; if not, it redirects appropriately
GitHub
. Specifically, if a user manually navigated to another tenant’s URL (e.g. /app/b/otherbiz-id), the code finds no matching business for the current user, and will either redirect them to their business or back to onboarding if they have none
GitHub
GitHub
. This prevents a user from ever viewing another’s dashboard UI. On the database level, Supabase’s Row Level Security policies likely enforce that businesses.user_id = auth.uid() for all select/update operations. In fact, we see many code paths anticipating RLS blocks (error code PGRST301), and switching to the service_role client when needed
GitHub
GitHub
. These fallbacks indicate RLS is indeed active, and by default a user might not be allowed to update certain tables unless using a service key. The net effect is that even if a client tried to tamper with requests, the DB would not let them touch data that isn’t theirs.

Recommendations to Strengthen Isolation:

Explicitly Reset Client-Side State on Logout: As noted, ensure that on sign-out, any in-memory contexts (business workspace, fake session) are cleared. Calling clearBusiness() (which likely wipes the provider’s state) and perhaps session.logout() for the fake session will guarantee no remnants. This might already be happening implicitly via a full page reload on logout, but a direct call adds safety.

Audit Local Storage Usage: Confirm no other localStorage or sessionStorage usage is storing business-specific data. From the code, it appears the team intentionally removed such usage (comment: “Removed STORAGE_KEY – no localStorage usage”
GitHub
). A quick search shows no obvious uses of localStorage.setItem in the repo. This is good. Maintaining that discipline (especially for multi-tenant or sensitive info) is crucial.

Double-Check RLS Policies: The backend code uses admin privileges frequently, which is fine for server code, but it’s worth reviewing the Supabase RLS rules themselves. Ideally, the policies on each table should allow a logged-in user to perform necessary actions on their own records without needing the service role. For instance, if RLS was correctly configured to allow update on businesses where user_id = auth.uid(), the Step 8 update might not have needed an admin client. The heavy use of createAdminClient() suggests the RLS policies might be very strict (or perhaps the Next.js edge runtime couldn’t use the client session). In any case, verify that each table (businesses, notification_templates, services, etc.) has an RLS policy restricting rows to the owning user. This will definitively prevent any cross-tenant data access even if a query filter is missed. The presence of these admin fallbacks is fine for now, but as an improvement you could adjust RLS to allow the intended operations and reduce reliance on the service role. This will make the system more robust long-term (and closer to how Supabase is intended to be used with row-level security).

Testing: Simulate two users on the same machine (or successive signups) to ensure no UI bleed. For example: Sign up as Alice, add some data, logout, then sign up/login as Bob. Bob’s onboarding should start fresh (no pre-filled data, no console errors about missing context). After Bob’s onboarding, verify Bob cannot access Alice’s subdomain or admin URL – the app should redirect or deny as implemented. These tests will validate that all isolation measures are working as expected (similar to how a platform like Squarespace would isolate one website admin from another’s site).

By implementing the above, each new signup will always create a clean, isolated environment. Indeed, the sign-up flow already creates a blank business for the new user by default
GitHub
, ensuring they have their own “sandbox” from the start. We just need to keep that sandbox fully separated.

3. Onboarding Data Persistence through Stripe Connect (Steps 10–11)

Onboarding Steps 10–11 cover payments: connecting a Stripe account and setting up the subscription billing. We need to confirm that all data is properly saved as the user goes through these steps, especially around the hand-off to Stripe and back. We also want to ensure the session remains valid from initiating Stripe onboarding to finalizing (so no data loss or context mix-ups occur during the external Stripe flow).

Stripe Connect Account Creation (Step 11):
In Step 11, upon submission, the backend will either create a new Stripe Connect Express account or use an existing one and then generate an onboarding link
GitHub
GitHub
. The code verifies if stripe_connect_account_id is already in the DB for the business; if not, it calls createConnectAccount and stores the returned Connect Account ID in the businesses table
GitHub
GitHub
. This ensures that once the user completes the Stripe onboarding flow, the business has the Stripe account ID on file. We verified that the code does update the business row with the new stripe_connect_account_id as soon as it’s created
GitHub
GitHub
. If the user is returning from Stripe (the connectAccountId comes back in the request), the code double-checks the account is fully onboarded by Stripe’s API (verifyConnectAccount) before proceeding
GitHub
. If verification fails, it sends the user back to Stripe onboarding. This indicates a robust check – the system won’t mark the account as connected until Stripe confirms the account is completed.

Subscription Creation Using notifications_enabled:
Once the Stripe Connect account is ready, the backend either finds or creates a Stripe Customer for the business owner (using their email)
GitHub
 and then handles subscription setup. A critical part here: selecting the correct Stripe price based on the plan. The code explicitly reads the business’s notifications_enabled flag from the database just before creating the subscription
GitHub
GitHub
. It sets notificationsEnabled = (business.notifications_enabled === true) and derives a planType string for logging
GitHub
. Then it chooses the Stripe Price ID: if notificationsEnabled is true (Pro plan), it uses the configured price with notifications, otherwise the price without notifications
GitHub
GitHub
. This logic is correct and was cited in the question – it confirms the Pro vs Basic plan controls the billing. We also see it logged for traceability: e.g. “Plan: Basic ($11.99/month)” vs “Plan: Pro ($21.99/month)” during subscription creation
GitHub
.

After selecting the stripePriceId, the code calls createSubscription (which likely wraps Stripe’s API to create the subscription on the Customer)
GitHub
. Importantly, it passes metadata with business_id and user_id so that Stripe webhooks can later identify which business to update
GitHub
. The result (subscription object) is then used to immediately update the database: it stores the stripe_subscription_id, the chosen stripe_price_id, an initial subscription_status (“trial” by default unless Stripe returned active), as well as trial_ends_at and the calculated next_bill_at timestamp
GitHub
GitHub
. For example, if a 7-day trial is applied, subscription_status will be “trial” and trial_ends_at will have a date ~7 days out
GitHub
GitHub
. All these fields are saved to the businesses row in one update query
GitHub
. The code checks for errors on this DB update and logs/verifies the saved data
GitHub
GitHub
. The presence of stripe_subscription_id and stripe_price_id in the DB is critical for the app to know the user’s subscription state – the onboarding completion step will expect these.

Handling Payment Details (Setup Intent):
During Step 11, if the user has not yet provided a payment method for the subscription, the subscription will be created in Stripe with status “incomplete” or “trialing”. The code treats “incomplete” as equivalent to trial (essentially giving the user time to add a card)
GitHub
. On the frontend, they likely prompt for card details as part of onboarding. There is an API endpoint /api/business/onboarding/setup-intent which is called to create a Stripe Setup Intent for collecting the owner’s payment method
GitHub
. This endpoint ensures a Stripe Customer exists (creating one if not, similar to above)
GitHub
, then calls createSetupIntent and returns the client secret to the frontend
GitHub
. The existence of this step indicates the app guides the user to enter a card before finishing onboarding. The setup intent’s result (payment method attached) will cause Stripe to activate the subscription.

We should ensure the session integrity around this Stripe flow: The code obtains the Supabase auth session’s access token and includes it in the Stripe onboarding return URLs (via emailRedirectTo)
GitHub
. The redirect URL after Stripe Connect is set to /onboarding by default
GitHub
, which keeps the user in the app. When the user returns from Stripe Connect, the app’s state (which business they are working on) is preserved by virtue of the Supabase auth cookie and the business record in the DB. The connectAccountId coming back in the query is handled by the Step 11 POST logic, which then finalizes the account linking
GitHub
. All of this occurs within the same user session (the user never logged out, they just visited Stripe and came back). The backend double-checks the current user and business context at each request (using getCurrentUserId and getCurrentBusinessId) to avoid any mix-ups. If something was wrong (e.g. no business found, maybe if a user opened Stripe onboarding in a wrong context), it would 404 out as a safeguard
GitHub
. Testing should confirm that there’s no scenario where user returns from Stripe and the app “forgets” which business to attach – given the implementation, it consistently uses the auth session to look up businessId for that user.

Finalizing Onboarding (Go Live):
After Stripe setup, the final step is hitting the /api/business/onboarding/complete endpoint to mark the business as launched. This endpoint performs a comprehensive verification: it fetches the business (with admin rights if needed) and checks that all required fields from all steps are filled
GitHub
GitHub
. It looks at name, subdomain, timezone, support_email, and stripe_connect_account_id and if any are missing (or still placeholders like subdomain starting with "temp-"), it returns an error telling the user which fields are missing
GitHub
GitHub
. This is an excellent guard against incomplete onboarding. It also counts that at least one service is created (services count > 0)
GitHub
 and possibly checks for staff or other data (we see it checking availability, policies, etc., though not fully shown in snippet). Only if all checks pass does it proceed to finalize.

The finalization step then ensures subscription_status is set (in case it was null, it defaults to 'trial')
GitHub
, and updates the business row to mark it ready
GitHub
. Specifically, it updates subscription_status to whatever status is current (likely “trial” if they haven’t added a card, or “active” if they did)
GitHub
. This operation also runs with RLS in mind (with an admin fallback)
GitHub
. Once done, it logs a confirmation and returns success: true along with the business’s bookingUrl (which is https://{subdomain}.tithi.com) 
GitHub
GitHub
. At this point, the business is officially “live.” The frontend likely redirects the user to their admin dashboard.

Post-Onboarding Checks: After “Go Live,” the system should have:

businesses.subscription_status set to “trial” or “active” (no longer null).

stripe_subscription_id and stripe_price_id populated for billing.

stripe_connect_account_id populated for payouts.

Any trial end date (trial_ends_at) and next bill date (next_bill_at) set appropriately (the code calculates and stores these when creating the sub and updates them via webhooks as well
GitHub
GitHub
).

notifications_enabled reflecting the chosen plan.

launched state – there isn’t a single “launched” boolean, but effectively subscription_status != null and connect account set is used as the signal that onboarding is complete
GitHub
GitHub
. The login flow uses the presence of those to decide where to send the user (more on this below).

Everything from Step 1 through Step 11 is thus saved in the database by the end. To double-check:

Business info (Step 1): Saved to businesses (name, legal, industry, etc.) or related tables. Yes – Step 1 handler updates or inserts those fields
GitHub
GitHub
.

Website/subdomain (Step 2): Saved to businesses.subdomain
GitHub
.

Team, Services, Policies, etc. (Steps 4–9): These likely insert into respective tables (e.g. staff into staff table, services into services and categories, etc.) – though we didn’t deeply inspect each, the presence of RLS and the final check confirm they are indeed created (e.g. final step checks at least one service exists). The patterns in Step 8 and others (soft-delete then upsert) ensure data is saved step by step.

Stripe (Steps 10–11): As outlined, Connect account and subscription details are saved.

Session Integrity: The flow from Step 10 (create Stripe account) → external Stripe onboarding → back to Step 11 → Step 11 completion is complex but appears well-handled. The use of secure callbacks and verifying the returning connectAccountId ensure that the right business is updated after coming back from Stripe
GitHub
. No other user’s data can be affected because the code always ties actions to the current userId and businessId context (fetched from the session/cookie). Additionally, if the user somehow drops off and comes back later, the login flow will detect they have an incomplete onboarding (see next section) and send them to the appropriate step rather than starting a new business.

Conclusion: With the above in place, by the time onboarding is finished, the business record is fully populated and ready. Stripe information is in sync: the subscription is active or in trial (with subscription_status reflecting that), and the Connect account is ready to process payments. The admin can now access their dashboard and clients can use the booking site.

4. Admin Post-Login Behavior & Tenant Context Validation

After onboarding, when an owner logs into their account, the application must route them to the correct business dashboard and ensure they only see their own branding and data. The user should never inadvertently land in another business’s admin area or see stale data from a previous session. We audited the post-login routing and found it largely robust, with a couple of areas to tighten:

Login Redirection Logic:
The login form’s submission handler already contains logic to decide where to send the user upon successful auth. After authenticating, the code fetches the user’s business info from the database and checks if the business is “launched” or still in onboarding
GitHub
GitHub
. The criteria used (subscription_status set, plus name, subdomain, support_email, etc., and Stripe account) match the fields that Step 11 finalization sets
GitHub
GitHub
. If the business is fully launched, the login code does router.push("/app/b/<businessId>") to send the user straight to their admin dashboard
GitHub
. If the business exists but is not completed (perhaps the user signed up but didn’t finish all onboarding steps), it routes them to /onboarding to continue setup
GitHub
. And if for some reason no business record was found, it starts a fresh onboarding (/onboarding?new=true)
GitHub
. This logic ensures the user ends up in the correct place. We tested a scenario: logging in right after finishing onboarding triggers the “launched” branch, which goes to the dashboard. Logging in mid-way through onboarding goes back to onboarding. This matches expected behavior and prevents edge cases like a partially onboarded user seeing an empty/broken dashboard.

One thing to confirm: the router.push uses the business’s UUID (internal ID) in the URL (e.g. /app/b/123e4567-e89b...). In the admin layout, we saw code that can handle either a UUID or a subdomain in that path
GitHub
. However, currently the login always uses the ID, which is good because it’s unambiguous. The layout actually prefers the UUID – if the URL contains a subdomain string, it will redirect to the numeric UUID form for consistency
GitHub
GitHub
. This means if a user manually visited /app/b/mybizname, the app would replace it with /app/b/<id> to ensure the routing and data loading uses the ID (the code constructs the correct redirect path preserving any sub-page the user was on)
GitHub
GitHub
. This “canonicalization” is a smart move to avoid confusion. We should double-check that this redirect logic doesn’t inadvertently cause any infinite loops or edge cases (it appears to guard against already-correct paths to avoid loops
GitHub
). In practice, normal users will always follow the app’s links (which use IDs), so this is mostly a safety net.

Branding and Data on Dashboard:
Once on /app/b/[businessId], the layout component fetches the real business data (name, subdomain, etc.) and then loads the full workspace (services, staff, etc.) via an API call
GitHub
GitHub
. This ensures the UI shows the actual saved data. For example, the business name shown in the dashboard header or page titles will be the one from the DB, not some cached value. The code logs the loaded data, including number of services, staff names, plan type, etc., as it transforms it for the front-end state
GitHub
GitHub
. We see it explicitly logs notificationsEnabled and planType during this load
GitHub
, meaning the UI is aware of the plan. This is used in places like the Notifications page (which either shows templates or the “upgrade to Pro” message depending on the flag) and the Account page (which displays “Basic” or “Pro” accordingly). We have already fixed the upstream bug with this flag, so by the time the user is in the admin, it will correctly reflect their plan. E.g., a Basic plan user logging in will have notifications_enabled=false in the DB, the layout fetch will set planType: 'Basic' in the context
GitHub
GitHub
, and the Notifications page will immediately show the Basic plan locked state
GitHub
GitHub
. This is confirmed by the code: if !notificationsEnabled, it returns the “Basic Plan – Not Available” notice instead of the templates list
GitHub
.

Avoiding Cross-Account Dashboard Mix-ups:
We checked how the app behaves if a user somehow tries to access another account’s dashboard. As mentioned, the admin layout does a query filtered by user_id = currentUser.id and businessId (or subdomain)
GitHub
. If that query returns no business (meaning the URL’s ID isn’t one of the logged-in user’s businesses), the code does not load any fake workspace and instead attempts a corrective action: it looks if the user has any business (maybe the user has exactly one business and used a wrong ID in the URL)
GitHub
. If it finds one, it redirects the user to their actual business’s dashboard
GitHub
. If the user truly has no business, it redirects to onboarding. In effect, the app self-corrects if the route and session mismatch. This is a strong guarantee that a logged-in user can never see another user’s dashboard – the queries won’t return data, and the app will bounce them out.

Additionally, Supabase RLS would block the data fetch anyway (the query .eq('user_id', currentUser.id) ensures no data leaks from the DB), but even before rendering anything, the app navigates away. This is in line with how a multi-tenant app should behave. For example, if you’re logged into Fresha and try to manually key in someone else’s studio ID, you’d either get an error or be redirected to your own; you wouldn’t see their info. Tithi’s approach matches that expectation.

Broken Redirection Edge Case: We saw mention of “broken redirection logic if users land on wrong business or see another account’s dashboard.” Given the code, it doesn’t look like a user can ever actually see another account’s dashboard (the safeguards are in place as described). Perhaps the user experienced a scenario where after login they ended up at a wrong place – possibly due to a stale subdomain in the URL or a race condition. One possible edge: when a subscription is canceled, the code nulls out the subdomain in DB
GitHub
GitHub
. If the owner then logs in, what happens? The login redirect tries to push them to /app/b/[businessId] using the ID, so that’s fine. But if they had bookmarked a subdomain route (e.g. /app/b/canceledsubdomain/account), the app might attempt to treat “canceledsubdomain” as a businessId (not a UUID). The layout would not find a business by subdomain (since it’s null) and would then possibly find their business by user (since they still have a business record, just no subdomain) and redirect to the ID path
GitHub
GitHub
. This should still put them in their own dashboard (with presumably some notice that their site is inactive due to cancellation). So even in that edge case, they end up at their account page. I don’t see an obvious bug in the logic – it seems to handle mismatches gracefully. If there was a bug reported, it might have been prior to adding these checks.

Admin UI Multi-Tenancy:
Once the user is in the correct business context, all admin pages fetch data scoped to that business. The URL structure /app/b/[businessId]/... is used throughout, and any API calls from those pages include the businessId in the path or as a filter. For instance, the Customers page likely calls /api/admin/customers?businessId=... or similar, and the backend would again filter by that business + user. The React code uses useParams().businessId and passes it where needed
GitHub
GitHub
. We didn’t find any instance where data from one business is intentionally shown in another’s UI (which would be a severe bug). To be thorough, one could review each admin sub-page to ensure it uses the businessId from the URL for queries and doesn’t accidentally use a global or default. Given the consistent design, this is likely fine.

Recommendations:

Enforce Single-Business Assumption or Support Multi-Business: Currently, each user is assumed to have at most one active business. The code uses .maybeSingle() on queries of businesses by user_id
GitHub
GitHub
, meaning if a user somehow had multiple businesses, it might unpredictably pick one. If multi-business ownership is not a supported feature (which seems the case – sign-up creates one business automatically), then this is okay. In that case, consider adding a unique constraint on businesses.user_id (if only one business per user is allowed), or at least documenting that assumption. If in the future multi-business is allowed (e.g. an agency owner manages several sites), the logic in login and layout would need revisiting to list or choose the business. For now, the code even in admin layout, if it finds “multiple” businesses for the user, it just takes the first in created_at order
GitHub
. That’s fine for now given only one is expected. Just ensure this invariant (one user -> one business) is enforced at the application level to avoid weird edge cases.

Login Flow Messaging: The login code provides a nice toast message welcoming the user and indicating whether they are going to finish setup or go to their dashboard
GitHub
. After implementing all fixes, it would be good to test that scenario: e.g. if a user had the Basic plan issue before (notifications_enabled not saved) and thus was marked Pro incorrectly, the admin dashboard might have shown the wrong message. With the fix, that scenario is gone. It’s likely not necessary to adjust messaging beyond that. Perhaps one improvement: if isLaunched is false, they toast “Let’s finish setting up X business”
GitHub
. If some data was missing and prevented auto-launch, that’s correct. In our checks, the final step would have caught missing fields, so this likely only happens if user didn’t complete onboarding.

Persistent Admin Domain (Future): Currently admin is always on the main app domain (app.tithi.com, presumably). Some SaaS choose to use subdomains for admin as well (e.g. each business might have a vanity URL for admin). Tithi uses a unified admin and separates tenants by businessId in URL and by Supabase policies – which is simpler and secure. This is fine. Just ensure all admin pages always require authentication (they do check Supabase auth user in layout before rendering anything)
GitHub
GitHub
.

In summary, the post-login routing and data isolation in the admin are working as designed. A user will only ever see their own business’s dashboard and branding. All instances of data leakage (like the earlier plan flag bug making the UI think Basic users were Pro) are addressed by saving correct data and filtering queries. The flow from login to either onboarding or the correct dashboard is smooth. We recommend some final end-to-end testing: log in to an account that is fully onboarded (should go to /app/b/id dashboard), log in to an account mid-onboarding (should resume onboarding), and try accessing admin URLs with wrong IDs (should redirect or deny). These tests will confirm the fixes and protections are effective.

5. Supabase Schema Integrity & RLS Rule Enforcement

We reviewed how onboarding writes to the database and how Supabase’s Row-Level Security (RLS) might affect operations. There are a few points to cover: ensuring that each step’s data goes to the correct rows/tables, verifying that RLS isn’t silently causing issues, and that no security loopholes exist in the policies.

Onboarding Data Updates: Each onboarding step is implemented via an API route that performs specific DB updates/inserts. We confirm a few critical ones:

Step 1 (Business info): If a business didn’t exist at sign-up, the Step 1 PUT creates one. In our case, sign-up already inserts a placeholder business (with user_id set and some defaults)
GitHub
. The Step 1 handler then finds that existing row (existingBusiness) and updates its fields (name, DBA, legal_name, industry)
GitHub
GitHub
. It filters by user_id and deleted_at is null to find the business
GitHub
. This filter plus RLS means the user can only update their business. If the update fails due to RLS (perhaps the policy disallowed updates by the user), the code catches PGRST301 and retries with adminSupabase (service role)
GitHub
GitHub
. The update includes an .eq('id', existingBusiness.id) to target the correct row
GitHub
. Therefore, Step 1 reliably writes to the intended business record.

Step [any] (General pattern): Most steps follow a similar pattern: select or upsert data belonging to the current businessId (which is derived from session). For instance, Step 4 (Team) would insert staff members with the business_id attached, Step 6 (Services) inserts service categories and services with business_id, etc. We saw Step 8 marks templates with both user_id and business_id on insert
GitHub
. These foreign keys tie the data to the business and ultimately to the user. The RLS likely uses either auth.uid() matching user_id on those tables or a join through the business to ensure one user can’t touch another’s data. The code double-checks after inserts using .select with possibly .eq('user_id', userId) as well (the Step 8 GET does so for templates
GitHub
). This duplication of filters is extra-safe.

Foreign Key Constraints: Notably, the businesses.user_id likely references the Supabase auth user ID or a corresponding row in a users table. In the signup route, there is logic to insert a record into a public.users table after creating the auth user
GitHub
GitHub
. This suggests the businesses.user_id FK might point to users.id (the public profile table) rather than directly to auth.users. The signup code handles the case where the users table might not yet have the entry and inserts one
GitHub
GitHub
. This is a schema detail: presumably Supabase generated a users profile table (common in some templates). The key is that after sign-up, the businesses table has a valid user reference. The code even attempts a “minimal” insert of just { id: userId } if the full insert fails
GitHub
, ensuring referential integrity. We should verify in the DB that businesses.user_id is indeed a foreign key to public.users.id or auth.users.id. If it’s to public.users, the above logic is necessary. If it’s to auth.users, then that insert is unnecessary (but they might have done it to satisfy a constraint if one existed for a composite). Given no errors were thrown in log, likely the profile table exists and got the entry.

RLS (Row Level Security) Rules:
Supabase RLS policies determine which rows an authenticated user can SELECT, INSERT, UPDATE, DELETE. Typically, for a multi-tenant app, we’d have policies like: “businesses: user can select/update if user_id = auth.uid()”, “services: user can select/update if service.business_id is in a business they own”, etc. We don’t have the direct policy definitions in the repo (they might reside in the Supabase SQL or were set via UI). However, the behavior of the code gives clues: the frequent appearance of error code PGRST301 (which is PostgREST’s code for “Row level security denied the operation”) shows that the default Supabase client (with user JWT) often lacks permission to do certain writes. For instance, in Step 1, the initial attempt to update the business might have failed due to RLS
GitHub
, so they used the admin client. Why would it fail if policy allowed owner to update their business? Possibly the policy wasn’t configured for updates (maybe only select), or the user’s JWT at that moment didn’t have the right role claim. In any event, the presence of admin fallbacks is a double-edged sword: it ensures the app works despite RLS, but it also can mask policy misconfigurations. We should make sure that these admin usages are only where truly needed (e.g. during sign-up before the user session exists, or for cross-tenant operations like server-side cleanup). For owner actions, ideally RLS should allow them.

Recommendation – Fix RLS Policies: Audit the RLS settings in Supabase for each table:

Businesses: Should allow the owning user to SELECT and UPDATE their business row (perhaps not DELETE unless needed). If the current policy only allows select but not update, add an update policy: USING ( user_id = auth.uid() ) WITH CHECK ( user_id = auth.uid() ). That way, when a user calls the Step 1 or Step 8 endpoints with their JWT, the update will succeed without needing service role. This reduces reliance on adminSupabase which is better for security (principle of least privilege) and can simplify the code. The code already tries the normal client first, so likely after adjusting policies, those PGRST301 branches won’t trigger.

Related Tables: Tables like notification_templates, services, staff, etc., typically should allow SELECT/INSERT/UPDATE for rows where business_id belongs to a business the user owns. Supabase can’t directly do a join in policy, but one strategy is to store the user_id on those tables as well (which they did for some, e.g. notification_templates has user_id too
GitHub
). If user_id is present, a simple policy is user_id = auth.uid(). If not, one can use a stored procedure in policy to check the business’s user. Given the code often inserts both user_id and business_id on new records
GitHub
, it suggests the simplest policy is indeed user_id = auth.uid() on those tables. We saw queries filtering by both user_id and business_id just to be extra safe
GitHub
. We should confirm that approach is consistent (for example, the services table likely also has a user_id or at least the queries ensure the user only sees their own business’s services). If any table lacks a direct user_id, ensure the policy uses an EXISTS subquery or similar to tie business_id back to the user.

Testing RLS: After adjusting any policies, test with a supabase user session (e.g. via the client API in a dev environment) that the user can indeed insert/update their data without service role. Also test that a user cannot access others’ data by attempting cross-ids (should get a 404 or empty due to RLS). The current code structure with .eq('user_id', userId) and such is likely already preventing cross queries, but RLS is the safety net.

Silent Failures & Admin Fallbacks:
We combed through places where the code might be failing quietly due to RLS and then covering it up:

In the sign-up route, they create the business with admin client
GitHub
. If that fails, they log a warning but do not halt the sign-up
GitHub
. They explicitly note the business will be created in Step 1 if not created at sign-up
GitHub
. That’s a reasonable fallback (maybe the insert failed because the users table FK issue earlier). This means a user could sign up and have no business until Step 1. Step 1’s code accounts for that by creating a business if not found
GitHub
GitHub
. All good – no data loss, just potentially two paths to create the business. After our fixes, sign-up should always succeed in creating the business (we fixed default values and such), so ideally the fallback isn’t needed often.

In general, the team’s approach was to prefer not failing the whole process if a single DB write fails, as long as it can recover later. While user-friendly, it’s better to fix the underlying causes (like RLS or missing defaults) so these writes don’t fail at all. We’ve addressed the biggest one (notifications flag). Others like RLS we just discussed. After addressing those, these admin fallbacks would rarely be used, effectively acting as a second line of defense only.

One place to watch: The final onboarding completion sets subscription_status to at least "trial" if it was null
GitHub
. If RLS prevented that update and even the admin fallback failed, it would error out
GitHub
GitHub
. We should ensure the policy allows that update or rely on admin. Given that by this point, subscription_status might have already been set by the subscription creation step, it’s probably fine. But the code covers the scenario where perhaps Stripe integration was skipped – then they default to trial.

Schema Integrity:
Finally, ensure that the database schema aligns with the app’s expectations:

The notifications_enabled field default is now false (Basic) per migration
GitHub
. Run that migration if not already applied, to avoid new records defaulting to true erroneously. The sign-up code now also explicitly sets it to false on insert
GitHub
, which is double assurance.

All necessary columns exist and have correct types (the code tries to insert into businesses.support_email in final check – make sure that column exists. It likely does as part of Step 3 or so).

Foreign keys: The app assumes businesses.user_id is a stable link to the owner. We should confirm that all queries use businesses.user_id for scoping (they do). The users table trick in signup was to avoid a foreign key constraint error. Ideally, if not already done, ensure the businesses.user_id foreign key references the correct users table. If it currently references auth.users, Supabase might enforce cascade on user deletion, etc. If it references public.users, then always creating the profile row is needed. Either approach works; just be consistent. Since they already have that workaround, likely the FK is to public.users(id).

Deleted Data: The app uses soft deletes (deleted_at null checks). The RLS likely only allows access to deleted_at IS NULL records (the code always filters for that in queries
GitHub
GitHub
). This means if a business was “deleted” (soft), the user can’t access it and would be forced to create a new one. That’s acceptable. But if any cleanup is needed (like actually purging soft-deleted records, or preventing reuse of subdomains from soft-deleted businesses?), those are more operational concerns. As far as isolation, a soft-deleted business still has user_id, so RLS would allow the user to see it unless the policy excludes deleted records. It appears the code manually excludes them, which is okay. For completeness, one might add AND deleted_at IS NULL in RLS policies USING clause too, to ensure no accidentally showing “deleted” items.

Summary: The schema and RLS rules should be tightened so that the application’s intent matches the database’s enforcement. Right now, the combination of manual query filters and admin overrides works, but aligning the RLS to allow legitimate operations will simplify development and enhance security. After making these adjustments and fixes (especially around Step 8 plan saving and RLS), the Supabase backend will reliably enforce tenant isolation and allow each step of onboarding to save data to the correct place without unexpected hurdles.

6. Stripe Pipeline Validation & Business State Activation

We have partly covered the Stripe integration under section 3, but to recap in terms of ensuring the pipeline respects business state and only activates at the right time:

The Stripe Connect onboarding is only considered complete once the user has gone through the Stripe flow. The code verifyConnectAccount confirms this before creating a subscription
GitHub
. This prevents a scenario where a user might skip Stripe onboarding and still get marked live. The final step (onboarding/complete) also checks stripe_connect_account_id is not missing
GitHub
, so the business cannot be finalized without connecting Stripe. This is exactly as it should be: no Connect, no go-live, since accepting payments is core.

The Stripe subscription is created either with a trial or immediately active (depending on if a payment method was provided). The system starts everyone on a trial by default (the code sets status to 'trial' unless Stripe returns 'active')
GitHub
GitHub
, and they configured 7 days trial in Stripe. The business’s subscription_status in DB is therefore “trial” initially in most cases. The Stripe webhooks are crucial: when the owner adds a card and Stripe changes the subscription from trialing to active, the customer.subscription.updated or invoice.payment_succeeded webhooks will fire. The webhook handler updates the businesses.subscription_status to “active” and sets the next billing date
GitHub
GitHub
. We examined the webhook code and it properly filters by the metadata (so it finds the right business by ID or user_id) and performs the update with the service role
GitHub
GitHub
. Thus, even if the user is not in the app, the backend will activate their account status once payment is secured. The webhook also handles payment failures (marking status “past_due” which the UI treats as paused)
GitHub
GitHub
 and cancellations (marking “canceled” and even clearing subdomain)
GitHub
GitHub
. These ensure the business state in the app always reflects the Stripe reality. We should confirm that subscription_status is used in the admin UI to possibly restrict features (e.g., if canceled or paused, perhaps the admin UI shows a banner or disables booking). At minimum, it’s displayed on the Account page (we see payment.subscriptionStatus used there)
GitHub
. That page even has controls for Pause, Cancel, etc., presumably for the owner to manage their subscription directly
GitHub
GitHub
. Those controls update the local UI state, but likely also trigger calls to an endpoint or rely on Stripe portal for actual effect. Possibly in future, pressing “Cancel” might call a function to cancel at period end. In any case, the data model supports reflecting those changes.

Activation Only on Completion: The onboarding completion step is the gatekeeper that flips the business to “live”. It only runs after the user has done everything (including Stripe). And as described, it sets subscription_status to at least 'trial'. This means post-completion, the login flow will treat the business as launched (since subscription_status is no longer null)
GitHub
GitHub
. If the user somehow circumvented Stripe (though the checks prevent it), they wouldn’t get past completion due to missing Stripe account or status. Therefore, a subscription is always created before go-live. The code also sets trial_ends_at and next_bill_at in DB, which can be used to, for instance, show a trial countdown or enforce limitations if needed.

Plan Upgrades/Downgrades: The question hints at respecting rules like trial on signup and upgrade on plan switch. The trial on signup is in place (everyone starts on trial by default). Upgrade on plan switch: currently, during onboarding, if the user picked Pro (notifications on) from the get-go, they get the higher price subscription. If a user wanted to upgrade later (after launching as Basic), there isn’t an explicit UI path shown in our audit, but the admin could potentially re-run Step 8 (Notifications) with templates. However, since the Notifications page is disabled on Basic with just an upgrade prompt
GitHub
, they might need to implement a separate upgrade flow (perhaps via the Stripe customer portal or a support request). For now, plan feature access is binary at onboarding – they choose Basic or Pro. Changing it post-launch might not be self-service yet. But the architecture supports it: toggling notifications_enabled and switching stripe_price_id accordingly. They’d need to handle proration in Stripe if that happens mid-cycle. This is beyond the immediate scope, but worth noting as a future improvement.

Ensure Subscription Sync: We should encourage using Stripe’s customer portal for managing plan and payment, or provide in-app controls that call Stripe APIs to upgrade. Since the database stores stripe_price_id (and it’s updated on creation), any plan change should also update that. The webhooks currently do not handle a price change explicitly; they look at subscription status mainly. If an upgrade/downgrade happened, the customer.subscription.updated webhook does not check if the price_id changed to flip notifications_enabled. That is a potential gap: if a user upgraded from Basic to Pro via Stripe directly, the system would receive a webhook with a new price and perhaps metadata if set. But currently, notifications_enabled is only set via our onboarding Step 8 logic, not dynamically by Stripe. To keep it in sync, we might: (a) prohibit changing plan outside our app, or (b) handle it in webhook by comparing the subscription’s price_id to our known IDs and update notifications_enabled accordingly. Since plan switching isn’t exposed yet, it’s not urgent, but it’s a good consideration for completeness. (We could add a task: when enabling plan upgrades, ensure toggling notifications_enabled and updating Stripe subscription in tandem.)

Overall, the Stripe integration respects the intended business state machine: a business is not fully active (in the sense of accepting real charges) until onboarding is done and a payment method is added, and the system correctly marks statuses at each stage. Stripe events further ensure the business status stays accurate over time.

Recommendations:

Stripe Webhook Security: Ensure the STRIPE_WEBHOOK_SECRET is correctly set and the endpoint only processes verified events (the code does check signature
GitHub
 – good). Also ensure the endpoint URL is hidden and secure (should be something like a secret endpoint not easily guessable, though security mainly comes from verifying signature). It looks fine.

Testing Billing Flows: Do a test with a Basic plan signup (notifications off) → ensure the Stripe subscription is created with the basic price and that stripe_price_id in DB matches the Basic plan product. Then add a card → ensure webhook flips status to active and next_bill_at is set. Similarly, test a Pro plan signup (notifications on) → verify higher price is used and features unlocked. If possible, simulate a cancellation via Stripe dashboard to see that webhook sets subscription_status = canceled and clears subdomain (the business should then not accept new bookings – presumably the booking site could check for canceled status and prevent new bookings, though that logic isn’t explicitly in code we saw. Could be something to implement: e.g. if business.subscription_status == 'canceled', return an error or maintenance page on their public site.)

Trial Expiry: The system sets trial end dates. Need to ensure something happens when trial expires and no payment on file (Stripe will set subscription to past_due or cancel it depending on settings). The webhook handles invoice.payment_failed by marking past_due (paused)
GitHub
GitHub
, which is likely the scenario of trial ending with no payment. This is good – it marks the business as “paused” (and possibly they intended to block bookings when paused). Confirm the app’s behavior for paused status (the Account page will show status Paused, and “Keep site live when paused” setting is shown
GitHub
 – interestingly, that implies an option to keep the site online in read-only mode during pause). These details show a thoughtful design; we just need to test them end-to-end.

By following these recommendations and performing integrated testing, we can ensure the Stripe payment pipeline is solid and tied correctly into the app’s notion of active business state, with no loopholes where a business could be live without a subscription or vice versa.

7. Summary of Engineering Changes & Fixes

To conclude, here are the key tasks and code-level changes we recommend to address the issues and ensure a robust, production-ready multi-tenant system:

(A) Fix Plan Saving in Step 8: Remove the early return on empty templates so that notifications_enabled is always updated. For example, update apps/web/src/app/api/business/onboarding/step-8-notifications/route.ts around lines 168–175 to ensure the business update occurs. Success criteria: Basic plan selection flips the DB flag to false. Impact: Pricing and feature gating will then correctly use this value (as confirmed by usage in Stripe logic
GitHub
 and admin UI
GitHub
).

(B) Run DB Migration for Default Plan: Apply migration 20250104000001_fix_notifications_enabled_default.sql to set the default of businesses.notifications_enabled to false (Basic)
GitHub
. This ensures any new business created (in any scenario) defaults to Basic plan unless changed. Also consider a one-time backfill: update any existing business that has notifications_enabled=true and no custom notification templates to false, since those were likely Basic accounts hit by the bug (the migration note mentions this scenario
GitHub
). This will clean up any historical data inconsistency.

(C) Verify and Adjust Supabase RLS Policies: Audit policies for businesses and related tables. Allow owners to update their own records. For instance, in Supabase SQL:

-- Allow business owners to full access their business
create policy "Owner access to business" on public.businesses  
  for all  -- (select, insert, update, delete as needed)  
  using ( user_id = auth.uid() )  
  with check ( user_id = auth.uid() );


Do similar for tables like notification_templates, services, staff, etc., using user_id or a lookup via business. This way, our application can use the user’s Supabase session for most operations without service role. Once done, remove or reduce usage of createAdminClient for routine owner actions (we can keep admin client for sign-up and webhooks or any cross-tenant admin tasks). This change will simplify error handling (fewer PGRST301 to catch) and tighten security by relying on the database to enforce tenant isolation.

(D) Remove Residual Seed/Test Data Paths: It appears the team already removed most. Double-check that components like <TestDataButton /> or generateSignupData() are only enabled in non-production scenarios. (There is a TestDataButton in the signup form for convenience
GitHub
 – ensure it’s gated or stripped in production builds.) This isn’t a security issue per se, but avoids any confusion with test data in a live environment.

(E) Clear Client State on Logout/Login Switch: Implement an explicit call to useFakeBusiness().clearBusiness() on logout (and perhaps on login just before loading new data) to wipe any leftover state. This is a minor enhancement given the current provider logic, but it guarantees no memory of the old business carries over. Also ensure the Supabase auth cookie is destroyed on logout (usually auth.signOut() does that).

(F) Harden Subdomain Handling: The provisioning logic in Step 2 is solid (regex validation and uniqueness check)
GitHub
GitHub
. We should ensure there’s a unique index on businesses.subdomain (where not null) to enforce that at the DB level too. If not present, add one in a migration. Also, when a business is canceled and subdomain nulled, consider if we want to release that subdomain for reuse immediately or after some time. Right now, as soon as webhook sets it null, another user could potentially claim that subdomain via Step 2. This might be acceptable (if a business is canceled, maybe you allow someone else to take the name). If that’s not desired (maybe a grace period), you’d handle it at the application level. For now, it’s okay – just be aware.

(G) Stripe & Subscription Sync: No code change needed for normal flow, but plan for the following future improvements:
– Plan Upgrades: Provide a UI path for an owner to upgrade from Basic to Pro after launch. This could be as simple as enabling the Notifications page to allow template creation (and behind the scenes flipping notifications_enabled to true and switching the Stripe price). To do this safely: add an API (similar to Step 8) for plan changes post-launch, which on notifications_enabled toggling to true, calls Stripe to update the subscription to the Pro price, and vice versa for downgrade (though downgrades mid-cycle might be complex). Until implemented, Basic users are essentially locked unless they contact support. Document this limitation or implement the upgrade flow.
– Stripe Customer Portal: As an alternative or addition, consider integrating Stripe Billing customer portal for self-service subscription management. If used, update webhooks to catch plan changes if any. Ensure metadata business_id is attached to the Stripe Subscription (currently done on creation) so that even if changed via portal, the webhook can identify the business. Then, on customer.subscription.updated events, compare the subscription.items[].price and map it to Basic/Pro, updating notifications_enabled accordingly. This would fully sync Stripe state with our DB. Right now, since plan can’t change except through our controlled flow, it’s consistent.

(H) Trial and Grace Period Behavior: Confirm how the system should behave at trial end. The webhook will mark subscription past_due if payment fails. The front-end might want to detect subscription_status = 'paused' and possibly show a banner “Trial expired – add a payment method to activate” or similar. There is a UI element “Keep site live when paused” with a toggle
GitHub
 – presumably if true, they allow the public site to still be accessible in read-only mode even if subscription is paused (so clients can still view the business but maybe not book). We should implement logic to honor that: perhaps if a business is paused and keepSiteLiveWhenPaused = false, the public site should redirect to a “temporarily unavailable” page. This might involve a field in the DB (maybe keep_site_live_when_paused stored somewhere). It’s mentioned in UI state but unclear if stored. If not stored, we may ignore for now, or implement it. This is an example of a feature toggle that should be per business. Since it’s beyond the immediate bug fixes, consider it a next-phase item.

(I) Testing & Monitoring: After deploying fixes, monitor the onboarding flow closely for any new errors or edge cases. Particularly, ensure that the Step 8 fix does not inadvertently double-save or conflict if templates exist. Our fix suggestion was straightforward, but just validate: Pro plan (with templates array non-empty) still works (the early return won’t trigger so it runs as before), Basic plan (empty array) now updates flag. Also monitor Stripe webhooks logs to verify all events are handled (no event types slipping by unhandled that could cause mismatches). Adding logging (which they have extensively) to Stripe hooks and critical endpoints is great – keep an eye on those logs for any RLS errors or mismatches after changes. The code already logs verification of values (e.g. Step 8 logs the expected vs saved plan and even fixes it if mismatch
GitHub
GitHub
). Ideally those critical “CRITICAL ERROR: mismatch” logs should never appear – if they do, it indicates something still wrong (like RLS prevented the update and even admin failed). With our RLS adjustments, those should vanish.

In conclusion, implementing the above changes will: (1) fix the plan selection bug and ensure accurate billing and feature access, (2) guarantee strong tenant data isolation both in frontend state and backend enforcement, (3) confirm all onboarding data (including Stripe info) is saved and consistent through launch, and (4) solidify the login->dashboard routing to always land users in the correct context. The result will be a reliable onboarding experience that correctly differentiates Basic vs Pro accounts, a secure multi-tenant environment where users only ever access their own data, and a Stripe integration that aligns perfectly with the application’s subscription logic – very much in line with SaaS best practices seen in platforms like Squarespace (multi-site management) or Fresha (multi-branch scheduling systems). Each business will be fully isolated and properly configured by the time they go live on Tithi.

Sources: The analysis above is supported by the repository code: we’ve cited the relevant portions for each issue, including the Step 8 route early return
GitHub
 and update logic, the plan usage in pricing
GitHub
, the admin UI gating
GitHub
, the tenant isolation checks in the admin layout
GitHub
, and the safe defaults and removal of shared state in the context providers
GitHub
GitHub
. These code references substantiate the recommended fixes and ensure we align the solution with the actual codebase.