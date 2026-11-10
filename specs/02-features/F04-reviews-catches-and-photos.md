# F04 — Water Body Feedback, Spot Reviews & Catch Photos

> **Status**: `Approved`  
> **Module**: `src/modules/reviews/`

---

## 1. User Story
**As a** guest user, **I want to** see some teaser community feedback when I click a Water Body Pin so I know the water body is active; and **as a** registered angler, **I want to** read all reviews/photos and leave my own review, feedback, and catch photos on the water body and its spots,  
**So that** anglers can share real fishing results.

## 2. Functional Requirements
1. **Attaching Reviews & Feedback to Water Body Pins**:
   - Reviews are linked to the **Water Body (`water_body_id`)** and optionally to a specific **Grid Spot (`spot_id` / `cell_id`)**.
2. **Tiered Visibility (Guest Teaser vs. Registered Full Access)**:
   - **Guest Users**: When clicking a Water Body Pin on the map, guests see the water body's **average star rating**, **total review count**, and **1–2 short teaser feedback snippets** (without exact grid spot coordinates or full catch photo galleries), paired with the **Call to Action to register**.
   - **Registered Users**: See **all** community reviews, exact grid spot associations, full catch logs (species, weight, length, bait/technique used), and the full catch photo gallery, and can submit new reviews and photos.
3. **Zero-Cost Client-Side Photo Compression**:
   - Registered anglers can upload 1–3 photos per review, compressed client-side to **WebP (`<= 200KB`, max `1280px`)** and stored in **Supabase Storage**.

## 3. Acceptance Criteria (Given / When / Then)
- **AC-F04-1 (Guest Teaser Feedback on Water Body Pin)**:
  - *Given* a water body has community reviews,
  - *When* a guest clicks the Water Body Pin,
  - *Then* they see the basic water body description, catchable fish species, aggregate rating + teaser feedback text, and a CTA to register for full access.
- **AC-F04-2 (Registered User Full Reviews & Photo Upload)**:
  - *Given* a registered user views a water body or spot,
  - *When* they browse or submit a review with a catch photo,
  - *Then* they have full read/write access to all reviews, spot pins, and compressed WebP catch photos.
