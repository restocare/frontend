"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/api/apiClient";
import {
  crmQueryKeys,
  hrApi,
  positionsApi,
  type JobPostingRow,
} from "@/src/api/api";
import {
  Badge,
  Btn,
  Card,
  EmptyRow,
  Field,
  inputCls,
  Modal,
  Notice,
  PageHeader,
  TableShell,
  Tabs,
  fmtDate,
} from "@/src/components/crm/ui";
import { PlusIcon } from "@/src/components/icons";
import { hasPermission } from "@/src/lib/auth";

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];

export default function PositionsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("OPEN");
  const [editing, setEditing] = useState<JobPostingRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = hasPermission("positions.manage");

  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.positions(status === "ALL" ? undefined : status),
    queryFn: () => positionsApi.list(status === "ALL" ? undefined : status),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hr", "positions"] });
    qc.invalidateQueries({ queryKey: crmQueryKeys.openPositions });
  };

  const toggleStatus = useMutation({
    mutationFn: (job: JobPostingRow) =>
      positionsApi.update(job.jobId, { status: job.status === "OPEN" ? "CLOSED" : "OPEN" }),
    onSuccess: (j) => {
      setActionError(null);
      setNotice(`Position “${j.title}” ${j.status === "OPEN" ? "reopened" : "closed"}.`);
      invalidate();
    },
    onError: (e) =>
      setActionError(e instanceof ApiError ? e.message : "Could not update the position."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => positionsApi.remove(id),
    onSuccess: () => {
      setActionError(null);
      setNotice("Position deleted.");
      invalidate();
    },
    onError: (e) =>
      setActionError(e instanceof ApiError ? e.message : "Could not delete the position."),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Open Positions"
        subtitle="Internal job board — open roles show on every employee's portal"
        action={
          canManage ? (
            <Btn onClick={() => setAdding(true)}>
              <PlusIcon className="h-4 w-4" />
              Post position
            </Btn>
          ) : undefined
        }
      />
      {error instanceof ApiError && <Notice kind="error">{error.message}</Notice>}
      {actionError && <Notice kind="error">{actionError}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <Tabs
        tabs={[
          { key: "OPEN", label: "Open" },
          { key: "CLOSED", label: "Closed" },
          { key: "ALL", label: "All" },
        ]}
        active={status}
        onChange={setStatus}
      />

      <Card>
        <TableShell head={["Title", "Department", "Location", "Type", "Status", "Posted", "Actions"]}>
          {isLoading && <EmptyRow cols={7} label="Loading positions…" />}
          {!isLoading && !data?.length && (
            <EmptyRow cols={7} label="No positions here — post one to show it on employee portals." />
          )}
          {data?.map((job) => (
            <tr key={job.jobId} className="text-foreground">
              <td className="px-4 py-3 font-medium">{job.title}</td>
              <td className="px-4 py-3 text-muted-foreground">{job.department?.name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{job.location ?? "—"}</td>
              <td className="px-4 py-3">
                <Badge tone="muted">{job.employmentType.replace(/_/g, " ")}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={job.status === "OPEN" ? "success" : "muted"}>{job.status}</Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(job.postedAt)}</td>
              <td className="px-4 py-3">
                {canManage && (
                  <div className="flex gap-1.5">
                    <Btn small tone="ghost" onClick={() => setEditing(job)}>
                      Edit
                    </Btn>
                    <Btn
                      small
                      tone={job.status === "OPEN" ? "danger" : "success"}
                      busy={toggleStatus.isPending}
                      onClick={() => toggleStatus.mutate(job)}
                    >
                      {job.status === "OPEN" ? "Close" : "Reopen"}
                    </Btn>
                    <Btn small tone="danger" busy={remove.isPending} onClick={() => remove.mutate(job.jobId)}>
                      Delete
                    </Btn>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {(adding || editing) && (
        <PositionFormModal
          job={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={(title, created) => {
            setAdding(false);
            setEditing(null);
            setActionError(null);
            setNotice(`Position “${title}” ${created ? "posted" : "updated"}.`);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function PositionFormModal({
  job,
  onClose,
  onSaved,
}: {
  job: JobPostingRow | null;
  onClose: () => void;
  onSaved: (title: string, created: boolean) => void;
}) {
  const [title, setTitle] = useState(job?.title ?? "");
  const [departmentId, setDepartmentId] = useState<string>(
    job?.departmentId != null ? String(job.departmentId) : "",
  );
  const [location, setLocation] = useState(job?.location ?? "");
  const [employmentType, setEmploymentType] = useState<string>(job?.employmentType ?? "FULL_TIME");
  const [description, setDescription] = useState(job?.description ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const departments = useQuery({
    queryKey: crmQueryKeys.departments,
    queryFn: hrApi.departments,
    retry: false,
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: title.trim(),
        departmentId: departmentId ? Number(departmentId) : undefined,
        location: location.trim() || undefined,
        employmentType,
        description: description.trim() || undefined,
      };
      return job ? positionsApi.update(job.jobId, body) : positionsApi.create(body);
    },
    onSuccess: (j) => onSaved(j.title, !job),
    onError: (e) =>
      setFormError(e instanceof ApiError ? e.message : "Could not save the position."),
  });

  const submit = () => {
    if (!title.trim()) return setFormError("Give the position a title.");
    setFormError(null);
    save.mutate();
  };

  return (
    <Modal title={job ? "Edit position" : "Post a position"} onClose={onClose} wide>
      <div className="space-y-4">
        {formError && <Notice kind="error">{formError}</Notice>}
        <Field label="Title *">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sous Chef — Jaipur"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Department">
            <select
              className={inputCls}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">—</option>
              {(departments.data ?? []).map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <input
              className={inputCls}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Jaipur"
            />
          </Field>
          <Field label="Type">
            <select
              className={inputCls}
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea
            className={`${inputCls} min-h-28`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What the role involves, requirements, how to apply…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn tone="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Btn>
          <Btn busy={save.isPending} onClick={submit}>
            {job ? "Save changes" : "Post position"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
