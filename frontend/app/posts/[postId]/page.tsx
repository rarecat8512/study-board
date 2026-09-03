import Link from "next/link";
import { PostDetail } from "./post-detail";

type PostDetailPageProps = {
  params: Promise<{ postId: string }>;
};

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { postId } = await params;

  return (
    <main className="post-detail-page">
      <nav className="post-detail-nav">
        <Link href="/posts">← 게시글 목록</Link>
      </nav>
      <PostDetail postId={postId} />
    </main>
  );
}
