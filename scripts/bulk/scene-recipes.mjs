// Scene recipes. Units follow each kit (Kenney nature-kit tile = 1.0). Seeds make layouts reproducible.
const N = 'nature-kit';
const rect = async (x0, x1, z0, z1, step, fn) => { for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) await fn(x, z); };
export const SCENES = [
  { slug: 'forest-campsite', title: 'Forest Campsite', seed: 11,
    description: 'A small woodland clearing with two tents, a campfire ringed by log seats, a dirt path, pine trees, rocks and wildflowers, ready to rearrange.',
    tags: ['scene', 'forest', 'camp', 'campsite', 'outdoor', 'nature', 'tent', 'campfire', 'low-poly'],
    async build({ b, P, r, pick }) {
      await rect(-5, 5, -5, 5, 1, (x, z) => P(N, 'ground_grass', x, z));
      for (const z of [-5, -4, -3, -2, -1, 0, 1]) await P(N, 'ground_pathStraight', 0, z, { ry: Math.PI / 2 });
      await P(N, 'campfire_logs', 0, 1.8); for (const [x, z, ry] of [[-0.7, 1.8, 0], [0.7, 1.8, 0], [0, 2.6, 1.5]]) await P(N, 'stump_round', x, z, { ry });
      await P(N, 'tent_detailedOpen', -2.6, 0.8, { ry: 0.5 }); await P(N, 'tent_smallClosed', 2.6, 0.6, { ry: -0.6 }); await P(N, 'sign', 0.7, -0.6, { ry: 0.3 });
      await P(N, 'log_stack', -1.6, 3.2, { ry: 0.2 });
      const trees = ['tree_pineTallA', 'tree_pineTallB', 'tree_pineDefaultA', 'tree_pineRoundA', 'tree_default']; let n = 0;
      while (n < 26) { const a = r() * Math.PI * 2, d = 3.4 + r() * 1.8; const x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(x) < 0.9 && z < 1) continue; await P(N, pick(trees), x, z, { ry: r() * 6.28 }); n++; }
      for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 1.4 + r() * 3.2; await P(N, pick(['rock_smallA', 'rock_smallC', 'rock_smallFlatA', 'plant_bush', 'mushroom_redGroup', 'flower_yellowA', 'flower_purpleB', 'grass_large']), Math.cos(a) * d, Math.sin(a) * d, { ry: r() * 6.28 }); }
    } },
];

