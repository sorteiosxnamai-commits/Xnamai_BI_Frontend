import { useState } from "react";
import { analyticsApi } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import type { AnalyticsFilters } from "../../types/analytics";

export function ExportButtons({
  report,
  filters,
}: {
  report: "orders" | "products" | "customers" | "sellers" | "inventory";
  filters: AnalyticsFilters;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (user?.role !== "admin") return null;

  async function download(format: "csv" | "xlsx") {
    setLoading(true);
    setError("");
    try {
      const file = await analyticsApi.exportReport(report, format, filters);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao exportar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" disabled={loading} onClick={() => void download("csv")}>
        CSV
      </button>
      <button type="button" disabled={loading} onClick={() => void download("xlsx")}>
        XLSX
      </button>
      {error && <small className="export-error">{error}</small>}
    </>
  );
}
