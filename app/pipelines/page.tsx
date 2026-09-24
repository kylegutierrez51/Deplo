import styles from "./pipelines.module.css";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import Subheader from "@/components/layout/subheader/Subheader";
import AddButton from '@/components/layout/subheader/AddButton';
import QueryFilterListbox from "@/components/ui/filters/QueryFilterListbox";
import SearchInput from "@/components/ui/filters/SearchInput";
import DataTable from "@/components/ui/DataTable";
import PipelineRow from "@/components/pipelines/PipelineRow";
import Pagination from "@/components/ui/pagination/Pagination";
import EmptyState from "@/components/ui/EmptyState";
import PipelineModalController from '@/components/pipelines/PipelineModalController';
import { countPipelines, getPipelineById, getPipelines } from '@/lib/data/pipelines';
import { PIPELINE_FILTERS } from '@/lib/filters/options';
import { hasActiveFilters, parseFilters } from '@/lib/filters/parse';
import { redirect } from 'next/navigation';

type SearchParams = Promise<{ mode?: string; id?: string; status?: string; }>;

export default async function Pipelines({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { mode, id } = params;
  const filters = parseFilters(params, PIPELINE_FILTERS);
  const filtered = hasActiveFilters(filters, PIPELINE_FILTERS);

  const [pipelines, totalPipelines] = await Promise.all([getPipelines(filters), countPipelines()]);

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
          subtitle={<><span id="subtitle-count">{totalPipelines}</span> pipelines across your repositories</>}>
          <AddButton text={"New Pipeline"} url={"pipelines"} />
        </Subheader>

        {pipelines.length > 0 || filtered ? (
          <>
            <div className={styles.filters}>
              <div className={styles['filters-bar']}>
                <SearchInput placeholder={"Search pipelines..."} />
                <QueryFilterListbox id={"status"} name={"status"} options={PIPELINE_FILTERS.status} value={filters.status} />
              </div>
            </div>

            {pipelines.length > 0 ? (
              <>
                <DataTable columns={["Pipeline", "Recent Status", "Repository", "Latest Run", ""]}>
                  {pipelines.map((pipeline) => (
                    <PipelineRow key={pipeline.id} pipeline={pipeline} />
                  ))}
                </DataTable>

                <Pagination showing="1-10" totalRows={pipelines.length} pages={[1, '...', 8, 9, 10, '...', 22]} currentPage={9} />
              </>
            ) : (
              <EmptyState
                icon="funnel-outline"
                heading="No matching pipelines"
                description="No pipelines match these filters."
                action={{ label: "Clear filters", href: "/pipelines" }}
              />
            )}
          </>
        ) : (
          <EmptyState
            icon="git-network-outline"
            heading="No pipelines yet"
            description="Create a pipeline to draw the stages of your first deploy and wire them together."
            action={{ label: "New Pipeline", href: "/pipelines?mode=create", icon: "add-outline" }}
          />
        )}
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
