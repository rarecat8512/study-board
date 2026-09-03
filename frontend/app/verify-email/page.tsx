import { VerificationResult } from "./verification-result";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  const verificationToken = Array.isArray(token) ? token[0] : token;

  return (
    <main className="page-shell verification-page">
      <VerificationResult token={verificationToken} />
    </main>
  );
}
