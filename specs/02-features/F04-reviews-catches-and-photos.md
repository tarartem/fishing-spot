# F04 — Spot Reviews, Feedback & Catch Photos

> **Status**: `Draft`  
> **Module**: `src/modules/reviews/`

---

## 1. User Story
**As an** angler who fished at a spot,  
**I want to** leave a review, rate the spot, record what I caught, and upload photos of my fishing results,  
**So that** other anglers can see real results and the AI assistant can learn which spots perform best.

## 2. Functional Requirements
1. **Spot Review & Rating**:
   - 1–5 star rating for the spot (`overall_rating`).
   - Optional breakdown: Bank accessibility, fish activity, cleanliness/crowding.
   - Text feedback describing conditions, bait/lure used, and tips.
2. **Catch Result Logging**:
   - Species caught, count, approximate weight/length, fishing technique used, and date/time of catch.
3. **Photo Upload ($0 Storage Optimized)**:
   - Upload 1–3 photos per review (catch photo, spot/bank view, or local regulation sign).
   - Client-side compression (auto-resize to max `1280px` width, convert to `WebP` <= `200KB` per image, strip sensitive EXIF if requested) before uploading to free object storage.
4. **Community Feed on Map**:
   - Clicking any spot or water body displays existing community reviews, average rating, recent species caught, and photo gallery.

## 3. Acceptance Criteria (Given / When / Then)
- **AC-F04-1 (Submit Review with Photo)**:
  - *Given* an authenticated angler selects a spot on the map,
  - *When* they submit a rating (1–5), feedback text, target species caught, and a catch photo,
  - *Then* the photo is compressed, uploaded to storage, linked to the review record in the database, and immediately visible on the spot's detail panel.
- **AC-F04-2 (View Spot Reviews)**:
  - *Given* a spot has 1 or more reviews,
  - *When* any user views the spot on the map,
  - *Then* the average star rating, total review count, and photo thumbnails are displayed.
