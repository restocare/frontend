import { create } from "zustand";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/app/api/errors";
import { manualLeadsApi, ManualLeadBulkRow } from "@/app/api/manualLeadsApi";

interface ManualLeadUploadState {
  isUploading: boolean;
  progress: number;
  fileName: string;
  uploadRows: (rows: ManualLeadBulkRow[], fileName: string) => void;
}

// Kept outside any page component so the upload (and its progress/toast) survives
// route navigation instead of being tied to the lifecycle of the add-lead page.
export const useManualLeadUploadStore = create<ManualLeadUploadState>((set, get) => ({
  isUploading: false,
  progress: 0,
  fileName: "",

  uploadRows: (rows, fileName) => {
    if (get().isUploading) {
      toast.info("An import is already in progress. Please wait for it to finish.");
      return;
    }

    set({ isUploading: true, progress: 0, fileName });

    manualLeadsApi
      .bulkCreate(rows, (percent) => set({ progress: percent }))
      .then((res) => {
        toast.success(`${res?.inserted ?? rows.length} lead${rows.length !== 1 ? "s" : ""} imported successfully!`);
      })
      .catch((err: unknown) => {
        toast.error(getApiErrorMessage(err, "Bulk import failed"));
      })
      .finally(() => {
        set({ isUploading: false, progress: 0, fileName: "" });
      });
  },
}));
