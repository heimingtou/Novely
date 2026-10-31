import CreateNovelFlow from "@/components/Writer/CreateNovelFlow";

export default async function NewNovelPage({ searchParams }) {
  const { novelId } = await searchParams;
  return <CreateNovelFlow novelId={typeof novelId === "string" ? novelId : ""} />;
}
