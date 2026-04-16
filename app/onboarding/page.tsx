"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import styles from "./onboarding.module.css";

type ChatStep = "name" | "role" | "topic" | "login" | "password" | "creating";
type ChatMessage = {
  id: string;
  role: "bot" | "user";
  text: string;
  isLoading?: boolean;
};

type OnboardingDraft = {
  name: string;
  role: string;
  topic: string;
  login: string;
  email: string;
  password: string;
};

const ROLE_OPTIONS = [
  "Риелтор",
  "Маркетолог",
  "Эксперт/блогер",
  "Малый бизнес",
  "Другое"
];

const TOPIC_HINT = "Недвижимость, личный бренд, продажи...";

function createMessageId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function resolveEmailFromLogin(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (isEmail(trimmed)) {
    return trimmed;
  }

  const username = trimmed.replace(/\s+/gu, "").replace(/[^a-z0-9._-]/giu, "");
  if (!username) {
    return null;
  }

  return `${username}@pastello.io`;
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Что-то пошло не так. Попробуй ещё раз";
  }

  const message = error.message.toLowerCase();
  if (message.includes("fetch failed") || message.includes("network")) {
    return "Не удаётся подключиться к серверу авторизации. Проверь настройки Supabase и попробуй ещё раз";
  }
  if (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("already exists")
  ) {
    return "Этот email уже используется. Попробуй другой или войди в аккаунт";
  }

  if (message.includes("password") && message.includes("least 6")) {
    return "Пароль должен быть минимум 6 символов";
  }

  return "Что-то пошло не так. Попробуй ещё раз";
}

