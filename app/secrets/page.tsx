import styles from "./secrets.module.css";
import Subheader from "@/components/layout/subheader/Subheader";
import AddButton from '@/components/layout/subheader/AddButton';
import Sidebar from "@/components/layout/sidebar/Sidebar";
import QueryFilterListbox from "@/components/ui/filters/QueryFilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import DataTable from "@/components/ui/DataTable";
import SecretRow from '@/components/secrets/SecretRow';
import Pagination from "@/components/ui/pagination/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import SecretModalController from '@/components/secrets/SecretModalController';
import { getSecretById, getSecretsPage } from '@/lib/data/secrets';
import { getEnvironments } from '@/lib/data/environments';
import { redirect } from 'next/navigation';
import { SECRET_FILTERS } from '@/lib/filters/options';
import { hasActiveFilters, parseFilters } from '@/lib/filters/parse';
import { parsePage } from '@/lib/utils/pagination';

type SearchParams = Promise<{ mode?: string; id?: string; environment?: string; page?: string; }>;

export default async function Secrets({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { mode, id } = params;
  const filters = parseFilters(params, SECRET_FILTERS);
  const filtered = hasActiveFilters(filters, SECRET_FILTERS);

  const secrets = await getSecretsPage(filters, parsePage(params.page));

  const record = id ? await getSecretById(id) : undefined;

  // edge case where a secret (or parent environment) gets deleted in one tab while the user is editing or viewing it in another tab
  if (id && !record && mode !== "create") redirect("/secrets");

  const modal =
    mode === "create" ? { mode: "create" as const } :
      record && mode === "edit" ? { mode: "edit" as const, record } :
        record ? { mode: "view" as const, record } :
          null;

  const environments = await getEnvironments();

  return (
    <>
      <Sidebar activeItem="secrets" />

      <main className="page-content">

        <Subheader
          title="Secrets"
          subtitle="Encrypted environment variables injected into pipeline stages at runtime.">
          <AddButton text={"New Secret"} url={"secrets"} />
        </Subheader>
        {secrets.total > 0 || filtered ? (
          <>
            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput placeholder={"Filter by key or notes..."} />
                <QueryFilterListbox id={"environment"} name={"environment"} options={SECRET_FILTERS.environment} value={filters.environment} />
              </div>
            </div>

            {secrets.total > 0 ? (
              <>
                <DataTable columns={["Key", "Environment", "Last Updated"]}>
                  {secrets.rows.map((secret) => (
                    <SecretRow key={secret.id} secret={secret} />
                  ))}
                </DataTable>

                <Pagination page={secrets.page} pageCount={secrets.pageCount} total={secrets.total} pageSize={secrets.pageSize} />
              </>
            ) : (
              <EmptyState
                icon="funnel-outline"
                heading="No matching secrets"
                description="No secrets match these filters."
                action={{ label: "Clear filters", href: "/secrets" }}
              />
            )}
          </>
        ) : environments.length > 0 ? (
          <EmptyState
            icon="key-outline"
            heading="No secrets yet"
            description="Secrets are encrypted at rest and injected into stages when a run starts."
            action={{ label: "New Secret", href: "/secrets?mode=create", icon: "add-outline" }}
          />
        ) : (
          <EmptyState
            icon="key-outline"
            heading="No secrets yet"
            description="Secrets belong to an environment. Create an environment first."
            action={{ label: "New Environment", href: "/environments?mode=create", icon: "add-outline" }}
          />
        )}
      </main>

      {modal && (
        <SecretModalController
          mode={modal.mode}
          secret={modal.record}
          environments={environments}
        />
      )}
    </>
  )
}