import CreateNovelFlow from "@/components/Writer/CreateNovelFlow";

export default async function NewNovelPage({ searchParams }) {
  const { novelId, chapterId } = await searchParams;
  return (
    <CreateNovelFlow
      novelId={typeof novelId === "string" ? novelId : ""}
      chapterId={typeof chapterId === "string" ? chapterId : ""}
    />
  );
}
