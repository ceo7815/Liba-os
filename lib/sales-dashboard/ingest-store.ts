import { createAdminClient } from "@/lib/supabase/admin";

export const SALES_EXCEL_BUCKET = "sales-dashboard";
export const SALES_EXCEL_OBJECT = "live/managers.xlsx";
const META_OBJECT = "live/meta.json";

export type IngestedWorkbook = {
  buffer: ArrayBuffer;
  fileName: string;
  lastModified: string | null;
};

async function ensureBucket() {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(SALES_EXCEL_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(SALES_EXCEL_BUCKET, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function saveIngestedWorkbook(
  buffer: Buffer,
  fileName: string,
): Promise<void> {
  const admin = createAdminClient();
  await ensureBucket();
  const uploadedAt = new Date().toISOString();
  const { error } = await admin.storage
    .from(SALES_EXCEL_BUCKET)
    .upload(SALES_EXCEL_OBJECT, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
      cacheControl: "0",
    });
  if (error) throw new Error(error.message);

  await admin.storage.from(SALES_EXCEL_BUCKET).upload(
    META_OBJECT,
    JSON.stringify({ fileName, uploadedAt }),
    {
      contentType: "application/json",
      upsert: true,
      cacheControl: "0",
    },
  );
}

export async function loadIngestedWorkbook(): Promise<IngestedWorkbook | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(SALES_EXCEL_BUCKET)
    .download(SALES_EXCEL_OBJECT);
  if (error || !data) return null;

  let fileName = "managers.xlsx";
  let lastModified: string | null = null;
  const { data: metaFile } = await admin.storage
    .from(SALES_EXCEL_BUCKET)
    .download(META_OBJECT);
  if (metaFile) {
    try {
      const meta = JSON.parse(await metaFile.text()) as {
        fileName?: string;
        uploadedAt?: string;
      };
      if (meta.fileName) fileName = meta.fileName;
      if (meta.uploadedAt) lastModified = meta.uploadedAt;
    } catch {
      /* keep defaults */
    }
  }

  return {
    buffer: await data.arrayBuffer(),
    fileName,
    lastModified,
  };
}
