// Генерирует supabase/seed/quizzes.sql — тесты к 12 урокам из подготовленных вопросов src/data/lessons.ts.
// Запуск: node scripts/generate-quiz-seed.mjs
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
let sql = `-- DIGEX Campus — начальные тесты: по 3 вопроса к каждому из 12 уроков.
-- Сгенерировано scripts/generate-quiz-seed.mjs из src/data/lessons.ts. Не редактируйте вручную.
-- Выполняется ПОСЛЕ миграции 20261120000000_quizzes.sql (в SQL Editor, от владельца БД).
-- Повторное выполнение безопасно: тест создаётся, только если у урока его ещё нет — существующие тесты
-- (в том числе изменённые администратором) не перезаписываются и не дублируются.
-- Попытки и результаты не создаются.

do $$
declare
  v_quiz uuid;
begin
`;
for (const l of lessons) {
  if (!l.quiz.length) continue;
  sql += `
  -- ${l.id}: ${l.title}
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select ${q(l.id)}, false where exists (select 1 from public.lessons where id = ${q(l.id)})
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
${l.quiz.map((qq, i) => `      (v_quiz, ${i + 1}, ${q(qq.text)}, array[${qq.options.map(q).join(', ')}], ${qq.correctIndex})`).join(',\n')};
    update public.quizzes set published = true where id = v_quiz;
  end if;
`;
}
sql += `end;
$$;
`;
writeFileSync(join(root, 'supabase/seed/quizzes.sql'), sql);
const withQuiz = lessons.filter((l) => l.quiz.length);
console.log(`тестов: ${withQuiz.length}, вопросов: ${withQuiz.reduce((n, l) => n + l.quiz.length, 0)} (по ${[...new Set(withQuiz.map((l) => l.quiz.length))].join('/')} на урок)`);
