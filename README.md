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
