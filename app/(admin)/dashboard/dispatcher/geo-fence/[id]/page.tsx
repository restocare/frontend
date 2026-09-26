"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { dispatchApi, queryKeys } from "@/src/api/api";
import { GeofenceEditor } from "@/src/components/dashboard/geofence-editor";
import { SpinnerIcon } from "@/src/components/icons";

export default function EditGeofencePage() {
  const params = useParams<{ id: string }>();
  const geofenceId = Number(params.id);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.geofence(geofenceId),
    queryFn: () => dispatchApi.getGeofence(geofenceId),
    enabled: Number.isFinite(geofenceId),
  });

  if (isLoading) {
    return (
      <div className="flex h-72 items-center justify-center text-muted-foreground">
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground">Couldn’t load this geofence.</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
          <Link
            href="/dashboard/dispatcher/geo-fence"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  // Remount the editor when switching between zones so its local state resets.
  return <GeofenceEditor key={data.geofenceId} initial={data} />;
}
