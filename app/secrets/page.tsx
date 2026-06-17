import styles from "./secrets.module.css";
import Subheader from "@/components/Subheader";
import AddSecretButton from '@/components/secrets/AddSecretButton';
import Sidebar from "@/components/sidebar/Sidebar";
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import SecretRow from '@/components/secrets/SecretRow';
import Pagination from "@/components/Pagination";
import SecretModalController from '@/components/secrets/SecretModalController';
import { getSecret, getSecrets } from '@/lib/data/secrets';

type SearchParams = Promise<{ create?: string; key?: string; env?: string }>;

export default async function Secrets({ searchParams }: { searchParams: SearchParams }) {
  const { create, key, env } = await searchParams;
  const secrets = await getSecrets();

  const selectedRow = key && env ? await getSecret(key, env) : undefined;
  const modalMode = create ? "create" : selectedRow ? "view" : null;

  return (
    <>
      <Sidebar activeItem="secrets" />

      <main className="page-content">

        <Subheader
          title="Secrets"
          subtitle="Encrypted environment variables injected into pipeline stages at runtime.">
            <AddSecretButton />
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput placeholder={"Filter by key or notes..."} />
            <FilterSelect
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

        <DataTable columns={["Key", "Environment Name", "Last Updated"]}>
          {secrets.map((secret, i) => (
            <SecretRow key={i} secret={secret} />
          ))}
        </DataTable>

        <Pagination showing="1-10" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />

      </main>

      {modalMode && (
        <SecretModalController
          mode={modalMode}
          secret={selectedRow}
        />
      )}
    </>
  )
}



