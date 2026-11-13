# Shared public asset storage

The authoritative public file/preview index is `assets/library/index.json`.
It records stable IDs, metadata, real relative file paths and publication state.
`legacy-map.json` explicitly links the existing GLBs to built-in catalog IDs.
It does not guess that every numeric app thumbnail represents a repository GLB:
many built-in app objects are procedural.

New upload layout:

- `assets/library/models/<id>/model.glb`, `thumbnail.jpg`
- `assets/library/materials/fabric/<id>/color.jpg`, `normal.jpg`, optional
  `roughness.jpg`, `thumbnail.jpg`
- `assets/library/materials/wood/<id>/...`

Existing GLBs are NOT moved: existing app and saved-layout URLs remain valid.
Canonical preview files are JPEG 250 x 250. Existing swatches have canonical
copies under the material tree; `compatibility_paths` preserves old app URLs.
The plugin atomically writes canonical files, recorded aliases and the index.
Old swatches lack supplied detail normals, so they are legacy drafts with
`needs_normal: true`, not complete fabricated material packages.

Model records indexed with `catalog_index` supply app preview paths and
archive/deletion state through `asset-library.js`. Unknown/unindexed models
still require model registration; this change does not bypass company access
controls or replace the private signed-URL catalogue. Reload the app to read
the latest index. Archived files stay available for existing layouts. A hard
delete retains an ID tombstone; existing layouts may lose access to the deleted
GLB, so the plugin requires explicit confirmation.

Future private-site storage should implement the same stable-ID API, relative
path validation and atomic metadata publication. Repository folders are storage
locations; company and category filters come from metadata rather than inferred
folder labels. No tokens belong in the catalogue or public files.
