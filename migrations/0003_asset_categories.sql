-- Objects, Characters and Scenes. Preserve every model, source credit and download count.
CREATE TABLE assets_categories_next (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
  category TEXT NOT NULL CHECK (category IN ('props','characters','scenes')),
  license TEXT NOT NULL CHECK (license IN ('CC0','CC-BY-4.0','CC-BY-SA-4.0','CUSTOM')),
  creator TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '',
  license_url TEXT NOT NULL DEFAULT '', attribution TEXT NOT NULL DEFAULT '',
  model_key TEXT NOT NULL, model_bytes INTEGER NOT NULL,
  preview_key TEXT NOT NULL, poster_key TEXT NOT NULL,
  preview_animated INTEGER NOT NULL DEFAULT 0,
  animations TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(animations)),
  rigged INTEGER NOT NULL DEFAULT 0,
  tile_size TEXT NOT NULL DEFAULT 'small' CHECK (tile_size IN ('small','micro','vert','hero')),
  colour TEXT NOT NULL DEFAULT '#d9e4de', published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  downloads INTEGER NOT NULL DEFAULT 0 CHECK (downloads >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO assets_categories_next SELECT
  id,slug,name,description,
  CASE WHEN category IN ('vehicles','nature','environments') AND NOT EXISTS (SELECT 1 FROM json_each(assets.tags) WHERE value=category)
       THEN json_insert(tags,'$[#]',category) ELSE tags END,
  CASE WHEN category='characters' THEN 'characters' ELSE 'props' END,
  license,creator,source_url,license_url,attribution,model_key,model_bytes,preview_key,poster_key,
  preview_animated,animations,rigged,tile_size,colour,published,created_at,downloads,updated_at
FROM assets;
DROP TABLE assets;
ALTER TABLE assets_categories_next RENAME TO assets;
CREATE INDEX assets_published ON assets(published, updated_at DESC);
CREATE INDEX assets_category ON assets(category, published);
CREATE INDEX assets_model ON assets(model_key);
CREATE INDEX assets_preview ON assets(preview_key);
CREATE INDEX assets_poster ON assets(poster_key);
