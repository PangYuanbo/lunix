// Module mirror of Warp crate `channel_versions` (Rust: crates/channel_versions, 778 LOC).
// STATUS: ported (core) — faithful port of ParsedVersion parsing + ordering and the
// channel-version data model from crates/channel_versions/src/lib.rs. The override engine
// (overrides.rs, Context::from_env) and serde flatten are modeled minimally; with no
// overrides, version_info() returns the version unchanged, matching the Rust default path.
'use strict';

const VERSION_RE = /v(\d+)\.(.+)\.(.+)_(\d+)/;

// Faithful port of ParsedVersion: { major, date, patch }. `date` is a Date built from the
// "%Y.%m.%d.%H.%M" middle group (UTC, seconds 0) for deterministic comparison.
function parseVersion(value) {
  const m = VERSION_RE.exec(value);
  if (!m) throw new Error("Can't parse string into Version");
  const dateStr = m[2]; // e.g. "2023.05.15.08.04"
  const p = dateStr.split('.');
  if (p.length !== 5) throw new Error("Can't parse string into Version");
  const [Y, Mo, D, H, Mi] = p.map((x) => parseInt(x, 10));
  if ([Y, Mo, D, H, Mi].some(Number.isNaN)) throw new Error("Can't parse string into Version");
  const date = new Date(Date.UTC(Y, Mo - 1, D, H, Mi, 0));
  // validate round-trip (Rust's NaiveDateTime::parse_from_str rejects invalid dates)
  if (date.getUTCMonth() !== Mo - 1 || date.getUTCDate() !== D) throw new Error("Can't parse string into Version");
  const major = parseInt(m[1], 10);
  const patch = parseInt(m[4], 10);
  return { major, date, patch };
}

// Ord by (major, date, patch) — port of the Rust Ord impl. Returns -1 | 0 | 1.
function compareVersions(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  const ad = a.date.getTime(), bd = b.date.getTime();
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

// VersionInfo (lib.rs) — minimal model; cli_version falls back to version.
function versionInfoCliVersion(info) { return info.cli_version != null ? info.cli_version : info.version; }

// ChannelVersions JSON parse that ignores unknown channels (beta/canary) like serde does.
// Returns { dev, preview, stable, changelogs? } with each channel exposing version_info().
function parseChannelVersions(json) {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  const chan = (c) => ({
    version_info: () => ({ ...c }),                 // no overrides applied -> unchanged
    version_info_for_execution_context: () => ({ ...c }),
    raw: c,
  });
  return { dev: chan(raw.dev), preview: chan(raw.preview), stable: chan(raw.stable), changelogs: raw.changelogs };
}

module.exports = {
  __crate: 'channel_versions', __status: 'ported', __rustLoc: 778,
  parseVersion, compareVersions, versionInfoCliVersion, parseChannelVersions,
};
