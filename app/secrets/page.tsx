import styles from "./secrets.module.css";
import Subheader from "@/components/layout/subheader/Subheader";
import AddButton from '@/components/layout/subheader/AddButton';
import Sidebar from "@/components/layout/sidebar/Sidebar";
import FilterListbox from "@/components/ui/filters/FilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import DataTable from "@/components/ui/DataTable";
import SecretRow from '@/components/secrets/SecretRow';
import Pagination from "@/components/ui/pagination/Pagination";
import SecretModalController from '@/components/secrets/SecretModalController';
import { getSecretById, getSecrets } from '@/lib/data/secrets';
import { getEnvironments } from '@/lib/data/environments';

type SearchParams = Promise<{ mode?: string; id?: string; }>;

export default async function Secrets({ searchParams }: { searchParams: SearchParams }) {
  const { mode, id } = await searchParams;
  const secrets = await getSecrets();

  const record = id ? await getSecretById(id) : undefined;

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
        {secrets.length > 0 &&
          <>
            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput placeholder={"Filter by key or notes..."} />
                <FilterListbox
                  id={"environment"} name={"environment"}
                  options={[
                    { value: "all", label: "All environment types" },
                    { value: "production", label: "Production" },
                    { value: "staging", label: "Staging" },
                    { value: "development", label: "Development" },
                    { value: "preview", label: "Preview" },
                    { value: "custom", label: "Custom" },
                  ]} />
              </div>
            </div>

            <DataTable columns={["Key", "Environment", "Last Updated"]}>
              {secrets.map((secret, i) => (
                <SecretRow key={i} secret={secret} />
              ))}
            </DataTable>

            <Pagination showing="1-10" totalRows={secrets.length} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
          </>
        }
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