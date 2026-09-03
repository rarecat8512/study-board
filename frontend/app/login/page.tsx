import { LoginForm } from "./login-form";

type LoginPageProps = { searchParams: Promise<{ status?: string | string[] }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const rawStatus = (await searchParams).status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const notice = status === "password-changed"
    ? "비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요."
    : status === "account-deleted"
      ? "회원 탈퇴가 완료되었습니다. 개인정보는 영구 삭제되었습니다."
      : undefined;
  return (
    <main className="page-shell login-page">
      <LoginForm notice={notice} />
    </main>
  );
}
