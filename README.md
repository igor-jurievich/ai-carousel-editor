# AI Carousel Editor

## Project overview

AI Carousel Editor — веб-редактор для генерации и редактирования каруселей для соцсетей.

## Features

- AI генерирует только текст и структуру (JSON)
- редактор слайдов на canvas
- поддержка форматов `1:1` / `4:5` / `9:16`
- 3 фиксированные темы: тёмная / светлая / цветная
- 5 фиксированных типов слайдов: `text` / `list` / `big_text` / `image_text` / `cta`
- inline редактирование текста
- только ручная загрузка изображений (без автопоиска)
- экспорт `ZIP` / `PNG` / `JPG` / `PDF`
- mobile и desktop интерфейс

## Tech stack

- Next.js
- React
- Konva canvas
- OpenAI API

## Local development

```bash
npm install
npm run dev
```

После запуска откройте `http://localhost:3000/editor`.

## Production build

```bash
npm run build
npm run start
```

## Quality smoke

```bash
# API quality matrix (topics x formats x themes)
npm run quality:generate

# mobile UI smoke (Playwright)
npm run smoke:mobile
```

Параметры (опционально):

- `QUALITY_BASE_URL` — URL приложения (по умолчанию `http://localhost:3000`)
- `QUALITY_RUNS` — число прогонов матрицы (по умолчанию `1`)
- `QUALITY_TIMEOUT_MS` — timeout одного запроса (по умолчанию `80000`)
- `QUALITY_TOPICS_LIMIT` — ограничить число тем для быстрого прогона
- `QUALITY_FORMATS` — форматы через запятую, например `1:1,4:5`
- `QUALITY_THEMES` — темы через запятую, например `light,dark`

Отчёт сохраняется в `test-results/quality-gate-latest.json`.
Mobile UI отчёт сохраняется в `test-results/mobile-ui-smoke-latest.json`.

## CI gates

- `.github/workflows/release-gate.yml` — typecheck/build + mobile smoke + API quality gate (если задан `OPENAI_API_KEY` secret).
- `.github/workflows/nightly-quality.yml` — ночной прогон на production (`quality:generate` + `smoke:mobile`).

## Environment variables

Создайте `.env.local` на основе `.env.example`:

```env
OPENAI_API_KEY=
OPENAI_GENERATION_MODEL=
GENERATE_TIMEOUT_MS=
GENERATE_RATE_LIMIT_MAX=
GENERATE_RATE_LIMIT_WINDOW_MS=
```

- `OPENAI_API_KEY` — ключ OpenAI API (обязательный).
- `OPENAI_GENERATION_MODEL` — модель для генерации (по умолчанию `gpt-5.3`).
- `GENERATE_TIMEOUT_MS` — серверный timeout генерации в миллисекундах.
- `GENERATE_RATE_LIMIT_MAX` — максимальное число запросов к `/api/generate` за окно.
- `GENERATE_RATE_LIMIT_WINDOW_MS` — длина окна rate limit в миллисекундах.

## Project status

- MVP version
- предназначен для первых тестовых пользователей
