# 00 — Product Vision & MVP Scope

> **Status**: `Approved`  
> **Owner**: Product / Engineering  
> **Last Updated**: 2026-11-10

---

## 1. Core MVP Workflow (Guest-Only, Zero Friction)
The MVP is a streamlined, **100% Guest-accessible** AI visual fishing advisor:

1. **Navigate & Select Map Area**:
   - The user browses an interactive map (switching freely between **Satellite**, **Terrain**, and **Plain** map views) and navigates to any water body of their choice (e.g., near Valencia, Ebro, or Poland).
   - The user selects the area on the map containing the water body (either via a **1-click Capture Map Area** button or by **dragging a selection box** on the map), creating a screenshot of that map area.
   - The user sees the captured screenshot on the screen and initiates the analysis with AI (optionally noting their lures/gear or target fish).
2. **AI Water Body Recognition + Multimodal Image & Internet Analysis**:
   - The AI recognizes the **name of the water body** from the selected area coordinates and visual features.
   - The AI performs **image analysis** on the `A1–H8` gridded screenshot (identifying underwater ledges/color changes, rocky peninsulas, road access, sheltered coves, canyon bottlenecks) combined with **internet/geospatial data** about the water body.
3. **Annotated Grid Screenshot + Tactical Summary**:
   - The user receives the **annotated screenshot** of the selected map area with the **`A1–H8` grid** and **6 numbered, color-coded spot points (`1–6`)** drawn directly on the image:
     - 🔴 **Spots 1 & 2 (Red)**: Primary Trophy Points & Transition Lines (`🏆`)
     - 🔵 **Spots 3 & 4 (Blue)**: Sheltered Bays & Direct Car/Beach Access Coves
     - 🟠 **Spots 5 & 6 (Orange)**: Canyon S-Bends, Bottlenecks & Gateway Points
   - Alongside the screenshot, the user receives the structured **Tactical Summary**:
     - `🎯 Where to Fish on the Grid:` (Spot 1 through Spot 6 describing why it's great, the terrain / why fish love it, and how to fish it).
     - `🚗 Best Game Plan for This Area:` (Step-by-step parking, walking, and fishing sequence across the grid cells).
4. **User's Artifact & Multi-Water-Body Loop**:
   - The annotated screenshot + summary becomes the **user's artifact** (saved in their session/artifact gallery and downloadable as a PNG image).
   - The user can return to the map at any time to navigate to another water body and analyze it.
