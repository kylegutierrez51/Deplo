'use client';

import { useOptimistic, useTransition, type ComponentProps } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import FilterListbox from './FilterListbox';

type QueryFilterListboxProps = Omit<ComponentProps<typeof FilterListbox>, 'value' | 'defaultValue' | 'setFilteredOption'> & {
  /* The value the server parsed out of the URL */
  value: string;
};

/*
=======================================================================================
  Whenever a user selects a filter, this component sets the URL params, refreshing the page's server component to fetch the filtered data 

  'setOptimistic(next)' changes the frontend 'FilterListBox' to have the value the user selected immediately, before the server action for querying the DB succeeds. Without it, there's visible delay.

  When the user selects a generic filter (e.g., 'All statuses', 'All triggers'), the if statement does not allow something like 'status=all' to show in the URL params
=======================================================================================
 */
export default function QueryFilterListbox({ name, options, value, ...rest }: QueryFilterListboxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [, startTransition] = useTransition();

  const select = (next: string) => startTransition(() => {
    setOptimistic(next);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // start from 1st page
    if (next === options[0]?.value) params.delete(name);
    else params.set(name, next);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  });

  return <FilterListbox {...rest} name={name} options={options} value={optimistic} setFilteredOption={select} />;
}
