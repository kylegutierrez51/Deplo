export function checkBranches(target: string, branchFilters: string[]): boolean {
  if (!branchFilters.length) return true;

  let trimmed = target;
  const firstSlash = target.indexOf('/');
  
  if (firstSlash !== -1) {
    trimmed = target.substring(0, firstSlash);
  }

  for (const branch of branchFilters) {
    if (trimmed === branch) return true;
    else if (trimmed === branch.substring(0, trimmed.length)) {
      if (branch.length > trimmed.length && branch.length < trimmed.length + 2 && branch[trimmed.length] ==='/') {
        return true;
      }
      else if (branch.length > trimmed.length + 1 && branch.length < trimmed.length + 3 && branch[trimmed.length] === '/' && branch[trimmed.length + 1] === '*') {
        return true;
      }
    }
  }

  return false;
}