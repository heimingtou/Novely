import WriterDashboard from "@/components/Writer/WriterDashboard";
import { requireUser } from "@/server/auth/dal";
import { listMyNovels } from "@/server/services/writer";
import "./page.css";

export const metadata = { title: "Truyện đã viết | Novely" };

export default async function WriterPage() {
  const user = await requireUser("/Writer");
  const novels = await listMyNovels(user);
  return <WriterDashboard novels={novels} />;
}
