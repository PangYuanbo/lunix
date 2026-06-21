// Port of crates/warp_util/src/{host_id.rs, remote_path.rs} — a remote file identity: a HostId
// (opaque host identifier) paired with a StandardizedPath. Equality is by (host_id, path).
'use strict';
const { StandardizedPath } = require('./standardized_path');

class HostId {
  constructor(id) { this.id = id; }
  static new(id) { return new HostId(id); }
  equals(o) { return o instanceof HostId && this.id === o.id; }
}

class RemotePath {
  constructor(hostId, path) { this.host_id = hostId; this.path = path; } // path: StandardizedPath
  static new(hostId, path) { return new RemotePath(hostId, path); }
  equals(o) { return o instanceof RemotePath && this.host_id.equals(o.host_id) && this.path.equals(o.path); }
}

module.exports = { HostId, RemotePath, StandardizedPath };
