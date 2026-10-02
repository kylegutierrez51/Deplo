import { NO_ENVIRONMENT, resolveInitialEnvironment } from '@/lib/pipeline/environment-param';

const ids = ['env-1', 'env-2'];

describe('resolveInitialEnvironment', () => {
  it('opens on the pipeline default when the URL names nothing', () => {
    expect(resolveInitialEnvironment(undefined, 'env-2', ids)).toBe('env-2');
  });

  it('prefers the environment chosen in the URL over the default', () => {
    expect(resolveInitialEnvironment('env-1', 'env-2', ids)).toBe('env-1');
  });

  // The reader cleared the picker; a refresh must not put the default back.
  it('honours an explicit choice of no environment over the default', () => {
    expect(resolveInitialEnvironment(NO_ENVIRONMENT, 'env-2', ids)).toBeNull();
  });

  it('opens on nothing when there is neither a choice nor a default', () => {
    expect(resolveInitialEnvironment(undefined, null, ids)).toBeNull();
  });


  /* When you insert an environment in the URL and delete that environment
      while still having it in the URL, 'Run Pipeline' sends back
     "The selected environment no longer exists. Pick another." */
  it('falls back to the default when the URL names an environment that no longer exists', () => {
    expect(resolveInitialEnvironment('env-gone', 'env-2', ids)).toBe('env-2');
    expect(resolveInitialEnvironment('env-gone', null, ids)).toBeNull();
  });

  it('treats a repeated param as no choice', () => {
    expect(resolveInitialEnvironment(['env-1', 'env-2'], 'env-2', ids)).toBe('env-2');
    expect(resolveInitialEnvironment(['env-1', 'env-2'], null, ids)).toBeNull();
  });

  // The foreign key nulls a deleted default, but the list and the pipeline are read separately.
  it('ignores a default that is not among the environments', () => {
    expect(resolveInitialEnvironment(undefined, 'env-gone', ids)).toBeNull();
  });
});
