import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Download, Sparkles, Wand2 } from "lucide-react";
import styles from "./page.module.css";

const highlights = [
  {
    icon: <Wand2 size={20} aria-hidden="true" />,
    title: "Структура под тему",
    text: "Pastello выбирает режим: продажи, экспертность, инструкция, диагностика, кейс или social."
  },
  {
    icon: <Sparkles size={20} aria-hidden="true" />,
    title: "Готовый текст",
    text: "Заголовки, body, bullets и CTA собираются в связную карусель без пустых шаблонов."
  },
  {
    icon: <Download size={20} aria-hidden="true" />,
    title: "Экспорт в PNG",
    text: "Откройте результат в редакторе, поправьте стиль и выгрузите карточки для публикации."
  }
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <Image
          src="/hero-cards.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroScrim} aria-hidden="true" />
        <header className={styles.nav}>
          <Link href="/" className={styles.logo} aria-label="pastello.io">
            pastello.io
          </Link>
          <nav className={styles.navActions} aria-label="Навигация">
            <Link href="/login" className={styles.secondaryLink}>
              Войти
            </Link>
            <Link href="/signup" className={styles.navCta}>
              Начать
            </Link>
          </nav>
        </header>

        <div className={styles.heroContent}>
          <p className={styles.kicker}>AI генератор Instagram каруселей</p>
          <h1 id="hero-title">pastello.io</h1>
          <p className={styles.heroLead}>
            Один промпт превращается в готовую структуру, текст и карточки для экспертного контента.
          </p>
          <div className={styles.heroActions}>
            <Link href="/signup" className={styles.primaryCta}>
              Создать карусель
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/login" className={styles.ghostCta}>
              Уже есть аккаунт
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.stepsSection} aria-labelledby="steps-title">
        <div className={styles.sectionCopy}>
          <p className={styles.kicker}>Как выглядит поток</p>
          <h2 id="steps-title">Тема, структура, экспорт</h2>
        </div>
        <div className={styles.stepsImageWrap}>
          <Image
            src="/steps-illustration.png"
            alt="Три шага генерации карусели: тема, AI структура, экспорт"
            width={1600}
            height={1120}
            sizes="(max-width: 900px) 100vw, 1100px"
            className={styles.stepsImage}
          />
        </div>
      </section>

      <section className={styles.highlightsSection} aria-label="Ключевые преимущества">
        {highlights.map((item) => (
          <article key={item.title} className={styles.highlight}>
            <span className={styles.highlightIcon}>{item.icon}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
