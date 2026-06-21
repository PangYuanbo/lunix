// Module mirror of Warp crate `settings` (Rust: crates/settings, 4291 LOC).
// STATUS: partial — faithful 1:1 port of the pure toml_path helpers from crates/settings/src/lib.rs
// (toml_path_storage_key, toml_path_hierarchy) plus the SettingSchemaEntry shape from schema.rs.
// The settings manager, define_setting! macros, and platform-native preference backends
// (UserPreferences / secure_storage via warpui_core/warpui_extras) are runtime-coupled and not ported.
'use strict';

// toml_path_storage_key: the last dot-separated segment ("appearance.text.font_name" -> "font_name").
function tomlPathStorageKey(path) {
  const i = path.lastIndexOf('.');
  return i === -1 ? path : path.slice(i + 1);
}

// toml_path_hierarchy: everything before the final dot, or null when there is no dot.
function tomlPathHierarchy(path) {
  const i = path.lastIndexOf('.');
  return i === -1 ? null : path.slice(0, i);
}

// SettingSchemaEntry shape (schema.rs) — metadata for JSON-Schema generation.
function settingSchemaEntry({ storageKey, description = '', hierarchy = null, isPrivate = false,
  featureFlag = null, supportedPlatformsFn = () => null, defaultValueFn = () => 'null',
  fileDefaultValueFn = () => 'null', maxTableDepth = null } = {}) {
  return { storageKey, description, hierarchy, isPrivate, featureFlag, supportedPlatformsFn, defaultValueFn, fileDefaultValueFn, maxTableDepth };
}

module.exports = {
  __crate: 'settings', __status: 'partial', __rustLoc: 4291,
  tomlPathStorageKey, tomlPathHierarchy, settingSchemaEntry,
};
