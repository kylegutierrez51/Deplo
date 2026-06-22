import styles from "./pipelines.module.css"

import Sidebar from "@/components/sidebar/Sidebar";
import Subheader from "@/components/subheader/Subheader";
import AddButton from '@/components/subheader/AddButton';
import FilterSelect from "@/components/filters/FilterSelect";
import SearchInput from "@/components/filters/SearchInput";
import DataTable from "@/components/DataTable";
import PipelineRow from "@/components/pipelines/PipelineRow";
import Pagination from "@/components/pagination/Pagination";
import PipelineModalController from '@/components/pipelines/PipelineModalController';
import { getPipelineById, getPipelines } from '@/lib/data/pipelines';

type SearchParams = Promise<{ mode?: string; id?: string; }>;

export default async function Pipelines({ searchParams }: { searchParams: SearchParams }) {
  const { mode, id } = await searchParams;
  const pipelines = await getPipelines();

  const record = id ? await getPipelineById(Number(id)) : undefined;

  const modal =
    mode === "create" ? { mode: "create" as const } :
      record && mode === "edit" ? { mode: "edit" as const, record } :
        record ? { mode: "view" as const, record } :
          null;



  return (
    <>
      <Sidebar activeItem="pipelines" />

      <main className="page-content">
        <Subheader
          title="Pipelines"
          subtitle={<><span id="subtitle-count">8</span> pipelines across your repositories</>}>
            <AddButton text={"New Pipeline"} url={"pipelines"} />
        </Subheader>

        <div className={styles.filters}>
          <div className={styles['filters-bar']}>
            <SearchInput placeholder={"Search pipelines..."} />
            <FilterSelect
              id={"status"} name={"status"}
              options={[
                { value: "all", label: "All statuses" },
                { value: "queued", label: "Queued" },
                { value: "running", label: "Running" },
                { value: "succeeded", label: "Succeeded" },
                { value: "failed", label: "Failed" },
                { value: "cancelled", label: "Cancelled" },
              ]} />
          </div>
        </div>

        <DataTable columns={["Pipeline", "Status", "Repository", "Last Run"]}>
          {pipelines.map((pipeline, i) => (
            <PipelineRow key={i} pipeline={pipeline}/>
          ))}
        </DataTable>

        <Pagination showing="1-10" totalRows={20} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />

      </main>

      {modal && (
        <PipelineModalController
          mode={modal.mode}
          pipeline={modal.record}
        />
      )}
    </>
  )
}
