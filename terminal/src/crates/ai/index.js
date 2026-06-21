// Module mirror of Warp crate `ai` (Rust: crates/ai, 27501 LOC).
// STATUS: partial — faithful 1:1 port of the self-contained ChangedFiles change-set merge logic
// from crates/ai/src/index/full_source_code_embedding/changed_files.rs (used by the source-code
// embedding index). The agent loop, model providers, embeddings, and skills are runtime/backend
// coupled and not ported here.
'use strict';

// ChangedFiles: two sets of paths (deletions, upsertions). merge_subsequent applies a later batch,
// where a path moving to the other set removes it from the previous one (last write wins).
class ChangedFiles {
  constructor() { this.deletions = new Set(); this.upsertions = new Set(); }
  isEmpty() { return this.deletions.size === 0 && this.upsertions.size === 0; }

  mergeSubsequent(subsequent) {
    for (const path of subsequent.deletions) {
      this.upsertions.delete(path); // a later deletion supersedes a prior upsertion
      this.deletions.add(path);
    }
    for (const path of subsequent.upsertions) {
      this.deletions.delete(path); // a later upsertion supersedes a prior deletion
      this.upsertions.add(path);
    }
  }

  // Classify paths by current filesystem existence (exists -> upsertion, else deletion).
  addPaths(paths, exists = require('fs').existsSync) {
    for (const path of paths) {
      if (exists(path)) this.upsertions.add(path); else this.deletions.add(path);
    }
  }
}

const searchShaping = require('./search_shaping');
const skillsParser = require('./skills_parser');
const chunkerNaive = require('./chunker_naive');

module.exports = { __crate: 'ai', __status: 'partial', __rustLoc: 27501, ChangedFiles, searchShaping, skillsParser, chunkerNaive };
