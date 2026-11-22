import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/health — kiểm tra kết nối Supabase và bảng đã được tạo chưa.
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("novels").select("novel_id").limit(1);
    if (error) {
      const missingTable = error.code === "PGRST205";
      return Response.json(
        {
          status: "error",
          database: missingTable ? "schema_missing" : "query_failed",
          ...(process.env.NODE_ENV !== "production" && { detail: error.message }),
        },
        { status: 503 },
      );
    }
    return Response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("[health]", error);
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
