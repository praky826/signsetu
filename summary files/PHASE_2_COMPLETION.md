# Phase 2 Completion Summary — Static Asset Acquisition & Legacy Repo Verification

Status: partially complete. All items resolved except dataset.csv, which is blocked on a human step (below).

Files created: assets/isl_dictionary.json, frontend/vendor/hamnosysMap.js, autoBoneMapper.js, SignEngine.js, avatar.js, frontend/vendor/models/human.glb (all fetched verbatim from https://github.com/jayakarthik07/speech-to-isl, main branch, and read in full), backend/legacy_reference/isl_nlp.py and app.py (fetched, skimmed, never imported), assets/placeholder/unknown_word.png (generated programmatically, a grey box with a white question mark, since it is a UI placeholder rather than demo data).

No cross-boundary function signatures were added this phase (no backend/ws/connection.py work yet).

Key data structures confirmed by reading the actual files, superseding the Code Reuse document's hypotheses, and recorded in full in docs/implementation.md section 5: hamnosysMap.js exports a token-to-function map (HAMNOSYS_ACTIONS), not a string parser; SignEngine.js exposes only low-level primitives (rotate, armTo, palm, hand, resetAll) with no playSign function and no completion event of any kind; avatar.js's initAvatarScene(container) builds and owns the entire Three.js scene/camera/renderer itself and hardcodes the GLB path as "/models/human.glb"; autoBoneMapper.js's autoMapBones(model) is not used internally by SignEngine.js, which does its own bone mapping; isl_dictionary.json is keyed by lowercase English word with {gloss, hamnosys} values, not a flat gloss-to-hamnosys map.

Ambiguity encountered and resolution: SignEngine.js and avatar.js use bare ES module specifiers ("three", "three/examples/jsm/..."), which cannot load from a plain CDN script tag. Resolved by deciding to use a native browser import map in index.html (Phase 10) mapping these specifiers to a CDN ESM build - this satisfies the no-bundler requirement since import maps are native browser functionality, not a build step.

Blocking issue, human action required: the CISLR video archive already downloaded (data/cislr/CISLR_v1.5-a_videos.zip) contains only 7051 .mp4 files keyed by raw YouTube video ID, with no gloss labels anywhere. The matching dataset.csv confirmed to exist in the same Hugging Face repo (Exploration-Lab/CISLR, sibling file to the video zip, same commit sha) could not be downloaded automatically because the dataset is gated and returned HTTP 401 even on direct fetch. Per the Real Data Rule this file cannot be fabricated or guessed. See the message accompanying this summary for the exact steps needed from you.

Also pending on the human: selecting the demo vocabulary set (which words' CISLR clips to keep cached) requires the real demo source material, not yet supplied.
