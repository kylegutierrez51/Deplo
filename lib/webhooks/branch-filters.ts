// A filter selects the branch it names and every branch beneath it: "docs", "docs/"
// and "docs/*" all select "docs/env-test-example". Returns true if there are no filters.
export function checkBranches(target: string, branchFilters: string[]): boolean {
  if (!branchFilters.length) return true;

  for (const filter of branchFilters) {
    // "docs/*" and "docs/" both reduce to "docs"
    const base = filter.replace(/\/\*?$/, '');

    // the match has to end at a '/', so "docs" does not select "docsite"
    if (target === base || target.startsWith(base + '/')) return true;
  }

  return false;
}