const FK = 'furniture-kit';
// Furniture-kit room shell: floor grid plus two cutaway walls (kit units: floor 1x1, wall 1 wide). Features replace wall segments.
async function room({ b, P }, w, d, { floor = 'floorFull', wall = 'wall', door = 'wallDoorway', windows = [], doors = [] }) {
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) await P(FK, floor, x + 0.5 - w / 2, z + 0.5 - d / 2);
  const seg = (side, i) => (side === 'n' ? windows.includes('n' + i) : side === 's' ? windows.includes('s' + i) : side === 'e' ? windows.includes('e' + i) : windows.includes('w' + i));
  for (let i = 0; i < w; i++) for (const [side, z, ry] of [['n', -d / 2 - 0.05, 0]]) {
    const name = doors.includes(side + i) ? door : seg(side, i) ? 'wallWindow' : wall; await P(FK, name, i + 0.5 - w / 2, z, { ry });
  }
  for (let i = 0; i < d; i++) for (const [side, x, ry] of [['w', -w / 2 - 0.05, Math.PI / 2]]) {
    const name = doors.includes(side + i) ? door : seg(side, i) ? 'wallWindow' : wall; await P(FK, name, x, i + 0.5 - d / 2, { ry });
  }
}
SCENES.push(
  { slug: 'cosy-living-room', title: 'Cosy Living Room', seed: 21,
    description: 'A furnished living room with a corner sofa, coffee table, television cabinet, bookcases, rug, plants and lamps in a cutaway room with a window and doorway.',
    tags: ['scene', 'interior', 'living-room', 'room', 'home', 'furniture', 'sofa', 'low-poly'],
    async build(c) { const { P } = c; await room(c, 5, 4, { windows: ['n1', 'n3'], doors: ['w2'] });
      await P(FK, 'rugRectangle', 0, 0); await P(FK, 'loungeSofaCorner', -1.6, 0.5, { ry: Math.PI / 2 }); await P(FK, 'loungeSofa', 0, 1.6, { ry: Math.PI });
      await P(FK, 'tableCoffee', 0, 0.3); await P(FK, 'cabinetTelevision', 0.2, -1.7); await P(FK, 'televisionModern', 0.2, -1.7, { y: 0.28 });
      await P(FK, 'bookcaseOpen', 2.1, -1.1, { ry: -Math.PI / 2 }); await P(FK, 'bookcaseClosedWide', 2.1, 0.3, { ry: -Math.PI / 2 }); await P(FK, 'lampRoundFloor', -2.1, -1.6); await P(FK, 'pottedPlant', 2.1, 1.6); await P(FK, 'sideTable', -2.2, 1.5, { ry: Math.PI / 2 }); await P(FK, 'lampRoundTable', -2.2, 1.5, { y: 0.4 }); await P(FK, 'loungeChairRelax', 1.5, 0.4, { ry: -Math.PI / 2 }); } },
  { slug: 'bedroom-suite', title: 'Bedroom Suite', seed: 22,
    description: 'A bedroom with a double bed, bedside cabinets, bookcase, desk and chair, rug, plants and a window, in a cutaway room.',
    tags: ['scene', 'interior', 'bedroom', 'room', 'home', 'furniture', 'bed', 'low-poly'],
    async build(c) { const { P } = c; await room(c, 4, 4, { windows: ['n1'], doors: ['w0'] });
      await P(FK, 'rugRound', 0, 0.2); await P(FK, 'bedDouble', 0, -0.9); await P(FK, 'cabinetBedDrawer', -0.95, -1.7); await P(FK, 'cabinetBedDrawer', 0.95, -1.7); await P(FK, 'lampRoundTable', -0.95, -1.7, { y: 0.3 });
      await P(FK, 'bookcaseClosed', 1.8, 0.2, { ry: -Math.PI / 2 }); await P(FK, 'desk', -1.5, 1.7, { ry: Math.PI }); await P(FK, 'chairDesk', -1.5, 1.2, { ry: Math.PI }); await P(FK, 'laptop', -1.5, 1.7, { y: 0.3, ry: Math.PI }); await P(FK, 'pottedPlant', 1.7, 1.6); await P(FK, 'coatRackStanding', -1.7, 0); } },
  { slug: 'kitchen-and-dining', title: 'Kitchen and Dining Room', seed: 23,
    description: 'A kitchen with a run of cabinets, stove, sink and fridge beside a dining table set with chairs and a hanging lamp, in a cutaway room.',
    tags: ['scene', 'interior', 'kitchen', 'dining-room', 'room', 'home', 'furniture', 'low-poly'],
    async build(c) { const { P } = c; await room(c, 5, 4, { windows: ['n2', 'w1'], doors: ['w3'] });
      let x = -2; for (const n of ['kitchenFridge', 'kitchenCabinet', 'kitchenStove', 'kitchenSink', 'kitchenCabinet']) { await P(FK, n, x + 0.2, -1.7); x += 0.9; }
      for (const xx of [-1.8, -0.9, 0, 0.9]) await P(FK, 'kitchenCabinetUpper', xx + 0.2, -1.8, { y: 0.75 });
      await P(FK, 'table', 0.3, 0.7); for (const [cx, cz, ry] of [[-0.1, 0.2, 0], [0.7, 0.2, 0], [-0.1, 1.2, Math.PI], [0.7, 1.2, Math.PI]]) await P(FK, 'chairCushion', cx, cz, { ry });
      await P(FK, 'rugRound', 0.3, 0.7); await P(FK, 'trashcan', 2.2, -1.6); await P(FK, 'pottedPlant', -2.1, 1.7); } },
  { slug: 'home-office', title: 'Home Office', seed: 24,
    description: 'A compact home office with a corner desk, computer, desk chair, shelving, lamps, a sofa nook and plants in a cutaway room.',
    tags: ['scene', 'interior', 'office', 'workspace', 'room', 'home', 'furniture', 'desk', 'low-poly'],
    async build(c) { const { P } = c; await room(c, 4, 4, { windows: ['n2'], doors: ['w3'] });
      await P(FK, 'deskCorner', -1.4, -1.4); await P(FK, 'computerScreen', -1.7, -1.7, { y: 0.4 }); await P(FK, 'computerKeyboard', -1.55, -1.45, { y: 0.4 }); await P(FK, 'chairDesk', -1.0, -0.9, { ry: 2.4 });
      await P(FK, 'bookcaseOpen', 0.4, -1.8); await P(FK, 'bookcaseOpen', 1.2, -1.8); await P(FK, 'bookcaseClosedWide', 1.65, -0.9, { ry: -Math.PI / 2 }); await P(FK, 'rugSquare', 0, 0.6); await P(FK, 'loungeSofa', 0, 1.7, { ry: Math.PI }); await P(FK, 'tableCoffeeSquare', 0, 0.6); await P(FK, 'lampSquareFloor', -1.8, 1.6); await P(FK, 'pottedPlant', 1.8, 1.6); } },
  { slug: 'family-bathroom', title: 'Family Bathroom', seed: 25,
    description: 'A tiled bathroom with a bathtub, shower, toilet, sink with cabinet and mirror, washer and dryer, a rug and a small window.',
    tags: ['scene', 'interior', 'bathroom', 'room', 'home', 'furniture', 'low-poly'],
    async build(c) { const { P } = c; await room(c, 3, 3, { windows: ['n1'], doors: ['w1'] });
      await P(FK, 'bathtub', -0.3, -1.1); await P(FK, 'shower', 1.1, -1.1); await P(FK, 'toilet', -1.2, 0.9, { ry: Math.PI / 2 + Math.PI }); await P(FK, 'bathroomSink', 1.3, 0.3, { ry: -Math.PI / 2 }); await P(FK, 'bathroomMirror', 1.45, 0.3, { y: 0.55, ry: -Math.PI / 2 }); await P(FK, 'rugDoormat', 0, 1.2); await P(FK, 'washerDryerStacked', -1.2, 0.0, { ry: Math.PI / 2 }); await P(FK, 'trashcan', 1.2, 1.2); } },
);

