# Chido — Standalone Room Planner Lab

Experimental standalone HTML prototype, **not imported by the production AR app**.

## Preview
- Site: https://chidoset.ir/experiments/room-planner/
- Source: https://github.com/MaxLightner/chidoset/blob/main/experiments/room-planner/index.html

## Workflow
1. Enter rectangular room length/width (meters) and confirm.
2. Click a tool then click a wall, or drag a tool card onto the plan.
3. Place 1m full-height window, 2.5m full-height window, 2m standard window with a 1.10m sill, doorway with hall, 3m kitchen opening, and 2.2m TV wall.
4. Use selection mode to move items along walls, or enter exact wall/offset values.
5. Overlapping wall elements, invalid corner clearances, and TV facing an aligned doorway/kitchen opening are rejected. TV may face windows.
6. Save or import a JSON plan; local draft and Undo/Redo are available.
7. Switch to the 3D tab to rebuild geometry from the same plan. Existing Three.js physically based materials, lighting, soft shadows, GTAO, bloom and tone mapping remain from the supplied code.

## Integration
This is intentionally **single-file and independent**. When ready to merge, first extract:
- Plan data model, validation, serialization and placement
- 2D editor UI
- 3D geometry builder
- Rendering pipeline (to share rather than duplicate render settings)

The production Chido app was not modified.

## Scope and limitations
- Rectangular room perimeter only, four axis-aligned walls.
- Each door includes a short modeled hallway; there is not yet a separate corridor drawing tool.
- 2D plans and 3D scenes are constructed procedurally; not an import of DWG/DXF.
- Browser needs network access for CDN versions of Three.js, Tailwind CSS and Google Fonts.
- JavaScript syntax was checked; end-to-end visual GPU testing and public URL responsiveness were not verified in the authoring environment.
