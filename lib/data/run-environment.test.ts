import { toRunEnvironment } from '@/lib/data/run-environment';

/*
 * Deleting an environment nulls environmentId on its runs, so the name and type copied onto the
 * run at creation are the only record left. These pin which source wins and how a deleted
 * environment is told apart from a run that never had one.
 */
describe('toRunEnvironment', () => {
  it('uses the live environment while it exists', () => {
    expect(toRunEnvironment({
      environment: { name: 'prod', type: 'PRODUCTION' },
      environmentName: 'prod', environmentType: 'PRODUCTION',
    })).toEqual({ name: 'prod', type: 'production', deleted: false });
  });

  // The copy is the name at run time; while the environment exists, the live row is the truth.
  it('prefers the live name over the copy for a renamed environment', () => {
    expect(toRunEnvironment({
      environment: { name: 'production-eu', type: 'PRODUCTION' },
      environmentName: 'prod', environmentType: 'PRODUCTION',
    })).toEqual({ name: 'production-eu', type: 'production', deleted: false });
  });

  it('falls back to the copy, marked deleted, once the environment is gone', () => {
    expect(toRunEnvironment({
      environment: null, environmentName: 'prod', environmentType: 'PRODUCTION',
    })).toEqual({ name: 'prod', type: 'production', deleted: true });
  });

  // Runs created before environmentType existed carry a name and nothing else.
  it('keeps a deleted environment with no recorded type', () => {
    expect(toRunEnvironment({
      environment: null, environmentName: 'prod', environmentType: null,
    })).toEqual({ name: 'prod', type: null, deleted: true });
  });

  it('returns null for a run that never had an environment', () => {
    expect(toRunEnvironment({ environment: null, environmentName: null, environmentType: null })).toBeNull();
  });
});
