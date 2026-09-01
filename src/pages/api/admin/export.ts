import { createClient } from "@supabase/supabase-js";
import type { APIRoute } from "astro";
import * as XLSX from "xlsx";
import {
  exportDatasets,
  getExportRows,
  getExportSeasons,
  type ExportFormat,
  type ExportDatasetKey,
  type ExportRow,
} from "../../../lib/exportDatasets";
import type { Database } from "../../../types/database";

export const prerender = false;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function authorizationToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : null;
}

function safeExportString(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function workbookValue(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return safeExportString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  return safeExportString(JSON.stringify(value));
}

function safeRows(rows: ExportRow[]) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, workbookValue(value)]),
  ));
}

function workbookFor(rows: ExportRow[], columns: string[]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(safeRows(rows), { header: columns });
  worksheet["!cols"] = columns.map((column) => ({
    wch: Math.min(42, Math.max(column.length + 2, ...rows.slice(0, 50).map((row) => String(row[column] ?? "").length + 2))),
  }));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  return workbook;
}

function requestedFormat(value: string | null): ExportFormat {
  if (value === "csv" || value === "json" || value === "xlsx") return value;
  throw new Error("Choose XLSX, CSV, or JSON as the export format.");
}

function requestedSeason(value: string | null): number | undefined {
  if (!value || value === "all") return undefined;
  if (!/^\d{4}$/.test(value)) throw new Error("Choose a valid season.");
  return Number(value);
}

export const GET: APIRoute = async ({ request }) => {
  const token = authorizationToken(request);
  if (!token) return jsonResponse({ error: "Authentication required." }, 401);

  const url = new URL(request.url);
  const supabase = createClient<Database>(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return jsonResponse({ error: "Your session has expired." }, 401);

  const [{ data: admin }, { data: reader }] = await Promise.all([
    supabase.from("admin_users").select("user_id").eq("user_id", userData.user.id).maybeSingle(),
    supabase.from("data_export_readers").select("user_id").eq("user_id", userData.user.id).maybeSingle(),
  ]);
  if (!admin && !reader) return jsonResponse({ error: "Data export access is not enabled for this account." }, 403);

  try {
    if (url.searchParams.get("metadata") === "1") {
      return new Response(JSON.stringify({ datasets: exportDatasets, seasons: await getExportSeasons(supabase) }), { headers: jsonHeaders });
    }

    const key = url.searchParams.get("dataset") as ExportDatasetKey | null;
    if (!key) return jsonResponse({ error: "Choose a dataset to export." }, 400);
    const format = requestedFormat(url.searchParams.get("format"));
    const season = requestedSeason(url.searchParams.get("season"));
    const { definition, rows } = await getExportRows(supabase, key, season);
    const seasonSuffix = season ? `-${season}` : "";
    const filename = `${definition.filename}${seasonSuffix}`;

    if (format === "json") {
      return new Response(JSON.stringify(rows), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }

    const workbook = workbookFor(rows, definition.columns);
    if (format === "csv") {
      const csv = XLSX.write(workbook, { bookType: "csv", type: "string" });
      return new Response(`\ufeff${csv}`, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}.csv"`,
          "cache-control": "private, no-store",
        },
      });
    }

    const xlsx = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Uint8Array;
    return new Response(xlsx as unknown as BodyInit, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}.xlsx"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The export could not be created.";
    return jsonResponse({ error: message }, 400);
  }
};
