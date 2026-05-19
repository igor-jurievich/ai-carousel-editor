import Link from "next/link";
import styles from "./page.module.css";

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.4-2h4.2l1.4 2h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2 5 13h6l-1 9 8-12h-6l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0 0 18h1.2a1.8 1.8 0 0 0 1.1-3.2 1.7 1.7 0 0 1 1-3h1.2A4.5 4.5 0 0 0 21 10.3C21 6.3 17 3 12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7.5 11h.01M9.5 7.5h.01M14 7.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function LogoMark() {
  return (
    <span className={styles.logoMark} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

const modeLabels = ["Продажи", "Экспертиза", "Инструкция", "Диагностика", "Кейс", "Провокация"];
const featureCards = [
  {
    icon: <SparkIcon />,
    title: "AI выбирает режим сам",
    text: "Не нужно думать о структуре: 6 режимов определяются по теме и цели."
  },
  {
    icon: <CameraIcon />,
    title: "AI фото на ключевых слайдах",
    text: "Изображения под смысл темы: обложка, середина и финальный акцент."
  },
  {
    icon: <BoltIcon />,
    title: "6-10 слайдов за минуту",
    text: "Хук, структура, bullets и CTA появляются сразу в готовом редакторе."
  },
  {
    icon: <PaletteIcon />,
    title: "9 шаблонов под любой стиль",
    text: "Тёмные, светлые и минималистичные темы меняются без потери контента."
  }
];

const freeFeatures = ["Все шаблоны", "Экспорт PNG", "6 режимов контента"];
const proFeatures = ["Больше кредитов", "AI фото без лимитов", "Пакетный экспорт"];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="pastello.io">
          <LogoMark />
          <span>pastello.io</span>
        </Link>
        <nav className={styles.nav} aria-label="Навигация">
          <Link href="/login" className={styles.loginLink}>
            Войти
          </Link>
          <Link href="/signup" className={styles.headerCta}>
            <span className={styles.headerCtaFull}>Начать бесплатно</span>
            <span className={styles.headerCtaShort}>Начать</span>
            <ArrowIcon />
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>AI генератор каруселей</p>
            <h1>
              Один промпт.
              <br />
              Готовая карусель.
            </h1>
            <p className={styles.lead}>
              Опиши тему — AI выберет структуру, напишет текст и соберёт слайды.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup" className={styles.primaryCta}>
                Создать карусель <ArrowIcon />
              </Link>
              <Link href="/login" className={styles.secondaryCta}>
                Уже есть аккаунт
              </Link>
            </div>
            <p className={styles.microcopy}>5 карточек бесплатно · без карты</p>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            <div className={styles.heroCardLeft}>
              <div className={styles.cardTop}>
                <p>87% экспертов делают это неправильно</p>
              </div>
              <div className={styles.lines}>
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className={styles.heroCardCenter}>
              <p className={styles.cardTitle}>Как это исправить</p>
              <div className={styles.cardDivider} />
              <div className={styles.pointList}>
                {["Покажи пользу с первых секунд", "Дай структуру и логику", "Говори конкретно"].map((item) => (
                  <div key={item} className={styles.point}>
                    <span />
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.heroCardRight}>
              <p>
                Сохрани —
                <br />
                пригодится
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.steps}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Как работает</p>
          <h2>Как это работает</h2>
        </div>
        <div className={styles.stepsGrid}>
          <article className={styles.stepCard}>
            <div className={styles.stepIllustration}>
              <div className={styles.inputDemo}>
                <span>Почему мой продукт не покупают...</span>
                <div><ArrowIcon /></div>
              </div>
            </div>
            <div className={styles.stepTitleRow}><span>1</span><h3>Напиши тему</h3></div>
            <p>Одной фразы достаточно, чтобы начать структуру будущей карусели.</p>
          </article>
          <article className={styles.stepCard}>
            <div className={styles.stepIllustration}>
              <div className={styles.modeGrid}>
                {modeLabels.map((label, index) => (
                  <span key={label} className={index === 0 ? styles.modeActive : ""}>{label}</span>
                ))}
              </div>
            </div>
            <div className={styles.stepTitleRow}><span>2</span><h3>AI выберет режим</h3></div>
            <p>Продажи, экспертиза, инструкция, диагностика, кейс или social.</p>
          </article>
          <article className={styles.stepCard}>
            <div className={styles.stepIllustration}>
              <div className={styles.exportDemo}>
                <div className={styles.exportButton}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Экспорт PNG
                </div>
                <div className={styles.fileRow}>
                  {[1, 2, 3].map((item) => (
                    <div key={item} className={styles.fileCard}>
                      <span />
                      <p>PNG</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.stepTitleRow}><span>3</span><h3>Экспортируй</h3></div>
            <p>Открой результат в редакторе и скачай карточки для публикации.</p>
          </article>
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Возможности</p>
          <h2>Что внутри</h2>
        </div>
        <div className={styles.featuresGrid}>
          {featureCards.map((feature) => (
            <article key={feature.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.pricing}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Цены</p>
          <h2>Тарифы</h2>
        </div>
        <div className={styles.priceGrid}>
          <article className={styles.freePlan}>
            <p className={styles.planLabel}>Бесплатно</p>
            <p className={styles.price}>0 ₽</p>
            <p className={styles.planHint}>5 карточек при регистрации</p>
            <div className={styles.planFeatures}>
              {freeFeatures.map((feature) => (
                <div key={feature}><span><CheckIcon /></span>{feature}</div>
              ))}
            </div>
            <Link href="/signup" className={styles.planButton}>Начать бесплатно</Link>
          </article>
          <article className={styles.proPlan}>
            <div className={styles.proTitleRow}>
              <p className={styles.planLabelMuted}>Pro</p>
              <span>скоро</span>
            </div>
            <p className={styles.price}>—</p>
            <p className={styles.planHint}>Для регулярного контента</p>
            <div className={styles.planFeatures}>
              {proFeatures.map((feature) => (
                <div key={feature}><span><CheckIcon /></span>{feature}</div>
              ))}
            </div>
            <button className={styles.disabledButton} type="button" disabled>Скоро</button>
          </article>
        </div>
        <p className={styles.noCard}>Кредитная карта не нужна</p>
      </section>

      <section className={styles.finalCta}>
        <div>
          <h2>Первая карусель — прямо сейчас</h2>
          <p>5 карточек бесплатно. Без карты. Без объяснений.</p>
          <Link href="/signup">Собрать карусель →</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>pastello.io © 2026</p>
        <div>
          <Link href="/login">Войти</Link>
          <Link href="/signup">Регистрация</Link>
        </div>
      </footer>
    </main>
  );
}
