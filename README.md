# AI Carousel Editor

AI Carousel Editor — веб-редактор для генерации и редактирования каруселей для соцсетей.

## MVP возможности

- генерация каруселей через OpenAI
- редактор слайдов на canvas
- поддержка форматов `1:1` / `4:5` / `9:16`
- inline редактирование текста
- загрузка изображений
- экспорт `ZIP` / `PNG` / `PDF`
- mobile и desktop интерфейс

## Технологии

- Next.js
- React
- Konva canvas
- OpenAI API

## Локальный запуск

```bash
npm install
npm run dev
```

После запуска откройте `http://localhost:3000/editor`.

## Production запуск

```bash
npm run build
npm run start
```

## Переменные окружения

Создайте `.env.local` на основе `.env.example`:

```env
OPENAI_API_KEY=
OPENAI_MODEL=
GENERATE_TIMEOUT_MS=
GENERATE_RATE_LIMIT_MAX=
GENERATE_RATE_LIMIT_WINDOW_MS=
```

- `OPENAI_API_KEY` — ключ OpenAI API (обязательный).
- `OPENAI_MODEL` — модель для генерации (опционально, если пусто используется значение по умолчанию в коде).
- `GENERATE_TIMEOUT_MS` — серверный timeout генерации в миллисекундах.
- `GENERATE_RATE_LIMIT_MAX` — максимальное число запросов к `/api/generate` за окно.
- `GENERATE_RATE_LIMIT_WINDOW_MS` — длина окна rate limit в миллисекундах.

## Статус проекта

- MVP version
- предназначен для первых тестовых пользователей
