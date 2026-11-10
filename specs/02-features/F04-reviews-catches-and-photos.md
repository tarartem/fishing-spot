# F04 — Water Body Pin Reviews, Feedback & Catch Photos

> **Status**: `Approved`  
> **Module**: `src/modules/reviews/`

---

## 1. User Story
**As a** registered angler,  
**I want to** click a water body to see pre-seeded/existing spot pins and community reviews, and attach my own review, feedback, and catch photos to a water body pin,  
**So that** the community shares verified fishing results and the AI assistant incorporates real catch history into future recommendations.

## 2. Functional Requirements
1. **Attaching Reviews to Water Body Pins**:
   - Every review is linked to a **Water Body Pin (`fishing_spots` record)** on a specific water body and grid cell (`cell_id`).
   - Registered anglers can:
     - **Review an Existing Pin**: Click any AI-generated or pre-seeded spot pin on the water body and click **"Add Review & Catch Photo"**.
     - **Drop a New Spot Pin on the Water Body**: Click a water/shoreline cell where they fished to create a community spot pin and attach their review + photo.
2. **Visibility Rules (Registered Only)**:
   - Pre-seeded/existing spot pins and their reviews/photos are **visible exclusively to registered users** (Email auth).
   - Guests clicking a water body do not see pre-seeded spot pins or community reviews until they register.
3. **Review & Catch Payload**:
   - `rating`: 1 to 5 stars (`integer`).
   - `comment`: Text feedback on spot conditions, structure, bait/lure used, and bank access.
   - `fishing_type_used`: Technique used (`spinning`, `feeder_bottom`, `carp`, `float`, `fly`, `surfcasting`).
   - `species_caught`: List of `{ species, count, length_cm, weight_kg }`.
   - `fished_on`: Date of the session.
4. **Zero-Cost Client-Side Photo Compression**:
   - Up to 3 photos per review (`catch`, `spot_view`, `regulation_sign`).
   - Before upload, the browser resizes images to max `1280px` dimension and compresses to **WebP (`<= 200KB`)**, uploading to **Supabase Storage** (`catch-photos` bucket).
5. **AI Prompt Enrichment Loop**:
   - Aggregated review ratings and top species caught per grid cell (`cell_id`) on a water body are summarized and injected into `spot-finder-grid.prompt.md` (`community_reviews_summary`) when new AI analyses are generated.

## 3. Acceptance Criteria (Given / When / Then)
- **AC-F04-1 (Pre-Seeded Spots Visible on Water Body Click for Registered Users)**:
  - *Given* a registered user clicks a water body on the map,
  - *When* the water body loads,
  - *Then* all pre-seeded and previously created spot pins on that water body are immediately rendered on the map with their average star rating and review count.
- **AC-F04-2 (Submit Review & Compressed Catch Photo)**:
  - *Given* a registered user selects a spot pin on a water body,
  - *When* they submit a 1–5 rating, feedback text, species caught, and a photo,
  - *Then* the client compresses the photo to WebP (`<= 200KB`), uploads it to Supabase Storage, saves the review via Drizzle ORM, and updates the spot pin's `avg_rating` and `review_count`.
- **AC-F04-3 (Guest Review Gating)**:
  - *Given* an unauthenticated guest user,
  - *When* they request water body details or attempt to post/view spot reviews,
  - *Then* pre-seeded spots and reviews are withheld and the UI prompts free Email registration.
