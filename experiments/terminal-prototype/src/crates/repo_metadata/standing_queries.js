// Faithful 1:1 port of crates/repo_metadata/src/standing_queries.rs — standing repository queries
// (project skill providers / SKILL.md files / rule files like WARP.md, AGENTS.md) maintained
// alongside the file tree. Path predicates use Rust Path semantics (component-aware ends_with,
// ancestors, parent, file_name) over local path strings. Symlink-following (record_followed_*,
// which calls is_file) is omitted; the rest of the classification + delta logic is ported.
'use strict';
const path = require('path');
const { StandardizedPath } = require('../warp_util/standardized_path');

const comps = (p) => p.split('/').filter(Boolean);
function endsWithComponents(p, rel) {
  const pc = comps(p), rc = comps(rel);
  if (rc.length === 0 || rc.length > pc.length) return false;
  return pc.slice(pc.length - rc.length).join('/') === rc.join('/');
}
function* ancestors(p) {
  let cur = p;
  for (;;) { yield cur; const par = path.dirname(cur); if (par === cur) break; cur = par; }
}

class StandingQueryDefinitions {
  constructor() { this.projectSkillProviderPaths = []; this.projectRuleFileNames = ['WARP.md', 'AGENTS.md']; }
  setProjectSkillProviderPaths(paths) { this.projectSkillProviderPaths = [...paths]; }
  isProjectSkillProviderDirectory(p) { return this.projectSkillProviderPaths.some((pp) => endsWithComponents(p, pp)); }
  projectSkillProviderAncestor(p) { for (const a of ancestors(p)) if (this.isProjectSkillProviderDirectory(a)) return a; return null; }
  isDirectProjectSkillProviderChild(p) { const par = path.dirname(p); return par !== p && this.isProjectSkillProviderDirectory(par); }
  isProjectSkillFile(p) {
    if (path.basename(p) !== 'SKILL.md') return false;
    const grand = path.dirname(path.dirname(p));
    return this.isProjectSkillProviderDirectory(grand);
  }
  isProjectRuleFile(p) {
    const name = path.basename(p);
    return this.projectRuleFileNames.some((r) => name.toLowerCase() === r.toLowerCase());
  }
}

const StandingQueryContent = {
  file: (sp) => ({ path: sp, is_directory: false }),
  directory: (sp) => ({ path: sp, is_directory: true }),
};
const contentKey = (c) => `${c.path.asStr()}|${c.is_directory}`;

class StandingQueryResults {
  constructor() { this._skills = new Map(); this._rules = new Map(); }
  projectSkills() { return [...this._skills.values()]; }
  projectRules() { return [...this._rules.values()]; }

  recordPath(p, isDirectory, definitions) {
    const std = StandardizedPath.fromLocalAbsoluteUnchecked(p);
    if (isDirectory && definitions.isProjectSkillProviderDirectory(p)) this.insertProjectSkill(StandingQueryContent.directory(std));
    if (!isDirectory && definitions.isProjectSkillFile(p)) this.insertProjectSkill(StandingQueryContent.file(std));
    if (!isDirectory && definitions.isProjectRuleFile(p)) this.insertProjectRule(StandingQueryContent.file(std));
  }
  recordDirectProjectSkillProviderChildChange(p, definitions) {
    if (definitions.isDirectProjectSkillProviderChild(p)) {
      const root = definitions.projectSkillProviderAncestor(p);
      if (root) this.insertProjectSkill(StandingQueryContent.directory(StandardizedPath.fromLocalAbsoluteUnchecked(root)));
    }
  }
  insertProjectSkill(content) { this._skills.set(contentKey(content), content); }
  insertProjectRule(content) { this._rules.set(contentKey(content), content); }

  applyDelta(delta) {
    for (const r of delta.removed_project_skills) this._skills.delete(contentKey(r));
    for (const r of delta.removed_project_rules) this._rules.delete(contentKey(r));
    for (const u of delta.upserted_project_skills) this._skills.set(contentKey(u), u);
    for (const u of delta.upserted_project_rules) this._rules.set(contentKey(u), u);
  }
  replaceSubtrees(removedRoots, discovered) {
    const delta = newDelta();
    for (const root of removedRoots) {
      for (const c of this._skills.values()) if (c.path.startsWith(root)) delta.removed_project_skills.push(c);
      for (const c of this._rules.values()) if (c.path.startsWith(root)) delta.removed_project_rules.push(c);
    }
    delta.upserted_project_skills.push(...discovered.projectSkills());
    delta.upserted_project_rules.push(...discovered.projectRules());
    this.applyDelta(delta);
    return delta;
  }
  asSnapshotDelta() {
    return { upserted_project_skills: this.projectSkills(), removed_project_skills: [], upserted_project_rules: this.projectRules(), removed_project_rules: [] };
  }
}

function newDelta() { return { upserted_project_skills: [], removed_project_skills: [], upserted_project_rules: [], removed_project_rules: [] }; }
const deltaIsEmpty = (d) => d.upserted_project_skills.length === 0 && d.removed_project_skills.length === 0 && d.upserted_project_rules.length === 0 && d.removed_project_rules.length === 0;
const deltaSkillsChanged = (d) => d.upserted_project_skills.length > 0 || d.removed_project_skills.length > 0;
const deltaRulesChanged = (d) => d.upserted_project_rules.length > 0 || d.removed_project_rules.length > 0;

module.exports = {
  StandingQueryDefinitions, StandingQueryContent, StandingQueryResults,
  newDelta, deltaIsEmpty, deltaSkillsChanged, deltaRulesChanged,
};
