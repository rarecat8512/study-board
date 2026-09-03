export type SendEmailVerificationInput = {
  email: string;
  name: string;
  verificationUrl: string;
};

export interface EmailService {
  sendEmailVerification(input: SendEmailVerificationInput): Promise<void>;
}
