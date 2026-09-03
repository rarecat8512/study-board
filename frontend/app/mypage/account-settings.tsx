"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/auth-context";
import { apiUrl, readApiResponse } from "../lib/api";

export function AccountSettings() {
  const router = useRouter();
  const { authorizedFetch, clearAuth } = useAuth();
  const [passwordError, setPasswordError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsChanging(true);
    setPasswordError("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await authorizedFetch(apiUrl("/api/auth/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: String(formData.get("currentPassword") ?? ""),
          newPassword: String(formData.get("newPassword") ?? ""),
          newPasswordConfirm: String(formData.get("newPasswordConfirm") ?? "")
        })
      });
      await readApiResponse(response, "비밀번호를 변경하지 못했습니다.");
      clearAuth();
      router.replace("/login?status=password-changed");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "비밀번호 변경 중 문제가 발생했습니다.");
      setIsChanging(false);
    }
  }

  async function handleAccountDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDeleting(true);
    setDeleteError("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await authorizedFetch(apiUrl("/api/auth/account"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: String(formData.get("currentPassword") ?? "") })
      });
      await readApiResponse(response, "회원 탈퇴를 처리하지 못했습니다.");
      clearAuth();
      router.replace("/login?status=account-deleted");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "회원 탈퇴 처리 중 문제가 발생했습니다.");
      setIsDeleting(false);
    }
  }

  return (
    <section className="account-settings">
      <h2>계정 관리</h2>
      <div className="account-settings-grid">
        <form className="account-form" onSubmit={handlePasswordChange}>
          <h3>비밀번호 변경</h3>
          <p>변경 후 모든 기기에서 로그아웃됩니다.</p>
          <label className="form-field"><span>현재 비밀번호</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label className="form-field"><span>새 비밀번호</span><input name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
          <label className="form-field"><span>새 비밀번호 확인</span><input name="newPasswordConfirm" type="password" autoComplete="new-password" minLength={8} required /></label>
          {passwordError ? <p className="form-error" role="alert">{passwordError}</p> : null}
          <button className="login-button" type="submit" disabled={isChanging}>{isChanging ? "변경 중..." : "비밀번호 변경"}</button>
        </form>
        <div className="account-danger">
          <h3>회원 탈퇴</h3>
          <p>개인정보는 즉시 영구 삭제되고, 작성한 글과 댓글은 ‘탈퇴한 사용자’의 기록으로 남습니다.</p>
          {!showDelete ? <button className="danger-button" type="button" onClick={() => setShowDelete(true)}>탈퇴 절차 시작</button> : (
            <form className="account-form" onSubmit={handleAccountDelete}>
              <label className="form-field"><span>현재 비밀번호</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
              <label className="form-field"><span>확인을 위해 ‘회원탈퇴’를 입력해주세요</span><input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} required /></label>
              {deleteError ? <p className="form-error" role="alert">{deleteError}</p> : null}
              <div className="account-danger-actions"><button className="secondary-button" type="button" onClick={() => setShowDelete(false)} disabled={isDeleting}>취소</button><button className="danger-button" type="submit" disabled={isDeleting || deletePhrase !== "회원탈퇴"}>{isDeleting ? "처리 중..." : "회원 탈퇴 확정"}</button></div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
