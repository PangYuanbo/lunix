// Faithful 1:1 port of crates/warp_util/src/local_or_remote_path.rs — the canonical file-identity
// type, either Local(path string) or Remote(RemotePath). Local-path operations route through the
// ported StandardizedPath for component-aware starts_with/strip_prefix (so /repo never matches
// /repository) and Path::join absolute-replacement semantics.
'use strict';
const path = require('path');
const { StandardizedPath } = require('./standardized_path');
const { RemotePath } = require('./remote_path');

class LocalOrRemotePath {
  constructor(kind, value) { this.kind = kind; this.value = value; } // kind: 'Local' (string) | 'Remote' (RemotePath)
  static Local(p) { return new LocalOrRemotePath('Local', String(p)); }
  static Remote(remote) { return new LocalOrRemotePath('Remote', remote); }

  isLocal() { return this.kind === 'Local'; }
  isRemote() { return this.kind === 'Remote'; }

  pathComponent() {
    return this.kind === 'Local' ? StandardizedPath.fromLocalAbsoluteUnchecked(this.value) : this.value.path;
  }
  displayName() {
    return this.kind === 'Local' ? path.basename(this.value) : (this.value.path.fileName() || '');
  }
  displayPath() {
    return this.kind === 'Local' ? this.value : this.value.path.asStr();
  }
  parent() {
    if (this.kind === 'Local') {
      const par = path.dirname(this.value);
      return par === this.value ? null : LocalOrRemotePath.Local(par);
    }
    const par = this.value.path.parent();
    return par ? LocalOrRemotePath.Remote(RemotePath.new(this.value.host_id, par)) : null;
  }
  fileName() {
    if (this.kind === 'Local') { const b = path.basename(this.value); return b === '' ? null : b; }
    return this.value.path.fileName();
  }
  startsWith(base) {
    if (this.kind === 'Local' && base.kind === 'Local') {
      return StandardizedPath.fromLocalAbsoluteUnchecked(this.value).startsWith(StandardizedPath.fromLocalAbsoluteUnchecked(base.value));
    }
    if (this.kind === 'Remote' && base.kind === 'Remote') {
      return this.value.host_id.equals(base.value.host_id) && this.value.path.startsWith(base.value.path);
    }
    return false;
  }
  toLocalPath() { return this.kind === 'Local' ? this.value : null; }
  asRemote() { return this.kind === 'Remote' ? this.value : null; }

  join(segment) {
    if (this.kind === 'Local') {
      const joined = path.isAbsolute(segment) ? segment : path.join(this.value, segment);
      return LocalOrRemotePath.Local(joined);
    }
    return LocalOrRemotePath.Remote(RemotePath.new(this.value.host_id, this.value.path.join(segment)));
  }
  strip_repo_prefix(file) {
    if (this.kind === 'Local' && file.kind === 'Local') {
      return StandardizedPath.fromLocalAbsoluteUnchecked(file.value).stripPrefix(StandardizedPath.fromLocalAbsoluteUnchecked(this.value));
    }
    if (this.kind === 'Remote' && file.kind === 'Remote' && this.value.host_id.equals(file.value.host_id)) {
      return file.value.path.stripPrefix(this.value.path);
    }
    return null;
  }
}

module.exports = { LocalOrRemotePath };
