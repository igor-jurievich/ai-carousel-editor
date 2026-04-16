"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import styles from "./admin-page.module.css";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  topic: string | null;
  credits: number;
  createdAt: string | null;
};

type UsersResponse = {
  users?: AdminUser[];
  error?: string;
};

type UpdateCreditsResponse = {
  credits?: number;
  error?: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    void loadUsers();

    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return users;
    }

    return users.filter((user) => {
      const name = user.name?.toLowerCase() ?? "";
      const email = user.email.toLowerCase();
      return name.includes(normalizedSearch) || email.includes(normalizedSearch);
    });
  }, [search, users]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store"
      });
      const data = (await response.json()) as UsersResponse;

      if (!response.ok) {
        throw new Error(data.error || "Не удалось загрузить список пользователей.");
      }

      setUsers(data.users ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить список пользователей."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const applyCreditsAction = async (userId: string, action: "add" | "reset", amount?: number) => {
    const actionKey = `${userId}:${action}:${amount ?? "none"}`;
    setPendingActionKey(actionKey);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          action,
          amount
        })
      });

      const data = (await response.json()) as UpdateCreditsResponse;
      if (!response.ok || typeof data.credits !== "number") {
        throw new Error(data.error || "Не удалось обновить баллы.");
      }

      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? {
                ...user,
                credits: data.credits ?? user.credits
              }
            : user
        )
      );

      showToast(action === "reset" ? "Баллы сброшены ✓" : "Баллы добавлены ✓");
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Не удалось обновить баллы."
      );
    } finally {
      setPendingActionKey(null);
    }
  };

  const showToast = (message: string) => {
    setToast(message);

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2600);
  };

  const handleCustomTopUp = async (userId: string) => {
    const rawValue = customAmounts[userId] ?? "";
    const parsedValue = Number(rawValue);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      showToast("Введите положительное целое число");
      return;
    }

    await applyCreditsAction(userId, "add", parsedValue);
    setCustomAmounts((current) => ({
      ...current,
      [userId]: ""
    }));
  };

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase?.auth.signOut();
    } catch {
      // Ignore sign-out failures and redirect regardless.
    }

    router.replace("/login");
    router.refresh();
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brandWrap}>
            <h1 className={styles.brand}>pastello.io</h1>
            <span className={styles.panelLabel}>Admin Panel</span>
          </div>
          <button type="button" className={styles.signOutButton} onClick={() => void handleSignOut()}>
            Выйти
          </button>
        </header>

        <section className={styles.card}>
          <div className={styles.cardTop}>
            <h2 className={styles.title}>Пользователи</h2>
            <input
              className={styles.searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по имени или email"
            />
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Имя</th>
                  <th className={styles.mobileHidden}>Email</th>
                  <th className={styles.mobileHidden}>Роль</th>
                  <th className={styles.mobileHidden}>Тема</th>
                  <th>Баллы</th>
                  <th className={styles.mobileHidden}>Дата регистрации</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className={styles.stateCell}>
                      Загружаем пользователей...
                    </td>
                  </tr>
                ) : filteredUsers.length ? (
                  filteredUsers.map((user) => {
                    const plusTenActionKey = `${user.id}:add:10`;
                    const resetActionKey = `${user.id}:reset:none`;
                    const customValue = customAmounts[user.id] ?? "";

                    return (
                      <tr key={user.id}>
                        <td>{user.name?.trim() || "Без имени"}</td>
                        <td className={styles.mobileHidden}>{user.email || "—"}</td>
                        <td className={styles.mobileHidden}>{user.role?.trim() || "—"}</td>
                        <td className={styles.mobileHidden}>{user.topic?.trim() || "—"}</td>
                        <td>
                          <span className={styles.creditsPill}>⚡ {user.credits}</span>
                        </td>
                        <td className={styles.mobileHidden}>{formatDate(user.createdAt)}</td>
                        <td>
                          <div className={styles.desktopActions}>
                            <button
                              type="button"
                              className={styles.actionButton}
                              disabled={pendingActionKey === plusTenActionKey}
                              onClick={() => void applyCreditsAction(user.id, "add", 10)}
                            >
                              +10
                            </button>
                            <div className={styles.customAction}>
                              <input
                                className={styles.customInput}
                                value={customValue}
                                onChange={(event) =>
                                  setCustomAmounts((current) => ({
                                    ...current,
                                    [user.id]: event.target.value
                                  }))
                                }
                                inputMode="numeric"
                                placeholder="Сумма"
                              />
                              <button
                                type="button"
                                className={styles.actionButton}
                                disabled={pendingActionKey === `${user.id}:add:${customValue}`}
                                onClick={() => void handleCustomTopUp(user.id)}
                              >
                                Добавить
                              </button>
                            </div>
                            <button
                              type="button"
                              className={styles.actionButtonSecondary}
                              disabled={pendingActionKey === resetActionKey}
                              onClick={() => void applyCreditsAction(user.id, "reset")}
                            >
                              Сбросить
                            </button>
                          </div>

                          <button
                            type="button"
                            className={styles.mobileTopUp}
                            disabled={pendingActionKey === plusTenActionKey}
                            onClick={() => void applyCreditsAction(user.id, "add", 10)}
                          >
                            +10
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className={styles.stateCell}>
                      Пользователи не найдены.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </main>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}
