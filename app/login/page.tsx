"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage("Что-то пошло не так. Попробуйте ещё раз");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const authEmail = resolveAuthEmailFromLogin(login);
      if (!authEmail) {
        throw new Error("invalid_login");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password
      });

      if (error) {
        throw error;
      }

      router.replace("/generate");
      router.refresh();
    } catch {
      setErrorMessage("Неверный логин или пароль");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.wrapper}>
        <p className={styles.logo}>pastello.io</p>

        <div className={styles.card}>
          <h1 className={styles.title}>Добро пожаловать</h1>
          <p className={styles.subtitle}>Войди в свой аккаунт</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.fieldLabel} htmlFor="login-username">
              Логин
            </label>
            <input
              id="login-username"
              type="text"
              className={styles.input}
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              placeholder="например: igor.jurievich"
              required
            />

            <label className={styles.fieldLabel} htmlFor="login-password">
              Пароль
            </label>
            <div className={styles.passwordRow}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className={styles.input}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>

            <button className={styles.submitButton} type="submit" disabled={isLoading}>
              {isLoading ? "Входим..." : "Войти"}
            </button>

            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
          </form>

          <p className={styles.registerHint}>
            Нет аккаунта?{" "}
            <Link className={styles.registerLink} href="/onboarding">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function resolveAuthEmailFromLogin(value: string) {
  const trimmed = value.trim().toLowerCase();
  const localPart = trimmed.split("@")[0] ?? "";
  const normalized = localPart
    .replace(/\s+/gu, "")
    .replace(/[^a-z0-9._-]/giu, "");

  if (!normalized) {
    return null;
  }

  return `${normalized}@pastello.io`;
}
