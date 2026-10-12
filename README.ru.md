# Figma Component Anatomy — скилл для Claude

[English version](README.md)

Скилл для агента, который собирает в Figma **страницы анатомии компонентов**: компонент в ×2 с аннотациями, таблица спецификаций и правила использования. Аннотации строятся скриптами по единому стандарту, поэтому страницы выглядят одинаково, а подписи не пересекаются.

- **Розовый** — отступы, зазоры, высота и ширина (`#E8457D`)
- **Синий** — размер текста и иконок (`#1F6BEB`)
- Значения в пилюлях, без номеров-сносок
- Пример остаётся живым instance вашего компонента
- Геометрическая проверка сообщает о касаниях и пересечениях подписей (`conflicts`)

## Что появится в Figma

Кадр `Documentation / <Имя> anatomy`:

1. Заголовок и легенда из двух цветов.
2. 3–5 блоков, по одному на каждую отдельную структуру. В блоке **Example** (instance с аннотациями) и **Specs** (точка · название · токен · значение).
3. **Usage** — правила ✓ / ✕ для дизайнеров.

Подписи на холсте по умолчанию на английском; легенду можно перевести полем `legend` в скриптах.

## Что нужно

- Агент с поддержкой скиллов (`SKILL.md`): Claude Code, Claude Desktop / claude.ai или другой совместимый.
- Figma MCP-сервер с инструментом **`use_figma`** (выполняет код Figma Plugin API в файле), подключённый с правом редактирования файла. Если доступен скилл Figma `figma-use`, агент загрузит его перед записью.
- Компонент в файле (component set, component или instance). Переменные (токены) не обязательны, но с ними таблица Specs точнее.
- Шрифт **Inter** или любое семейство, указанное в поле `font`.

## Установка

### Claude Code (плагин)

```
/plugin marketplace add kirilly2281/figma-anatomy-skill
/plugin install figma-component-anatomy@figma-anatomy-skill
```

Перезапустите сессию или выполните `/reload-plugins`. Скилл вызывается как `/figma-component-anatomy:component-anatomy`, а также подключается сам, когда вы просите сделать анатомию.

### Claude Code (копированием папки)

Скопируйте `plugins/figma-component-anatomy/skills/component-anatomy` в:

- `~/.claude/skills/component-anatomy` — для всех проектов, или
- `<ваш-проект>/.claude/skills/component-anatomy` — для одного проекта.

### Claude Desktop / claude.ai

Заархивируйте папку `component-anatomy` (саму папку, внутри которой лежит `SKILL.md`) в ZIP и загрузите в разделе Skills настроек.

### Другие агенты

Скопируйте папку `component-anatomy` в каталог скиллов агента. Скрипты — обычный код Figma Plugin API и работают с любым инструментом, который выполняет его в файле.

## Как пользоваться

Откройте Figma-файл и попросите агента, например:

> Сделай анатомию компонента Button из этого файла: https://www.figma.com/design/…?node-id=… Примеры: большая с иконками, маленькая и в фокусе.

Агент:

1. прочитает компонент, его свойства и привязанные токены;
2. выберет 3–5 примеров с разной структурой;
3. запустит `anatomy-page.js` — пустой кадр с блоками;
4. запустит `anatomy-annotate.js` — аннотации и проверку `conflicts`;
5. запустит `anatomy-specs.js` — токены и значения в каждом блоке;
6. напишет Usage и покажет скриншот каждого блока.

Скрипты можно запускать и самостоятельно через любой инструмент с `use_figma`: вставить файл целиком и поменять только блок `CFG`.

## Структура репозитория

```
.claude-plugin/marketplace.json              маркетплейс Claude Code
plugins/figma-component-anatomy/
  .claude-plugin/plugin.json                 манифест плагина
  skills/component-anatomy/
    SKILL.md                                 стандарт и порядок работы
    references/anatomy-guide.md              настройки CFG, рецепты, разбор ошибок
    references/plugin-api-notes.md           особенности Plugin API
    scripts/anatomy-page.js                  строит кадр анатомии
    scripts/anatomy-annotate.js              аннотации и проверка геометрии
    scripts/anatomy-specs.js                 таблица Specs
```

## Адаптация под ваши компоненты

По умолчанию ожидается типовая структура: instance → кадр контента → иконки и текстовые слои с именами вроде `Icon`, `Label`, `Text`. Для других структур у блока есть небольшие настройки: `rowOf`, `rowsOf`, `boxOf`, `classify`, `edges`, `backdrop`, `focused` и другие. Рецепты для бейджей, полей с подписью, выпадающих списков, чекбоксов, пагинации и карточек — в [anatomy-guide.md](plugins/figma-component-anatomy/skills/component-anatomy/references/anatomy-guide.md#recipes).

## Лицензия

[MIT](LICENSE)
