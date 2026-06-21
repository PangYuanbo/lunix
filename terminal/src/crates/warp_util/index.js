// Module mirror of Warp crate `warp_util` (Rust: crates/warp_util, lib + submodules).
// STATUS: ported (worktree_names) — faithful 1:1 port of crates/warp_util/src/worktree_names.rs
// (desert-themed unique git-worktree branch-name generator). The Rust uses the `rand` crate's
// StdRng; here the algorithm is identical and driven by an injectable seedable PRNG (mulberry32),
// so the determinism/structure properties the Rust tests assert hold. Other warp_util submodules
// (standardized_path, file_type, on_cancel, ...) remain to port.
'use strict';

const WORDS = ["alcove", "arch", "arroyo", "badlands", "bajada", "basin", "bluff", "bolson", "butte", "caldera", "canyon", "caprock", "chasm", "chimney", "cinder", "coulee", "crag", "crater", "cuesta", "dune", "escarpment", "flats", "gap", "gorge", "gulch", "hogback", "inselberg", "lava", "ledge", "malpais", "mesa", "mogote", "monolith", "notch", "outcrop", "pass", "pediment", "pinnacle", "plateau", "playa", "ravine", "ridge", "rimrock", "saddle", "scree", "spire", "switchback", "talus", "tepui", "wash", "agave", "barrel", "brittlebush", "cactus", "candelilla", "chamisa", "chaparral", "cholla", "claret", "creosote", "fishhook", "hedgehog", "ironwood", "jojoba", "joshua", "juniper", "lechuguilla", "lupine", "madrone", "mallow", "manzanita", "mariposa", "mesquite", "ocotillo", "organ-pipe", "palo-verde", "pinyon", "prickly", "rabbitbrush", "sagebrush", "saguaro", "saltbush", "sotol", "tumbleweed", "yucca", "armadillo", "badger", "bighorn", "bobcat", "burrowing-owl", "centipede", "coachwhip", "cottontail", "cougar", "coyote", "falcon", "gecko", "gila", "hawk", "horned-toad", "jackrabbit", "javelina", "kingsnake", "kit-fox", "mule-deer", "nighthawk", "prairie-dog", "pronghorn", "quail", "racer", "rattler", "ringtail", "roadrunner", "scorpion", "sidewinder", "swift", "tarantula", "thrasher", "tortoise", "vulture", "wren", "agate", "basalt", "calcite", "cinnabar", "cobalt", "copper", "feldspar", "flint", "garnet", "granite", "gypsum", "iron", "jasper", "limestone", "malachite", "mica", "obsidian", "onyx", "opal", "petrified", "pumice", "pyrite", "quartz", "sandstone", "shale", "tin", "topaz", "travertine", "turquoise", "zinc", "acequia", "adobe", "cumbre", "equinox", "hacienda", "latilla", "luminaria", "metate", "mirador", "nicho", "olla", "oz", "petroglyph", "pictograph", "portal", "ramada", "rio", "ristra", "sierra", "siesta", "solstice", "tierra", "tinaja", "viga", "brushfire", "corona", "dawn", "drought", "dry-lightning", "dusk", "dust-devil", "ember", "firestorm", "flash-flood", "haze", "mirage", "monsoon", "moonrise", "shimmer", "smoke", "starlight", "sundog", "sundowner", "thermal", "twilight", "wildfire", "zephyr"];

const MAX_RETRIES_PER_LEVEL = 2;
const MAX_WORD_COUNT = 5;

// Seedable deterministic PRNG (mulberry32) — stands in for Rust's StdRng::seed_from_u64.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seededRng = (seed) => mulberry32(seed);

// Faithful analog of SliceRandom::choose_multiple: pick `k` distinct items (Floyd's algorithm).
function chooseMultiple(items, k, rng) {
  const n = items.length;
  const picked = new Set();
  const out = [];
  for (let i = n - k; i < n; i++) {
    const j = Math.floor(rng() * (i + 1));
    const idx = picked.has(j) ? i : j;
    picked.add(idx);
    out.push(items[idx]);
  }
  return out;
}

// Port of generate_name.
function generateName(wordCount, existing, rng) {
  for (let attempt = 0; attempt < MAX_RETRIES_PER_LEVEL; attempt++) {
    const name = chooseMultiple(WORDS, wordCount, rng).join('-');
    if (!existing.has(name)) return name;
  }
  return null;
}

// Port of generate_unique_name: start at 2 words, escalate on collision, numeric fallback.
function generateUniqueName(existing, rng) {
  for (let wc = 2; wc <= MAX_WORD_COUNT; wc++) {
    const name = generateName(wc, existing, rng);
    if (name != null) return name;
  }
  const nbig = Math.floor(rng() * 0xFFFFFFFF);
  return `worktree-${nbig}`;
}

// Port of generate_worktree_branch_name: uses a non-deterministic RNG by default.
function generateWorktreeBranchName(existing) {
  return generateUniqueName(existing, Math.random);
}

const { StandardizedPath, InvalidPathError } = require('./standardized_path');
const fileType = require('./file_type');
const { ContentVersion } = require('./content_version');
const { Aborted, withOnCancel } = require('./on_cancel');
const { HostId, RemotePath } = require('./remote_path');
const { LocalOrRemotePath } = require('./local_or_remote_path');
const pathUtil = require('./path');

module.exports = {
  __crate: 'warp_util', __status: 'ported', __rustLoc: 4007,
  WORDS, MAX_WORD_COUNT, seededRng, chooseMultiple, generateName, generateUniqueName, generateWorktreeBranchName,
  StandardizedPath, InvalidPathError, ContentVersion, Aborted, withOnCancel,
  HostId, RemotePath, LocalOrRemotePath, pathUtil,
  ...fileType,
};