export default function OnboardingPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createMessageId("bot"),
      role: "bot",
      text: "Привет! Я помогу тебе создавать\nкрутые Instagram-карусели 🎨\nКак тебя зовут?"
    }
  ]);
  const [step, setStep] = useState<ChatStep>("name");
  const [input, setInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft>({
    name: "",
    role: "",
    topic: "",
    login: "",
    email: "",
    password: ""
  });

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isPasswordStep = step === "password";
  const placeholder = useMemo(() => {
    if (step === "name") {
      return "Введите имя";
    }
    if (step === "role") {
      return "Напишите вашу роль";
    }
    if (step === "topic") {
      return "Например: личный бренд для экспертов";
    }
    if (step === "login") {
      return "email или никнейм";
    }
    if (step === "password") {
      return "Введите пароль";
    }
    return "";
  }, [step]);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const addBotMessage = (text: string, isLoading = false) => {
    setMessages((current) => [
      ...current,
      {
        id: createMessageId("bot"),
        role: "bot",
        text,
        isLoading
      }
    ]);
  };

  const addUserMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: createMessageId("user"),
        role: "user",
        text
      }
    ]);
  };

  const stopLoadingMessage = () => {
    setMessages((current) => {
      if (!current.length) {
        return current;
      }

      const updated = [...current];
      const last = updated[updated.length - 1];
      if (last.isLoading) {
        updated[updated.length - 1] = { ...last, isLoading: false };
      }
      return updated;
    });
  };

  const createAccount = async (finalDraft: OnboardingDraft) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      stopLoadingMessage();
      addBotMessage("Что-то пошло не так. Попробуй ещё раз");
      setIsSubmitting(false);
      setStep("login");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: finalDraft.email,
        password: finalDraft.password,
        options: {
          data: {
            name: finalDraft.name,
            role: finalDraft.role,
            topic: finalDraft.topic
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.user?.id) {
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            name: finalDraft.name,
            role: finalDraft.role,
            topic: finalDraft.topic
          },
          {
            onConflict: "id"
          }
        );

        if (
          profileError &&
          !profileError.message.toLowerCase().includes("row-level security") &&
          !profileError.message.toLowerCase().includes("permission denied")
        ) {
          throw profileError;
        }
      }

      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: finalDraft.email,
          password: finalDraft.password
        });

        if (signInError && !signInError.message.toLowerCase().includes("email not confirmed")) {
          throw signInError;
        }
      }

      router.replace("/generate");
      router.refresh();
    } catch (error) {
      stopLoadingMessage();
      const message = getErrorMessage(error);
      addBotMessage(message);

      if (message.includes("email уже используется")) {
        setStep("login");
      } else if (message.includes("серверу авторизации")) {
        setStep("login");
      } else if (message.includes("Пароль должен")) {
        setStep("password");
      } else {
        setStep("password");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitValue = async (rawValue: string) => {
    if (step === "creating" || isSubmitting) {
      return;
    }

    const value = step === "password" ? rawValue : rawValue.trim();
    if (!value) {
      return;
    }

    if (step === "name") {
      addUserMessage(value);
      setDraft((current) => ({
        ...current,
        name: value
      }));
      addBotMessage(`Приятно познакомиться, ${value}! 👋\nЧем ты занимаешься?`);
      setInput("");
      setStep("role");
      return;
    }

    if (step === "role") {
      addUserMessage(value);
      setDraft((current) => ({
        ...current,
        role: value
      }));
      addBotMessage("Отлично! О чём ты обычно пишешь\nили хочешь писать?");
      setInput("");
      setStep("topic");
      return;
    }

    if (step === "topic") {
      addUserMessage(value);
      setDraft((current) => ({
        ...current,
        topic: value
      }));
      addBotMessage("Почти готово! Придумай себе логин\n(email или никнейм):");
      setInput("");
      setStep("login");
      return;
    }

    if (step === "login") {
      const email = resolveEmailFromLogin(value);
      if (!email) {
        addBotMessage("Не удалось распознать логин. Введи email или никнейм без пробелов.");
        return;
      }

      addUserMessage(value);
      setDraft((current) => ({
        ...current,
        login: value,
        email
      }));
      addBotMessage("И последнее — придумай пароль\n(минимум 6 символов):");
      setInput("");
      setStep("password");
      return;
    }

    if (step === "password") {
      if (value.length < 6) {
        addBotMessage("Пароль должен быть минимум 6 символов");
        return;
      }

      addUserMessage("••••••");
      const finalDraft: OnboardingDraft = {
        ...draft,
        password: value
      };
      setDraft(finalDraft);
      setInput("");
      setIsSubmitting(true);
      setStep("creating");
      addBotMessage(`🎉 Всё готово, ${finalDraft.name}!\nСоздаю твой аккаунт...`, true);
      await createAccount(finalDraft);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.chatCard}>
        <div className={styles.messages} ref={messagesRef}>
          {messages.map((message) => (
            <article
              key={message.id}
              className={`${styles.message} ${message.role === "bot" ? styles.botMessage : styles.userMessage}`}
            >
              <p>{message.text}</p>
              {message.isLoading ? (
                <span className={styles.loader} aria-label="Загрузка" role="status">
                  <span />
                  <span />
                  <span />
                </span>
              ) : null}
            </article>
          ))}
        </div>

        {step === "role" ? (
          <div className={styles.quickOptions}>
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                type="button"
                className={styles.roleButton}
                onClick={() => void submitValue(role)}
                disabled={isSubmitting}
              >
                {role}
              </button>
            ))}
          </div>
        ) : null}

        {step === "topic" ? <p className={styles.topicHint}>{TOPIC_HINT}</p> : null}

        <form
          className={styles.inputRow}
          onSubmit={(event) => {
            event.preventDefault();
            void submitValue(input);
          }}
        >
          <div className={styles.inputWrapper}>
            <input
              ref={inputRef}
              className={styles.input}
              type={isPasswordStep && !showPassword ? "password" : "text"}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={placeholder}
              autoComplete={isPasswordStep ? "new-password" : "off"}
              disabled={step === "creating" || isSubmitting}
            />
            {isPasswordStep ? (
              <button
                className={styles.eyeButton}
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            ) : null}
          </div>
          <button
            className={styles.sendButton}
            type="submit"
            disabled={step === "creating" || isSubmitting}
            aria-label="Отправить"
          >
            →
          </button>
        </form>
      </section>
    </main>
  );
}
