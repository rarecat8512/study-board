import type { RequestHandler } from "express";
import type { EmailService } from "../email/email.service.js";
import { env } from "../../config/env.js";
import type { ChangePasswordInput, DeleteAccountInput, LoginInput, RegisterInput, VerifyEmailInput } from "./auth.schema.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  loginUser,
  registerUser,
  revokeAuthSession,
  rotateRefreshToken,
  verifyEmail,
  changePassword,
  deleteAccount
} from "./auth.service.js";

export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

function setRefreshTokenCookie(
  response: Parameters<RequestHandler>[1],
  token: string,
  expires: Date
) {
  response.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/api/auth",
    expires
  });
}

function clearRefreshTokenCookie(response: Parameters<RequestHandler>[1]) {
  response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/api/auth"
  });
}

export function createRegisterController(emailService: EmailService): RequestHandler {
  return async (request, response) => {
    const user = await registerUser(request.body as RegisterInput, emailService);

    response.status(201).json({
      message: "인증 이메일을 발송했습니다.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  };
}

export const verifyEmailController: RequestHandler = async (request, response) => {
  const user = await verifyEmail(request.body as VerifyEmailInput);

  response.status(200).json({
    message: "이메일 인증이 완료되었습니다.",
    user
  });
};

export const loginController: RequestHandler = async (request, response) => {
  const result = await loginUser(request.body as LoginInput);

  setRefreshTokenCookie(response, result.refreshToken, result.refreshTokenExpiresAt);

  response.status(200).json({
    accessToken: result.accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: result.user
  });
};

export const refreshController: RequestHandler = async (request, response) => {
  const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME] as string | undefined;

  if (!refreshToken) {
    clearRefreshTokenCookie(response);
    response.status(401).json({
      code: "REFRESH_TOKEN_REQUIRED",
      message: "로그인이 필요합니다."
    });
    return;
  }

  try {
    const result = await rotateRefreshToken(refreshToken);
    setRefreshTokenCookie(response, result.refreshToken, result.refreshTokenExpiresAt);
    response.status(200).json({
      accessToken: result.accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: result.user
    });
  } catch (error) {
    clearRefreshTokenCookie(response);
    throw error;
  }
};

export const logoutController: RequestHandler = async (request, response) => {
  const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME] as string | undefined;

  await revokeAuthSession(refreshToken);
  clearRefreshTokenCookie(response);
  response.status(204).send();
};

export const getCurrentUserController: RequestHandler = (request, response) => {
  response.status(200).json({
    user: {
      id: request.auth!.userId,
      email: request.auth!.email,
      name: request.auth!.name
    }
  });
};

export const changePasswordController: RequestHandler = async (request, response) => {
  await changePassword(request.auth!.userId, request.body as ChangePasswordInput);
  clearRefreshTokenCookie(response);
  response.status(200).json({ message: "비밀번호가 변경되었습니다. 모든 기기에서 다시 로그인해주세요." });
};

export const deleteAccountController: RequestHandler = async (request, response) => {
  await deleteAccount(request.auth!.userId, request.body as DeleteAccountInput);
  clearRefreshTokenCookie(response);
  response.status(200).json({ message: "회원 탈퇴가 완료되었습니다." });
};
