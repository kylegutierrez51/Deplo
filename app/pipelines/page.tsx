import styles from "./pipelines.module.css";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import Subheader from "@/components/layout/subheader/Subheader";
import AddButton from '@/components/layout/subheader/AddButton';
import FilterListbox from "@/components/ui/filters/FilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import DataTable from "@/components/ui/DataTable";
import PipelineRow from "@/components/pipelines/PipelineRow";
import Pagination from "@/components/ui/pagination/Pagination";
import PipelineModalController from '@/components/pipelines/PipelineModalController';
import { getPipelineById, getPipelines } from '@/lib/data/pipelines';
import { redirect } from 'next/navigation';

type SearchParams = Promise<{ mode?: string; id?: string; }>;

export default async function Pipelines({ searchParams }: { searchParams: SearchParams }) {
  const { mode, id } = await searchParams;
  const pipelines = await getPipelines();

  const record = id ? await getPipelineById(id) : undefined;

  // edge case where a pipeline gets deleted in one tab while the user is editing or viewing it in another tab
  if (id && !record && mode !== "create") redirect("/pipelines");



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
          subtitle={<><span id="subtitle-count">{pipelines?.length > 0 ? pipelines.length : 0}</span> pipelines across your repositories</>}>
          <AddButton text={"New Pipeline"} url={"pipelines"} />
        </Subheader>

        {pipelines.length > 0 &&
          <>
            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput placeholder={"Search pipelines..."} />
                <FilterListbox
                  id={"status"} name={"status"}
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "queued", label: "Queued" },
                    { value: "running", label: "Running" },
                    { value: "succeeded", label: "Succeeded" },
                    { value: "failed", label: "Failed" },
                    { value: "cancelled", label: "Cancelled" },
                    { value: "idle", label: "Idle" },
                  ]} />
              </div>
            </div>

            <DataTable columns={["Pipeline", "Recent Status", "Repository", "Latest Run", ""]}>
              {pipelines.map((pipeline, i) => (
                <PipelineRow key={i} pipeline={pipeline} />
              ))}
            </DataTable>

            <Pagination showing="1-10" totalRows={pipelines.length} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
          </>
        }
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
