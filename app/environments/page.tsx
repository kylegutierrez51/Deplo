import styles from './env.module.css';
import Sidebar from "@/components/layout/sidebar/Sidebar";
import Subheader from "@/components/layout/subheader/Subheader";
import AddButton from "@/components/layout/subheader/AddButton";
import QueryFilterListbox from "@/components/ui/filters/QueryFilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import DataTable from "@/components/ui/DataTable";
import EnvironmentRow from '@/components/environments/EnvironmentRow';
import Pagination from '@/components/ui/pagination/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import EnvModalController from '@/components/environments/EnvModalController';
import { getEnvironmentById, getEnvironments } from '@/lib/data/environments';
import { redirect } from 'next/navigation';
import { ENVIRONMENT_FILTERS } from '@/lib/filters/options';
import { hasActiveFilters, parseFilters } from '@/lib/filters/parse';

type SearchParams = Promise<{ mode?: string; id?: string; environment?: string; updated?: string; }>;

export default async function Environments({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { mode, id } = params;
  const filters = parseFilters(params, ENVIRONMENT_FILTERS);
  const filtered = hasActiveFilters(filters, ENVIRONMENT_FILTERS);

  const environments = await getEnvironments(filters);

  const record = id ? await getEnvironmentById(id) : undefined;

  // edge case where an env gets deleted in one tab while the user is editing or viewing it in another tab
  if (id && !record && mode !== "create") redirect("/environments");

  const modal =
    mode === "create" ? { mode: "create" as const } :
      record && mode === "edit" ? { mode: "edit" as const, record } :
        record ? { mode: "view" as const, record } :
          null;

  return (
    <>
      <Sidebar activeItem="environments" />

      <main className="page-content">

        <Subheader
          title="Environments"
          subtitle="Manage deploy targets and their secret scoping.">
          <AddButton text={"New Environment"} url={"environments"} />
        </Subheader>

        {environments.length > 0 || filtered ? (
          <>
            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput placeholder={"Search environments..."} />
                <QueryFilterListbox id={"environment"} name={"environment"} options={ENVIRONMENT_FILTERS.environment} value={filters.environment} />
                <QueryFilterListbox id={"updated"} name={"updated"} options={ENVIRONMENT_FILTERS.updated} value={filters.updated} />
              </div>
            </div>

            {environments.length > 0 ? (
              <>
                <DataTable columns={["Name", "Environment Type", "Secrets", "Last Updated"]}>
                  {environments.map((env) => (
                    <EnvironmentRow key={env.id} env={env} />
                  ))}
                </DataTable>

                <Pagination showing="1-10" totalRows={environments.length} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
              </>
            ) : (
              <EmptyState
                icon="funnel-outline"
                heading="No matching environments"
                description="No environments match these filters."
                action={{ label: "Clear filters", href: "/environments" }}
              />
            )}
          </>
        ) : (
          <EmptyState
            icon="settings-outline"
            heading="No environments yet"
            description="An environment is a deploy target. Runs execute against one, and it scopes which secrets they can read."
            action={{ label: "New Environment", href: "/environments?mode=create", icon: "add-outline" }}
          />
        )}
      </main>

      {modal && (
        <EnvModalController
          mode={modal.mode}
          env={modal.record}
        />
      )}
    </>
  )
}
