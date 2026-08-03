import styles from './env.module.css';
import Sidebar from "@/components/layout/sidebar/Sidebar"
import Subheader from "@/components/layout/subheader/Subheader";
import AddButton from "@/components/layout/subheader/AddButton";
import FilterSelect from "@/components/ui/filters/FilterSelect";
import SearchInput from "@/components/ui/filters/SearchInput";
import DataTable from "@/components/ui/DataTable";
import EnvironmentRow from '@/components/environments/EnvironmentRow';
import Pagination from '@/components/ui/pagination/Pagination';
import EnvModalController from '@/components/environments/EnvModalController';
import { getEnvironmentById, getEnvironments } from '@/lib/data/environments';

type SearchParams = Promise<{ mode?: string; id?: string; }>;

export default async function Environments({ searchParams }: { searchParams: SearchParams }) {
  const { mode, id } = await searchParams;
  const environments = await getEnvironments();

  const record = id ? await getEnvironmentById(id) : undefined;

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

        {environments.length > 0 &&
          <>
            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput placeholder={"Search environments..."} />
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
                <FilterSelect
                  id={"status"} name={"status"}
                  options={[
                    { value: "all", label: "All time" },
                    { value: "today", label: "Today" },
                    { value: "7days", label: "Last 7 days" },
                    { value: "30days", label: "Last 30 days" },
                    { value: "90days", label: "Last 90 days" },
                  ]} />
              </div>
            </div>
            
            <DataTable columns={["Name", "Environment Type", "Secrets", "Last Updated"]}>
              {environments.map((env, i) => (
                <EnvironmentRow key={i} env={env} />
              ))}
            </DataTable>

            <Pagination showing="1-10" totalRows={environments.length} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
          </>
        }
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
