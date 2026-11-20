// Генерирует supabase/seed/initial_content.sql из текущей программы src/data/lessons.ts.
// Запуск: node scripts/generate-seed.mjs
// Тесты и правильные ответы НЕ переносятся (этап 3Б).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(join(root, 'src/data/lessons.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const lessons = mod.buildProgramLessons();

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const groups = [
  { id: 'claude', title: 'Claude', description: 'Тексты, документы, запросы и рабочие задачи с Claude', sort: 1 },
  { id: 'chatgpt', title: 'ChatGPT', description: 'Идеи, обучение и повседневные задачи с ChatGPT', sort: 2 },
];

let sql = `-- DIGEX Campus — начальное наполнение: 2 группы и по 6 уроков.
-- Сгенерировано scripts/generate-seed.mjs из src/data/lessons.ts. Не редактируйте вручную.
-- Выполняется ПОСЛЕ миграции 20261118000000_learning.sql (в SQL Editor, от владельца БД).
-- Повторное выполнение безопасно: существующие группы и уроки (в том числе изменённые администратором)
-- не перезаписываются и не дублируются (ON CONFLICT DO NOTHING по стабильным id).
-- Тесты и правильные ответы не переносятся — это этап 3Б.

begin;

insert into public.groups (id, title, description, sort_order) values
${groups.map((g) => `  (${q(g.id)}, ${q(g.title)}, ${q(g.description)}, ${g.sort})`).join(',\n')}
on conflict (id) do nothing;

insert into public.lessons (id, group_id, title, position, goal, content, example_prompt, task, youtube_url, published) values
`;
sql += lessons
  .map((l) => `  (${q(l.id)}, ${q(l.groupId)}, ${q(l.title)}, ${l.order},\n   ${q(l.goal)},\n   ${q(l.content.join('\n\n'))},\n   ${q(l.examplePrompt)},\n   ${q(l.task)},\n   null, true)`)
  .join(',\n');
sql += `
on conflict (id) do nothing;

commit;
`;
writeFileSync(join(root, 'supabase/seed/initial_content.sql'), sql);
console.log(`groups: ${groups.length}, lessons: ${lessons.length} (${lessons.filter((l) => l.groupId === 'claude').length} claude / ${lessons.filter((l) => l.groupId === 'chatgpt').length} chatgpt)`);