const SV = 'survival-kit', GY = 'graveyard-kit', PK = 'pirate-kit', FT = 'fantasy-town-kit', DG = 'KayKit-Dungeon-Remastered-1.0', SB = 'city-kit-suburban', CR = 'city-kit-roads', HX = 'KayKit-Medieval-Hexagon-Pack-1.0';
const scatterRing = async ({ P, r, pick }, pack, names, n, rMin, rMax, keep = () => true, o = {}) => { let k = 0, tries = 0; while (k < n && tries++ < n * 20) { const a = r() * Math.PI * 2, d = rMin + r() * (rMax - rMin); const x = Math.cos(a) * d, z = Math.sin(a) * d; if (!keep(x, z)) continue; await P(pack, pick(names), x, z, { ry: r() * 6.28, ...o }); k++; } };
SCENES.push(
  { slug: 'autumn-woodland-trail', title: 'Autumn Woodland Trail', seed: 31,
    description: 'A winding dirt trail through an autumn wood of orange and dark trees with stumps, logs, mushrooms, bushes and a signpost.',
    tags: ['scene', 'forest', 'autumn', 'trail', 'woodland', 'outdoor', 'nature', 'low-poly'],
    async build(c) { const { P, r, pick } = c; await rect(-5, 5, -5, 5, 1, (x, z) => P(N, 'ground_grass', x, z));
      for (const [x, z, n, ry] of [[0, -5, 'ground_pathStraight', 1.5708], [0, -4, 'ground_pathStraight', 1.5708], [0, -3, 'ground_pathStraight', 1.5708], [0, -2, 'ground_pathStraight', 1.5708], [0, -1, 'ground_pathStraight', 1.5708], [0, 0, 'ground_pathStraight', 1.5708], [0, 1, 'ground_pathStraight', 1.5708], [0, 2, 'ground_pathStraight', 1.5708], [0, 3, 'ground_pathStraight', 1.5708], [0, 4, 'ground_pathStraight', 1.5708], [0, 5, 'ground_pathStraight', 1.5708]]) await P(N, n, x, z, { ry });
      await scatterRing(c, N, ['tree_oak_fall', 'tree_default_fall', 'tree_fat_fall', 'tree_detailed_fall', 'tree_cone_fall', 'tree_blocks_fall'], 34, 1.4, 6.4, (x) => Math.abs(x) > 0.9);
      await scatterRing(c, N, ['stump_old', 'stump_round', 'log', 'log_large', 'mushroom_tanGroup', 'mushroom_redGroup', 'plant_bush', 'rock_smallA', 'rock_smallFlatB', 'grass_large'], 20, 1.2, 5, (x) => Math.abs(x) > 0.7);
      await P(N, 'sign', 0.8, -1.5, { ry: -0.4 }); } },
  { slug: 'palm-island-shore', title: 'Palm Island Shore', seed: 32,
    description: 'A small grassy island with palm trees, rocks, a canoe and paddle, a campfire and a tent, set on a flat blue sea.',
    tags: ['scene', 'island', 'beach', 'tropical', 'palm', 'outdoor', 'nature', 'low-poly'],
    async build(c) { const { P, r, pick, b } = c; b.slab(14, 14, 0.2, [0.25, 0.55, 0.75], 'Sea', -0.02); rect(-3, 3, -3, 3, 1, (x, z) => { if (Math.hypot(x, z) < 3.6) P(N, 'ground_grass', x, z); });
      await scatterRing(c, N, ['tree_palm', 'tree_palmTall', 'tree_palmBend', 'tree_palmShort', 'tree_palmDetailedTall'], 9, 1.2, 3, () => true);
      await scatterRing(c, N, ['rock_smallA', 'rock_largeB', 'rock_smallFlatA', 'plant_bush', 'grass_large'], 9, 0.8, 3.3);
      await P(N, 'campfire_stones', 0.2, 0.5); await P(N, 'tent_smallOpen', -1.1, 0.3, { ry: 0.8 }); await P(N, 'canoe', 2.9, 0.8, { ry: 0.3, y: 0.02 }); await P(N, 'canoe_paddle', 2.4, 1.3, { ry: 1.2 }); } },
  { slug: 'river-crossing', title: 'River Crossing', seed: 33,
    description: 'A grassy valley split by a river with a wooden footbridge, scattered rocks, lily pads, trees and a signpost.',
    tags: ['scene', 'river', 'bridge', 'landscape', 'outdoor', 'nature', 'valley', 'low-poly'],
    async build(c) { const { P, r, pick } = c; await rect(-5, 5, -5, 5, 1, (x, z) => { return z===0?P(N,'ground_riverStraight',x,z):P(N,'ground_grass',x,z); });
      await P(N, 'bridge_wood', 0, 0, { y: 0.0, ry: Math.PI / 2 }); await scatterRing(c, N, ['tree_pineTallA', 'tree_default', 'tree_oak', 'tree_pineRoundB', 'tree_detailed'], 22, 2.4, 6.2, (x, z) => Math.abs(z) > 1.3);
      await scatterRing(c, N, ['rock_smallA', 'rock_largeA', 'plant_bush', 'flower_redA', 'flower_yellowB', 'mushroom_redGroup', 'grass_large'], 18, 1.2, 5.5, (x, z) => Math.abs(z) > 1.1); await P(N, 'sign', 0.9, 1.2, { ry: 0.5 }); } },
  { slug: 'vegetable-farm-plot', title: 'Vegetable Farm Plot', seed: 34,
    description: 'A fenced farm plot with tilled soil rows of carrots, corn, wheat, pumpkins and melons, plus hay-yard logs, bushes and a tent.',
    tags: ['scene', 'farm', 'garden', 'crops', 'agriculture', 'outdoor', 'nature', 'low-poly'],
    async build(c) { const { P, r, pick } = c; rect(-4, 4, -4, 4, 1, (x, z) => P(N, 'ground_grass', x, z));
      const rows = [['crop_carrot', -2.4], ['crops_cornStageD', -1.2], ['crops_wheatStageB', 0], ['crop_pumpkin', 1.2], ['crop_melon', 2.4]];
      for (const [crop, z] of rows) for (let x = -2; x <= 2; x += 1) { await P(N, 'crops_dirtRow', x, z); for (let k = -0.3; k <= 0.35; k += 0.6) await P(N, crop, x + k, z, { ry: r() * 6 }); }
      for (let x = -3; x <= 3; x += 1) { await P(N, 'fence_simple', x, -3.4); await P(N, 'fence_simple', x, 3.4); }
      for (let z = -3; z <= 3; z += 1) { await P(N, 'fence_simple', -3.5, z, { ry: Math.PI / 2 }); await P(N, 'fence_simple', 3.5, z, { ry: Math.PI / 2 }); }
      await P(N, 'tent_detailedClosed', 5, -2, { ry: 0.6 }); await P(N, 'log_stack', 5, 0.5); await scatterRing(c, N, ['tree_oak', 'tree_default', 'plant_bush', 'rock_smallA'], 8, 5.3, 6.4, () => true); } },
  { slug: 'ancient-stone-ruins', title: 'Ancient Stone Ruins', seed: 35,
    description: 'Weathered stone ruins: a ring of columns and obelisks, a carved head statue, broken pillars, rocks and overgrown bushes on a grassy rise.',
    tags: ['scene', 'ruins', 'ancient', 'statue', 'columns', 'fantasy', 'outdoor', 'low-poly'],
    async build(c) { const { P, r, pick } = c; rect(-4, 4, -4, 4, 1, (x, z) => P(N, 'ground_grass', x, z));
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; await P(N, i % 3 === 0 ? 'statue_columnDamaged' : 'statue_column', Math.cos(a) * 2.6, Math.sin(a) * 2.6, { ry: a }); }
      await P(N, 'statue_head', 0, 0, { ry: 0.6 }); await P(N, 'statue_obelisk', 1.1, 1.1); await P(N, 'statue_block', -1.2, 0.9); await P(N, 'statue_ring', -0.9, -1.3, { ry: 0.4 });
      await scatterRing(c, N, ['rock_largeA', 'rock_smallB', 'plant_bushLarge', 'grass_large', 'rock_tallE', 'flower_purpleA'], 20, 1.8, 5.2); await scatterRing(c, N, ['tree_oak_dark', 'tree_pineTallB', 'tree_default_dark'], 8, 4.4, 5.8); } },
  { slug: 'survival-camp-outpost', title: 'Survival Camp Outpost', seed: 36,
    description: 'A rugged camp with a canvas tent, campfire pit and fish rack, workbench with anvil, chest, barrels and crates, wooden structure and chopped logs.',
    tags: ['scene', 'survival', 'camp', 'outpost', 'workshop', 'outdoor', 'wilderness', 'low-poly'],
    async build(c) { const { P, r, pick } = c; await P(SV, 'patch-grass-large', 0, 0, { s: 2.6 }); await P(SV, 'tent', -1.8, -0.6, { ry: 0.5, s: 1.6 }); await P(SV, 'campfire-pit', 0.2, 0.8, { s: 1.6 }); await P(SV, 'campfire-fishing-stand', 0.2, 0.8, { s: 1.6 }); await P(SV, 'structure-roof', 2.3, -1.2, { s: 1.6, ry: -0.4 });
      await P(SV, 'workbench', 1.2, -0.6, { s: 1.6, ry: 0.3 }); await P(SV, 'workbench-anvil', 1.9, 0.3, { s: 1.6 }); await P(SV, 'chest', -0.5, -1.7, { s: 1.6, ry: 0.2 }); await P(SV, 'barrel', -2.4, 0.9, { s: 1.6 }); await P(SV, 'barrel-open', -2.0, 1.4, { s: 1.6 }); await P(SV, 'box-large', 2.8, 1.0, { s: 1.6, ry: 0.5 }); await P(SV, 'box', 2.3, 1.8, { s: 1.6 }); await P(SV, 'resource-wood', -0.6, 1.6, { s: 1.6 }); await P(SV, 'resource-planks', 0.6, 2.0, { s: 1.6, ry: 0.4 }); await P(SV, 'bedroll', -1.6, 1.8, { s: 1.6, ry: 1.2 }); await P(SV, 'signpost', 1.0, 2.6, { s: 1.6, ry: 0.3 });
      await scatterRing(c, SV, ['tree', 'tree-tall', 'tree-autumn', 'rock-a', 'rock-b', 'grass-large', 'tree-trunk'], 18, 3.6, 5.2, () => true, { s: 1.6 }); } },
  { slug: 'haunted-graveyard', title: 'Haunted Graveyard', seed: 37,
    description: 'A moonlit-style graveyard with rows of gravestones and crosses, an iron fence and gate, a stone crypt, lampposts, pumpkins, dead pines and a few ghostly residents.',
    tags: ['scene', 'graveyard', 'halloween', 'spooky', 'cemetery', 'crypt', 'outdoor', 'low-poly'],
    async build(c) { const { P, r, pick, b } = c; b.slab(12, 12, 0.2, [0.28, 0.4, 0.28], 'Lawn', 0); await P(GY, 'road', 0, 5, { s: 1 }); for (let z = 5; z > -2; z -= 0.8) await P(GY, 'road', 0, z);
      const stones = ['gravestone-bevel', 'gravestone-cross', 'gravestone-round', 'gravestone-wide', 'gravestone-decorative', 'cross', 'gravestone-broken'];
      for (const x of [-3.4, -2.2, 2.2, 3.4]) for (const z of [-0.5, 1.4, 3.2]) { await P(GY, 'grave', x, z + 0.6); await P(GY, pick(stones), x, z - 0.1, { ry: 0 }); }
      for (let x = -5; x <= 5; x += 1) await P(GY, 'iron-fence', x, 5.7); await P(GY, 'iron-fence-border-gate', 0, 5.7);
      await P(GY, 'crypt-large', 0, -3.8); await P(GY, 'lightpost-single', -1.2, 3.5); await P(GY, 'lightpost-single', 1.2, 3.5, { ry: Math.PI }); await P(GY, 'pumpkin-carved', 1.0, 4.5); await P(GY, 'pumpkin', -1.1, 4.4); await P(GY, 'character-ghost', -1.8, 0.6, { y: 0.1 }); await P(GY, 'candle-multiple', 0.8, -1.9);
      await scatterRing(c, GY, ['pine', 'pine-crooked', 'pine-fall'], 8, 4.4, 5.6, (x, z) => z < 4.8); await P(GY, 'bench', 2.5, 4.4, { ry: Math.PI }); } },
  { slug: 'pirate-cove', title: 'Pirate Cove', seed: 38,
    description: 'A sheltered pirate cove with a sandy beach, palms, rocks, a moored ship, a rowboat, dock platforms, chests, barrels, cannons and a lookout tower.',
    tags: ['scene', 'pirate', 'cove', 'beach', 'ship', 'nautical', 'outdoor', 'low-poly'],
    async build(c) { const { P, r, pick, b } = c; b.slab(40, 40, 0.5, [0.2, 0.5, 0.7], 'Sea', -0.05); await P(PK, 'patch-sand', -3, 6, { s: 2.2 }); await P(PK, 'patch-sand-foliage', 9, 6, { s: 1.8 });
      await P(PK, 'ship-pirate-medium', -2, -9, { s: 1.4, ry: 0.4, y: 0.1 }); await P(PK, 'boat-row-small', 6, -2, { ry: 1.2, y: 0.05 }); await P(PK, 'structure-platform-dock', 4, 1); await P(PK, 'structure-platform-dock', 4, 3.6); await P(PK, 'tower-complete-small', 12, 7, { s: 1.2 });
      for (const [x, z] of [[-4, 6], [0, 8], [-8, 4], [8, 9], [3, 7]]) await P(PK, pick(['palm-straight', 'palm-bend', 'palm-detailed-bend']), x, z, { ry: r() * 6 });
      await P(PK, 'chest', -2, 5, { ry: 0.4 }); await P(PK, 'barrel', -4.5, 7.5); await P(PK, 'barrel', -5.5, 7.2); await P(PK, 'crate', 2.4, 6); await P(PK, 'cannon', -1, 7.5, { ry: -0.6 }); await P(PK, 'cannon-ball', -0.2, 6.5);
      for (const [x, z, n] of [[-12, -2, 'rocks-sand-a'], [14, -3, 'rocks-sand-b'], [-9, 9, 'rocks-sand-c'], [10, 14, 'rocks-c']]) await P(PK, n, x, z, { s: 1.1 }); await P(PK, 'flag-pirate-high', 12, 7, { y: 6.8, s: 0.6 }); } },
  { slug: 'village-market-square', title: 'Village Market Square', seed: 39,
    description: 'A cobbled market square with a round stone fountain, striped stalls, handcarts, lanterns, hedges, fences and trees around the edges.',
    tags: ['scene', 'market', 'village', 'town-square', 'medieval', 'fantasy', 'outdoor', 'low-poly'],
    async build(c) { const { P, r, pick, b } = c; b.slab(12, 12, 0.1, [0.62, 0.58, 0.5], 'Cobbles', 0); await P(FT, 'fountain-round-detail', 0, 0);
      await P(FT, 'stall-red', -3.3, -2.2, { ry: 0.3 }); await P(FT, 'stall-green', 3.3, -2.2, { ry: -0.3 }); await P(FT, 'stall', -3.4, 2.6, { ry: Math.PI / 2 + 0.2 }); await P(FT, 'stall-bench', 3.4, 2.6, { ry: -Math.PI / 2 }); await P(FT, 'stall-stool', 3.0, 2.2);
      await P(FT, 'cart', -1.8, 3.8, { ry: 0.5 }); await P(FT, 'cart-high', 1.8, -3.8, { ry: -2.6 }); for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) await P(FT, 'lantern', x, z);
      for (let x = -5; x <= 5; x += 1) { await P(FT, 'hedge', x, -5.6, { ry: Math.PI / 2 }); } for (const [x, z] of [[-5.5, -4], [5.5, -4], [-5.5, 4.5], [5.5, 4.5], [-5.6, 0], [5.6, 0]]) await P(FT, pick(['tree', 'tree-crooked', 'tree-high-round']), x, z); await P(FT, 'banner-red', -3.3, -3.3, { y: 0.6 }); } },
  { slug: 'dungeon-banquet-hall', title: 'Dungeon Banquet Hall', seed: 40,
    description: 'A torch-lit stone hall with long feast tables, stools, barrels, kegs, chests, banners, pillars and candles inside arched stone walls.',
    tags: ['scene', 'dungeon', 'hall', 'banquet', 'fantasy', 'medieval', 'interior', 'low-poly'],
    async build(c) { const { P, r, pick } = c; for (const x of [-4, 0, 4]) for (const z of [-4, 0, 4]) await P(DG, 'floor_tile_large', x, z);
      for (const x of [-4, 0, 4]) await P(DG, x === 0 ? 'wall_archedwindow_open' : 'wall', x, -6.5); for (const z of [-4, 0, 4]) await P(DG, 'wall', -6.5, z, { ry: Math.PI / 2 });
      await P(DG, 'table_long_tablecloth_decorated_A', -1.2, -0.4, { ry: Math.PI / 2 }); await P(DG, 'table_long_decorated_C', 2.2, 0.6, { ry: Math.PI / 2 }); for (const x of [-2.6, -1.2, 0.2]) await P(DG, 'stool', x, 1.1); for (const x of [-2.4, -0.8]) await P(DG, 'chair', x, -1.9, { ry: Math.PI });
      await P(DG, 'pillar', -3.2, -3.2); await P(DG, 'pillar', 3.4, -3.2); await P(DG, 'keg_decorated', -5, 3.5); await P(DG, 'barrel_large', -5.4, 1.2); await P(DG, 'chest_gold', 4.8, 4.6, { ry: -0.5 }); await P(DG, 'crates_stacked', 5, -1.5); await P(DG, 'torch_mounted', -2, -6, { y: 2.2 }); await P(DG, 'torch_mounted', 2, -6, { y: 2.2 }); await P(DG, 'banner_shield_red', -6, 0, { y: 0.4, ry: Math.PI / 2 }); await P(DG, 'banner_blue', 0, -5.9, { y: 0.4 }); await P(DG, 'candle_triple', -1.2, 0.3, { y: 1.0 }); } },
  { slug: 'suburban-street-corner', title: 'Suburban Street Corner', seed: 41,
    description: 'A suburban street corner with detached houses, garden fences, paths, road bend and straight sections, street lights, trees and signs.',
    tags: ['scene', 'city', 'suburban', 'street', 'houses', 'neighbourhood', 'outdoor', 'low-poly'],
    async build(c) { const { P, r, pick, b } = c; b.slab(10, 10, 0.1, [0.35, 0.55, 0.3], 'Lawns', -0.01);
      for (let x = -4; x <= 4; x++) await P(CR, 'road-straight', x, 0, { ry: Math.PI / 2 }); for (let z = 1; z <= 4; z++) await P(CR, 'road-straight', 0, z);
      await P(CR, 'road-crossroad', 0, 0);
      const types = ['building-type-a', 'building-type-c', 'building-type-e', 'building-type-g', 'building-type-k', 'building-type-m']; let i = 0;
      for (const [x, z, ry] of [[-3, -1.3, Math.PI], [-1.2, -1.3, Math.PI], [1.4, -1.3, Math.PI], [3.2, -1.3, Math.PI], [-2.2, 2.2, Math.PI / 2], [2.2, 2.2, -Math.PI / 2]]) await P(SB, types[i++ % types.length], x, z, { ry });
      await P(CR, 'light-square', -1, -0.7); await P(CR, 'light-square', 2, 0.7, { ry: Math.PI }); await P(CR, 'road-sign-stop', 0.8, 0.8); for (const [x, z] of [[-4, -2.2], [4, -2.2], [-4, 3], [4, 3]]) await P(SB, 'tree-large', x, z); } },
  { slug: 'medieval-hex-village', title: 'Medieval Hex Village', seed: 42,
    description: 'A compact medieval settlement of homes, a tavern, church, market, blacksmith, windmill and well behind a stone wall with a gate and watchtowers.',
    tags: ['scene', 'village', 'medieval', 'town', 'buildings', 'fantasy', 'strategy', 'low-poly'],
    async build(c) { const { P, r, pick, b } = c; b.slab(9, 9, 0.2, [0.42, 0.62, 0.32], 'Meadow', 0);
      await P(HX, 'building_church_red', 0, -1.8); await P(HX, 'building_tavern_red', -2.4, 0, { ry: 1.2 }); await P(HX, 'building_market_red', 2.4, 0, { ry: -1.2 }); await P(HX, 'building_blacksmith_red', -2.4, 2.2, { ry: 0.8 }); await P(HX, 'building_home_A_red', 2.2, 2.4, { ry: -0.6 }); await P(HX, 'building_home_B_red', 0, 2.4, { ry: 0.2 }); await P(HX, 'building_windmill_red', -3.2, -2.6); await P(HX, 'building_well_red', 0, 0.3); await P(HX, 'building_watermill_red', 3.2, -2.6, { ry: 0.5 }); await P(HX, 'building_tower_A_red', -4, 4); await P(HX, 'building_tower_B_red', 4, 4);
      for (const x of [-2, 0, 2]) await P(HX, x === 0 ? 'wall_straight_gate' : 'wall_straight', x, 4.2); for (const x of [-3, -1, 1, 3]) await P(HX, 'fence_wood_straight', x, -4.2, { ry: Math.PI / 2 }); } },
);

