import { EditPostForm } from "./edit-post-form";

type EditPostPageProps = { params: Promise<{ postId: string }> };

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { postId } = await params;
  return (
    <main className="page-shell post-editor-page">
      <EditPostForm postId={postId} />
    </main>
  );
}
