# Project Blueprint: Esports AI Oracle & Forecasting Tournament

## 1. Project Overview
A web-based esports forecasting platform where users predict match outcomes to win a fixed €50 monthly prize.
- **Free Tier:** Access to the tournament and basic match data.
- **Premium Tier ($20/mo):** Access to "AI Insights" (Gemini API) which analyzes match data to provide probabilities and tactical breakdowns.
- **Legal Strategy:** "Skill-based Contest" + "SaaS Data Tool." No gambling terminology (no "bets," "odds," or "wagers").

## 2. Technical Stack
- **Framework:** Next.js 14+ (App Router)
- **Database/BaaS:** Appwrite (Server-side `node-appwrite` SDK ONLY)
- **Authentication:** Custom session management using `jose` for signed JWTs.
- **Form Handling:** `react-hook-form` + `zod` for validation.
- **UI:** `coss.com/ui` (Shadcn/ui base) + Tailwind CSS.
- **AI:** Google Gemini API (`@google/genai`).
- **Data:** PandaScore API (Esports match data).
- **Payments:** Stripe Checkout + Webhooks.

## 3. Database Schema (Appwrite Collections)

### Users
- `userId` (String, PK)
- `username` (String, Unique)
- `email` (String)
- `tier` (Enum: "free", "premium")
- `totalPoints` (Integer, Index)
- `stripeCustomerId` (String)

### Matches
- `matchId` (String, PK - from PandaScore)
- `game` (String - "cs2", "lol")
- `teamA` / `teamB` (String)
- `startTime` (DateTime)
- `status` (Enum: "upcoming", "live", "finished")
- `winnerTeam` (String, Nullable)

### Predictions
- `predictionId` (String, PK)
- `userId` (String, Index)
- `matchId` (String, Index)
- `prediction` (String - Team Name)
- `isCorrect` (Boolean, Nullable)
- `pointsAwarded` (Integer)

## 4. Implementation Phases

### Phase 1: Security & Auth (`jose`)
1. Setup `lib/appwrite.ts` using the **Server-side SDK** (`node-appwrite`). Use environment variables for API keys.
2. Implement Auth Actions: `signUp`, `login`, `logout`.
3. **Session Logic:** On login, create an Appwrite session, then sign a JWT using `jose` containing the `userId` and `tier`. Store this in an HTTP-only cookie.
4. Implement `middleware.ts` to verify the `jose` JWT and protect `/dashboard` and `/premium` routes.

### Phase 2: Data Ingestion (Cron Jobs)
1. Create a Route Handler `app/api/cron/sync-matches/route.ts`.
2. Fetch upcoming matches from PandaScore API.
3. Map and upsert data into the Appwrite `Matches` collection.
4. Setup a second cron to check `finished` matches and update the `winnerTeam`.

### Phase 3: Core UI & Predictions
1. Build the Dashboard using `coss.com/ui` components.
2. Create a `PredictionForm` using `react-hook-form` and `zod`.
3. Implement a Server Action `submitPrediction`:
   - Validate that the match hasn't started.
   - Ensure the user hasn't already predicted this match.
   - Save to the `Predictions` collection.

### Phase 4: Gemini AI Integration (Premium Feature)
1. Create a `PremiumInsight` component.
2. Implement a Server Action `getMatchAnalysis(matchId)`:
   - Verify user tier is `premium` via the `jose` JWT.
   - Fetch match history for the two teams.
   - Prompt Gemini: *"Analyze these two esports teams for [Match Context]. Give a win probability and 3 tactical reasons why. Format as JSON."*
   - Return to the UI.

### Phase 5: Points & Leaderboard
1. Background logic: When a match is marked `finished`, find all related `Predictions`.
2. Update `isCorrect` and add 10 points to the `User.totalPoints` if they won.
3. Create a Leaderboard page showing the top users sorted by `totalPoints`.

### Phase 6: Stripe Monetization
1. Implement a Stripe Checkout session for the $20 subscription.
2. Implement a Stripe Webhook to update the user's `tier` in Appwrite to `premium` upon successful payment.

## 5. Critical Development Rules
- **No Client-side Appwrite:** Use only Server Actions and Route Handlers to interact with Appwrite.
- **Terminology:** Use "Forecasts," "Points," and "Skill-based Competition." Avoid any gambling-related language in the UI.
- **Zod Validation:** Every server action must validate the `formData` using a Zod schema before processing.
- **Error Handling:** Use `try/catch` in all Server Actions and return a standardized `{ success: boolean, error?: string }` object.
- **styling:** project is for esports - games so front end styling should be more "GAMERY"