const MA = 'mini-arcade', TD = 'tower-defense-kit', CC = 'city-kit-commercial';
SCENES.push(
  { slug: 'retro-arcade-hall', title: 'Retro Arcade Hall', seed: 51,
    description: 'An arcade hall with rows of cabinets, pinball, claw and dance machines, air hockey, a prize counter with cash register, a vending machine and two patrons.',
    tags: ['scene', 'arcade', 'games', 'interior', 'retro', 'entertainment', 'indoor', 'low-poly'],
    async build(c) { const { P } = c; for (let x = 0; x < 8; x++) for (let z = 0; z < 6; z++) await P(MA, 'floor', x + 0.5 - 4, z + 0.5 - 3);
      for (let x = 0; x < 8; x++) await P(MA, x === 3 ? 'wall-window' : 'wall', x + 0.5 - 4, -3.3); for (let z = 0; z < 6; z++) await P(MA, z === 2 ? 'wall-door-rotate' : 'wall', -4.3, z + 0.5 - 3, { ry: Math.PI / 2 });
      for (let i = 0; i < 6; i++) await P(MA, 'arcade-machine', -3 + i * 0.7, -2.7, { ry: 0 }); await P(MA, 'pinball', -3, -1.2); await P(MA, 'pinball', -2.2, -1.2); await P(MA, 'claw-machine', 0, -1.2); await P(MA, 'dance-machine', 1.8, -1.0); await P(MA, 'basketball-game', 3.2, -1.2, { ry: -Math.PI / 2 }); await P(MA, 'air-hockey', 0.2, 0.9, { ry: Math.PI / 2 });
      await P(MA, 'prizes', 3.2, 1.6, { ry: Math.PI }); await P(MA, 'cash-register', 2.2, 2.2); await P(MA, 'ticket-machine', 3.3, 2.7); await P(MA, 'vending-machine', -3.4, 2.4, { ry: Math.PI / 2 }); await P(MA, 'prize-wheel', -2.5, 2.4);   await P(MA, 'column', -0.2, 2.0); } },
  { slug: 'downtown-city-block', title: 'Downtown City Block', seed: 52,
    description: 'A downtown block with skyscrapers and mid-rise commercial buildings around a crossroads, road sections, street lights and parasols.',
    tags: ['scene', 'city', 'downtown', 'skyscraper', 'urban', 'commercial', 'streets', 'outdoor', 'low-poly'],
    async build(c) { const { P, b } = c; b.slab(10, 10, 0.1, [0.5, 0.52, 0.5], 'Pavement', -0.01);
      for (let x = -4; x <= 4; x++) await P(CR, 'road-straight', x, 0, { ry: Math.PI / 2 }); for (let z = -4; z <= 4; z++) if (z) await P(CR, 'road-straight', 0, z); await P(CR, 'road-crossroad', 0, 0);
      const bl = ['building-skyscraper-a', 'building-skyscraper-d', 'building-skyscraper-c', 'building-skyscraper-b', 'building-m', 'building-l', 'building-n', 'building-i', 'building-e', 'building-f']; let i = 0;
      for (const [x, z] of [[-2.6, -2.2], [-2.6, -3.9], [2.6, -2.4], [2.6, -3.9], [-3.4, 2.4], [-1.8, 2.5], [2.8, 2.6], [1.6, 3.9], [-3.3, 3.9]]) await P(CC, bl[i++ % bl.length], x, z, { ry: x < 0 ? -Math.PI / 2 : Math.PI / 2 });
      await P(CR, 'light-square', -0.8, 0.8); await P(CR, 'light-square', 0.8, -0.8, { ry: Math.PI }); await P(CC, 'detail-parasol-a', -1.1, -1.2); await P(CC, 'detail-parasol-b', 1.2, 1.3); } }

);
