import type { EmailService, SendEmailVerificationInput } from "./email.service.js";

export class ConsoleEmailService implements EmailService {
  async sendEmailVerification(input: SendEmailVerificationInput) {
    console.log("[development email verification]", {
      to: input.email,
      name: input.name,
      verificationUrl: input.verificationUrl
    });
  }
}
