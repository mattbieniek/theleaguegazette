import { createClient } from "@supabase/supabase-js";
import type { APIRoute } from "astro";
import { strToU8, zipSync } from "fflate";
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

function worksheetFor(rows: ExportRow[], columns: string[]) {
  const worksheet = XLSX.utils.json_to_sheet(safeRows(rows), { header: columns });
  worksheet["!cols"] = columns.map((column) => ({
    wch: Math.min(42, Math.max(column.length + 2, ...rows.slice(0, 50).map((row) => String(row[column] ?? "").length + 2))),
  }));
  return worksheet;
}

function sheetName(label: string, index: number): string {
  const cleaned = label.replace(/[\\/*?:\[\]]/g, "-").trim() || `Data ${index + 1}`;
  return cleaned.slice(0, 31);
}

type PreparedExport = {
  definition: (typeof exportDatasets)[number];
  rows: ExportRow[];
};

function workbookFor(exports: PreparedExport[]) {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  exports.forEach(({ definition, rows }, index) => {
    const baseName = exports.length === 1 ? "Data" : sheetName(definition.label, index);
    let name = baseName;
    let suffix = 2;
    while (usedNames.has(name)) {
      const suffixText = ` ${suffix}`;
      name = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }
    usedNames.add(name);
    XLSX.utils.book_append_sheet(workbook, worksheetFor(rows, definition.columns), name);
  });
  return workbook;
}

function requestedFormat(value: string | null): ExportFormat {
  if (value === "csv" || value === "json" || value === "xlsx") return value;
  throw new Error("Choose XLSX, CSV, or JSON as the export format.");
}

function requestedDatasets(url: URL): ExportDatasetKey[] {
  const values = [
    ...url.searchParams.getAll("dataset"),
    ...url.searchParams.getAll("datasets").flatMap((value) => value.split(",")),
  ].map((value) => value.trim()).filter(Boolean);
  const keys = [...new Set(values)];
  if (!keys.length) throw new Error("Choose at least one dataset to export.");
  for (const key of keys) {
    if (!exportDatasets.some((dataset) => dataset.key === key)) {
      throw new Error("One of the selected datasets is not available for export.");
    }
  }
  return keys as ExportDatasetKey[];
}

function requestedSeasons(url: URL): number[] | undefined {
  const values = [
    ...url.searchParams.getAll("season"),
    ...url.searchParams.getAll("seasons").flatMap((value) => value.split(",")),
  ].map((value) => value.trim()).filter(Boolean);
  if (!values.length || values.includes("all")) return undefined;
  const seasons = [...new Set(values.map((value) => {
    if (!/^\d{4}$/.test(value)) throw new Error("Choose valid seasons.");
    return Number(value);
  }))];
  return seasons.sort((first, second) => second - first);
}

async function prepareExports(
  client: ReturnType<typeof createClient<Database>>,
  keys: ExportDatasetKey[],
  seasons: number[] | undefined,
): Promise<PreparedExport[]> {
  const prepared: PreparedExport[] = [];
  const maxRows = 50_000;

  for (const key of keys) {
    const definition = exportDatasets.find((item) => item.key === key);
    if (!definition) throw new Error("One of the selected datasets is not available for export.");
    const requestedRows = definition.seasonFilter && seasons?.length
      ? await Promise.all(seasons.map((season) => getExportRows(client, key, season)))
      : [await getExportRows(client, key)];
    const rows = requestedRows.flatMap((result) => result.rows);
    if (rows.length > maxRows) {
      throw new Error(`${definition.label} is larger than the 50,000-row limit. Narrow the seasons or choose fewer datasets.`);
    }
    prepared.push({ definition, rows });
  }

  return prepared;
}

function seasonSuffix(seasons: number[] | undefined): string {
  return seasons?.length ? `-${seasons.join("-")}` : "-all-seasons";
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

    const format = requestedFormat(url.searchParams.get("format"));
    const keys = requestedDatasets(url);
    const seasons = requestedSeasons(url);
    const prepared = await prepareExports(supabase, keys, seasons);
    const filename = `gazette-export${seasonSuffix(seasons)}`;

    if (format === "json") {
      if (prepared.length === 1) {
        const only = prepared[0];
        return new Response(JSON.stringify(only.rows), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "content-disposition": `attachment; filename="${prepared[0].definition.filename}${seasonSuffix(seasons)}.json"`,
            "cache-control": "private, no-store",
          },
        });
      }
      const datasets = Object.fromEntries(prepared.map(({ definition, rows }) => [definition.key, rows]));
      return new Response(JSON.stringify({
        generated_at: new Date().toISOString(),
        seasons: seasons ?? "all",
        datasets,
      }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}.json"`,
          "cache-control": "private, no-store",
        },
      });
    }

    const workbook = workbookFor(prepared);
    if (format === "csv") {
      if (prepared.length === 1) {
        const only = prepared[0];
        const csv = XLSX.utils.sheet_to_csv(worksheetFor(only.rows, only.definition.columns));
        return new Response(`\ufeff${csv}`, {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="${only.definition.filename}${seasonSuffix(seasons)}.csv"`,
            "cache-control": "private, no-store",
          },
        });
      }
      const files = Object.fromEntries(prepared.map(({ definition, rows }) => {
        const worksheet = worksheetFor(rows, definition.columns);
        return [`${definition.filename}${seasonSuffix(seasons)}.csv`, `\ufeff${XLSX.utils.sheet_to_csv(worksheet)}`];
      }));
      const archive = zipSync(Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, strToU8(contents)])));
      return new Response(archive as unknown as BodyInit, {
        headers: {
          "content-type": "application/zip",
          "content-disposition": `attachment; filename="${filename}.zip"`,
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
