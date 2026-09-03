import type { EmailService, SendEmailVerificationInput } from "./email.service.js";

type BrevoEmailServiceOptions = { apiKey: string; senderEmail: string; senderName: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]!);
}

export class BrevoEmailService implements EmailService {
  constructor(private readonly options: BrevoEmailServiceOptions) {}

  async sendEmailVerification(input: SendEmailVerificationInput) {
    const safeName = escapeHtml(input.name);
    const safeUrl = escapeHtml(input.verificationUrl);
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "api-key": this.options.apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { email: this.options.senderEmail, name: this.options.senderName },
        to: [{ email: input.email, name: input.name }],
        subject: "[Study Board] 이메일 인증을 완료해주세요",
        textContent: `${input.name}님, Study Board 회원가입을 완료하려면 다음 링크를 열어주세요.\n\n${input.verificationUrl}\n\n이 링크는 30분 동안 유효합니다.`,
        htmlContent: `<!doctype html><html lang="ko"><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033"><div style="max-width:560px;margin:0 auto;padding:40px 20px"><div style="background:#fff;border:1px solid #dfe5ef;border-radius:18px;padding:36px"><p style="margin:0 0 12px;color:#3563e9;font-weight:700">Study Board</p><h1 style="margin:0 0 18px;font-size:28px">이메일을 인증해주세요</h1><p style="margin:0 0 24px;line-height:1.7">${safeName}님, 아래 버튼을 눌러 회원가입을 완료해주세요. 인증 링크는 30분 동안 유효합니다.</p><a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#3563e9;color:#fff;font-weight:700;text-decoration:none">이메일 인증하기</a><p style="margin:28px 0 0;color:#778195;font-size:13px;line-height:1.6">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p></div></div></body></html>`,
        tags: ["study-board"]
      }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { code?: string };
      throw new Error(`Brevo email delivery failed (${response.status}${error.code ? `, ${error.code}` : ""})`);
    }
  }
}
