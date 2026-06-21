// Module mirror of Warp crate `repo_metadata` (Rust: crates/repo_metadata, 13084 LOC).
// STATUS: partial — faithful 1:1 port of the self-contained file-tree flattening from
// crates/repo_metadata/src/file_tree_update.rs (flatten_entry_metadata + the RepoNodeMetadata /
// RepoMetadataUpdate proto-mirror shapes). The stateful FileTreeStore / LocalRepoMetadataModel
// mutation+update application (file_tree_store.rs / local_model.rs) depend on warpui_core/ignore
// and are not ported here.
'use strict';

// Entry model (entry.rs): File(FileMetadata) | Directory(DirectoryEntry).
const Entry = {
  File: (fileMetadata) => ({ kind: 'File', ...fileMetadata }),
  Directory: (dirEntry) => ({ kind: 'Directory', ...dirEntry }),
};
const FileMetadata = ({ path, extension = null, ignored = false } = {}) => ({ path, extension, ignored });
const DirectoryEntry = ({ path, children = [], ignored = false, loaded = true } = {}) => ({ path, children, ignored, loaded });

// RepoNodeMetadata (proto mirror): Directory(DirectoryNodeMetadata) | File(FileNodeMetadata).
const RepoNodeMetadata = {
  Directory: ({ path, ignored, loaded }) => ({ kind: 'Directory', path, ignored, loaded }),
  File: ({ path, extension = null, ignored = false }) => ({ kind: 'File', path, extension, ignored }),
};

// Faithful port of flatten_entry_metadata: depth-first pre-order (directories before children).
function flattenEntryMetadata(entry) {
  const metadata = [];
  collectMetadata(entry, metadata);
  return metadata;
}
function collectMetadata(entry, metadata) {
  if (entry.kind === 'File') metadata.push(fileMetadataToNode(entry));
  else collectDirectoryMetadata(entry, metadata);
}
function collectDirectoryMetadata(dir, metadata) {
  metadata.push(RepoNodeMetadata.Directory({ path: dir.path, ignored: dir.ignored, loaded: dir.loaded }));
  for (const child of dir.children) collectMetadata(child, metadata);
}
function fileMetadataToNode(file) {
  return RepoNodeMetadata.File({ path: file.path, extension: file.extension, ignored: file.ignored });
}

const standingQueries = require('./standing_queries');

module.exports = {
  __crate: 'repo_metadata', __status: 'partial', __rustLoc: 13084,
  Entry, FileMetadata, DirectoryEntry, RepoNodeMetadata, flattenEntryMetadata,
  standingQueries,
};
