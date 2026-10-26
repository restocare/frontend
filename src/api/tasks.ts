/**
 * Internal task management.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient, uploadFile } from "./apiClient";
import { toQueryString } from "./_shared";

export type TaskStatus =
  "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskAssignee {
  employeeId: number;
  name: string;
  email?: string;
  designation: string | null;
  department?: { name: string } | null;
}

export interface TaskRow {
  taskId: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeId: number;
  assignee: TaskAssignee;
  assignedBy: { userId: number; name: string | null } | null;
}

export interface TaskCommentRow {
  commentId: number;
  body: string;
  createdAt: string;
  author: { userId: number; name: string | null } | null;
}

export interface TaskActivityRow {
  activityId: number;
  type: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  note: string | null;
  createdAt: string;
  actor: { userId: number; name: string | null } | null;
}

export interface TaskAttachmentRow {
  attachmentId: number;
  url: string;
  fileName: string;
  mimeType: string | null;
  createdAt: string;
  uploadedBy: { userId: number; name: string | null } | null;
}

export interface TaskSubtaskRow {
  subtaskId: number;
  title: string;
  isDone: boolean;
}

export interface TaskDetail extends TaskRow {
  comments: TaskCommentRow[];
  activities: TaskActivityRow[];
  attachments: TaskAttachmentRow[];
  subtasks: TaskSubtaskRow[];
}

export interface TaskListResponse {
  tasks: TaskRow[];
  counts: Record<string, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AssignableEmployee {
  /** Null for a panel login that has no employee record yet. */
  employeeId: number | null;
  /** Set only when employeeId is null — assign by login instead. */
  userId: number | null;
  name: string;
  email: string;
  designation: string | null;
  department: { name: string } | null;
}

export interface TaskReport {
  group: "day" | "week" | "month";
  range: { from: string; to: string };
  summary: {
    total: number;
    byStatus: Record<string, number>;
    completed: number;
    pending: number;
    overdue: number;
  };
  leaderboard: {
    employeeId: number;
    name: string;
    designation: string | null;
    assigned: number;
    completed: number;
    pending: number;
    overdue: number;
    completionRate: number;
  }[];
  buckets: { period: string; assigned: number; completed: number }[];
}

export interface TaskListParams {
  assigneeId?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export type TaskRepeat = "DAILY" | "WEEKLY" | "MONTHLY";

export interface CreateTaskInput {
  title: string;
  description?: string;
  /** Employee to assign to. Use assigneeUserId for a login with no employee record. */
  assigneeId?: number;
  assigneeUserId?: number;
  priority?: TaskPriority;
  status?: TaskStatus;
  /** When the work should begin. */
  startDate?: string;
  dueDate?: string;
  isRepeating?: boolean;
  repeatEvery?: TaskRepeat;
  repeatUntil?: string;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

export const taskApi = {
  /** GET /v1/tasks — management list (permission: tasks.view). */
  list: (params: TaskListParams = {}) =>
    apiClient.get<TaskListResponse>(
      `/v1/tasks${toQueryString({
        assigneeId: params.assigneeId,
        status: params.status,
        priority: params.priority,
        search: params.search,
        from: params.from,
        to: params.to,
        page: params.page,
        limit: params.limit,
      })}`,
    ),
  employees: (search?: string) =>
    apiClient.get<AssignableEmployee[]>(
      `/v1/tasks/employees${toQueryString({ search })}`,
    ),
  get: (taskId: number) => apiClient.get<TaskDetail>(`/v1/tasks/${taskId}`),
  create: (body: CreateTaskInput) => apiClient.post<TaskRow>("/v1/tasks", body),
  update: (taskId: number, body: UpdateTaskInput) =>
    apiClient.patch<TaskRow>(`/v1/tasks/${taskId}`, body),
  remove: (taskId: number) =>
    apiClient.delete<{ message: string }>(`/v1/tasks/${taskId}`),
  addComment: (taskId: number, body: string) =>
    apiClient.post<TaskCommentRow>(`/v1/tasks/${taskId}/comments`, { body }),
  report: (
    params: {
      group?: "day" | "week" | "month";
      from?: string;
      to?: string;
      assigneeId?: number;
    } = {},
  ) =>
    apiClient.get<TaskReport>(
      `/v1/tasks/report${toQueryString({ ...params })}`,
    ),

  // Attachments (management side — permission: tasks.update).
  addAttachment: (taskId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadFile<TaskAttachmentRow>(`/v1/tasks/${taskId}/attachments`, fd);
  },
  removeAttachment: (attachmentId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/tasks/attachments/${attachmentId}`,
    ),

  // Subtasks (management side).
  addSubtask: (taskId: number, title: string) =>
    apiClient.post<TaskSubtaskRow>(`/v1/tasks/${taskId}/subtasks`, { title }),
  updateSubtask: (
    subtaskId: number,
    body: { title?: string; isDone?: boolean },
  ) => apiClient.patch<TaskSubtaskRow>(`/v1/tasks/subtasks/${subtaskId}`, body),
  removeSubtask: (subtaskId: number) =>
    apiClient.delete<{ message: string }>(`/v1/tasks/subtasks/${subtaskId}`),

  /** Employee self-service (JWT-only). */
  myTasks: (status?: TaskStatus) =>
    apiClient.get<{
      employee: { employeeId: number; name: string };
      tasks: TaskRow[];
      counts: Record<string, number>;
    }>(`/v1/tasks/me${toQueryString({ status })}`),
  createMyTask: (body: Omit<CreateTaskInput, "assigneeId">) =>
    apiClient.post<TaskRow>("/v1/tasks/me", body),
  getMyTask: (taskId: number) =>
    apiClient.get<TaskDetail>(`/v1/tasks/me/${taskId}`),
  updateMyTask: (taskId: number, body: UpdateTaskInput) =>
    apiClient.patch<TaskRow>(`/v1/tasks/me/${taskId}`, body),
  updateMyStatus: (taskId: number, status: TaskStatus, note?: string) =>
    apiClient.patch<TaskRow>(`/v1/tasks/me/${taskId}/status`, { status, note }),
  addMyComment: (taskId: number, body: string) =>
    apiClient.post<TaskCommentRow>(`/v1/tasks/me/${taskId}/comments`, { body }),
  addMyAttachment: (taskId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadFile<TaskAttachmentRow>(
      `/v1/tasks/me/${taskId}/attachments`,
      fd,
    );
  },
  removeMyAttachment: (attachmentId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/tasks/me/attachments/${attachmentId}`,
    ),
  addMySubtask: (taskId: number, title: string) =>
    apiClient.post<TaskSubtaskRow>(`/v1/tasks/me/${taskId}/subtasks`, {
      title,
    }),
  updateMySubtask: (
    subtaskId: number,
    body: { title?: string; isDone?: boolean },
  ) =>
    apiClient.patch<TaskSubtaskRow>(`/v1/tasks/me/subtasks/${subtaskId}`, body),
  removeMySubtask: (subtaskId: number) =>
    apiClient.delete<{ message: string }>(`/v1/tasks/me/subtasks/${subtaskId}`),
};
