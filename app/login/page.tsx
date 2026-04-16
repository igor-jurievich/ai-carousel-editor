"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        throw error;
      }

      router.replace("/generate");
      router.refresh();
    } catch {
      setErrorMessage("Неверный email или пароль");
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
            <label className={styles.fieldLabel} htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
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
