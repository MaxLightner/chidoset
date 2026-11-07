# Chido 0.13.0 — AR return, real products and renderer settings

The app previously rebuilt its WebGL renderer on every normal XR exit. It now keeps the same renderer, model instances and loaded textures and re-enables the launch controls. Navigating home still disposes resources; the environment texture is explicitly released, including late HDR loads.

Reload no longer seeds the procedural conversation preset. Recovery is scoped by company and authenticated user; manager recovery uses local storage and seller recovery is temporary tab storage, separate from official layout saving. Restore and in-app product selection accept published real products only. Legacy procedural drafts are ignored. Model load failure does not display a box as substitute furniture.

Rendering uses Reinhard tone mapping and a white directional fill that follows the camera, with no extra shadow pass for that fill. Sofa contact decals implement the final Material Lab v15 description from the chat «بهبود نورپردازی متریال»: actual local bounding box, rounded corners, plane dimensions 2.4 times the footprint, bounded fade and a transparent margin. No leg clustering. The decal is unlit and only attaches to sofas; tables and lamps get none.

Three fabric JPEGs were resized from 1254px to 1024px and optimized from 1,839,980 to 980,120 bytes (46.7% reduction). AO atlases were retained. Fabric and AO downloads start alongside GLB loading and are ready before the model becomes visible. Texture URLs and changed module URLs use release 0.13.0.

Validation: 165 unit/integrity checks; `qa/ar-render-recovery.mjs` with live manager/seller demo accounts, real GLBs and JPEGs; repeated simulated XR-end events retain the exact renderer; reload preserves the real products and rejects legacy procedural recovery. Physical ARCore end-event timing remains a real-device verification item.
