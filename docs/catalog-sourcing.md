# Tana library sources and curation

The hosted catalog contains downloadable, self-contained GLB models and our own previews. Each record includes its creator, original source URL, copyright licence URL, attribution, actual animation names and file size. These credits travel with desktop downloads in SOURCE.txt and catalog metadata.

| Source | Copyright licence | Original collection |
| --- | --- | --- |
| Kenney | CC0 | https://kenney.nl/assets |
| KayKit / Kay Lousberg | CC0 | https://github.com/KayKit-Game-Assets |
| Quaternius | CC0 for the packs selected | https://quaternius.com/ |
| Poly Haven | CC0 | https://polyhaven.com/models |
| Google Scanned Objects / Google Research | CC BY 4.0, checked in each Fuel record | https://app.gazebosim.org/GoogleResearch/fuel/collections/Google%20Scanned%20Objects |

Only packs with verified matching permissions are included. Downloaded source archives, creator licence pages and model metadata are retained locally as import evidence. NASA models are deferred because a general usage policy is insufficient for our per-asset open-licence requirement.

Objects, Characters and Scenes are the three categories. Vehicles, nature, architecture and furniture are tags. Characters require real animation clips with channels and a duration greater than 0.2 seconds; static characters and outfit fragments are deferred. Quaternius Universal Base Characters paired with the creator's compatible Universal Animation Libraries are identified as conversions in their credits.

Scenes are a small, hand-composed collection of complete starting sets, assembled from CC0 parts by the creators above. Every placed piece has a named node. No static actors are added to these sets. Their individual source kits are named in each scene's credits. The layouts are released under CC0; source meshes retain their original CC0 attribution.

Import curation rejects exact geometry duplicates, alternate file formats, recolours, empty models, templates, decals and excessive variants. Ordinary chairs, armchairs and common table concepts have tighter caps across sources, including existing records. A numerical target never overrides useful variety or licensing.

Models retain real animation data. Textures are resized for practical downloads; animation-heavy models can be larger. Previews are rendered from the validated GLB, with a short GIF when a real clip is available. Each model and preview is uploaded to R2 and its stored size checked before its D1 record is published. Existing records and download counts are preserved. Public validation fetches models and previews through the website without incrementing download counts.

Scripts under scripts/bulk implement the resumable source, conversion, curation, build, upload and verification stages. Temporary source evidence and outputs are kept under .tmp/bulk and excluded from Git. Credentials are read privately from the configured token file, never embedded in the catalog or repository. Website changes deploy through Cloudflare's Git connection.
