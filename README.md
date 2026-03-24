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

# export smoke (ZIP/PNG/JPG/PDF x 1:1/4:5/9:16)
npm run smoke:export

# сохранить текущий quality-report как baseline
npm run quality:baseline:update

# сравнить текущий report с baseline
npm run quality:baseline:diff
```

Параметры (опционально):

- `QUALITY_BASE_URL` — URL приложения (по умолчанию `http://localhost:3000`)
- `QUALITY_RUNS` — число прогонов матрицы (по умолчанию `1`)
- `QUALITY_TIMEOUT_MS` — timeout одного запроса (по умолчанию `80000`)
- `QUALITY_TOPICS_LIMIT` — ограничить число тем для быстрого прогона
- `QUALITY_FORMATS` — форматы через запятую, например `1:1,4:5`
- `QUALITY_THEMES` — темы через запятую, например `light,dark`
- `QUALITY_ALLOWED_FAILURE_DELTA` — допустимый рост total failed при diff
- `QUALITY_ALLOWED_FAILURE_RATE_DELTA` — допустимый рост fail rate при diff
- `QUALITY_ALLOWED_CATEGORY_DELTA` — допустимый рост по каждой категории ошибок
- `EXPORT_SMOKE_FORMATS` — форматы для export smoke, например `1:1,4:5`
- `EXPORT_SMOKE_MODES` — режимы экспорта, например `zip,png,pdf`

Отчёт сохраняется в `test-results/quality-gate-latest.json`.
Mobile UI отчёт сохраняется в `test-results/mobile-ui-smoke-latest.json`.
Export smoke отчёт сохраняется в `test-results/export-smoke-latest.json`.
Baseline diff сохраняется в `test-results/quality-baseline-diff-latest.json`.

## CI gates

- `.github/workflows/release-gate.yml` — typecheck/build + `smoke:mobile` + `smoke:export` + quality gate + baseline diff.
- `.github/workflows/nightly-quality.yml` — ночной прогон на production (`quality:generate` + baseline diff + `smoke:mobile` + `smoke:export`).

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
