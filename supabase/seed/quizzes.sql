-- DIGEX Campus — начальные тесты: по 3 вопроса к каждому из 12 уроков.
-- Сгенерировано scripts/generate-quiz-seed.mjs из src/data/lessons.ts. Не редактируйте вручную.
-- Выполняется ПОСЛЕ миграции 20261120000000_quizzes.sql (в SQL Editor, от владельца БД).
-- Повторное выполнение безопасно: тест создаётся, только если у урока его ещё нет — существующие тесты
-- (в том числе изменённые администратором) не перезаписываются и не дублируются.
-- Попытки и результаты не создаются.

do $$
declare
  v_quiz uuid;
begin

  -- claude-1: Знакомство с Claude: возможности и ограничения
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'claude-1', false where exists (select 1 from public.lessons where id = 'claude-1')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Почему важные ответы ИИ нужно проверять?', array['ИИ всегда отвечает неправильно', 'ИИ может уверенно ошибаться в фактах, цифрах и датах', 'Проверка нужна только для длинных ответов', 'Проверять нужно, только если ответ на английском'], 1),
      (v_quiz, 2, 'Что нужно, чтобы начать работать с Claude?', array['Уметь программировать', 'Знать специальные команды', 'Установить собственный сервер', 'Ясно описать задачу обычным языком'], 3),
      (v_quiz, 3, 'Какие данные не стоит отправлять в чат с ИИ?', array['Пароли и номера банковских карт', 'Вымышленный пример задачи', 'Черновик своего текста', 'Вопрос о планировании дня'], 0);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- claude-2: Как составить понятный запрос
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'claude-2', false where exists (select 1 from public.lessons where id = 'claude-2')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Что делает запрос понятнее?', array['Максимально короткая формулировка', 'Вежливые слова в начале', 'Контекст, задача, ограничения и формат ответа', 'Много восклицательных знаков'], 2),
      (v_quiz, 2, 'Что делать, если ответ не подошёл?', array['Повторить тот же запрос без изменений', 'Уточнить, что именно и как изменить', 'Сразу перейти в другой сервис', 'Ничего: ИИ не умеет исправлять ответы'], 1),
      (v_quiz, 3, 'Зачем просить ассистента сначала задать вам вопросы?', array['Чтобы он выяснил недостающие детали до ответа', 'Чтобы ответ пришёл быстрее', 'Это обязательное правило сервиса', 'Чтобы проверить ваши знания'], 0);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- claude-3: Создание и редактирование текстов
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'claude-3', false where exists (select 1 from public.lessons where id = 'claude-3')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Как получить текст, который отражает именно вашу мысль?', array['Попросить «напиши что-нибудь интересное»', 'Не указывать тему', 'Писать запрос только на английском', 'Дать свои тезисы, факты или черновик'], 3),
      (v_quiz, 2, 'Зачем просить объяснить внесённые правки?', array['Чтобы видеть изменения и учиться на них', 'Это ускоряет ответ', 'Без этого ИИ не исправит текст', 'Чтобы текст стал длиннее'], 0),
      (v_quiz, 3, 'Что обязательно проверить в итоговом тексте?', array['Только количество абзацев', 'Ничего, если текст звучит гладко', 'Цифры, даты, факты и обещания', 'Только длину заголовка'], 2);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- claude-4: Работа с предоставленными текстами и документами
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'claude-4', false where exists (select 1 from public.lessons where id = 'claude-4')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Как снизить риск, что ИИ добавит выдуманные сведения при пересказе?', array['Попросить писать быстрее', 'Попросить опираться только на текст и приводить цитаты', 'Отправить текст дважды', 'Не указывать, откуда взят текст'], 1),
      (v_quiz, 2, 'Что стоит сделать перед загрузкой рабочего документа?', array['Ничего: это всегда безопасно', 'Перевести его на английский', 'Убрать персональные и конфиденциальные данные', 'Сократить до одного абзаца'], 2),
      (v_quiz, 3, 'Заменяет ли пересказ ИИ чтение важного договора?', array['Нет: оригинал нужно прочитать, а при необходимости — проконсультироваться', 'Да, полностью', 'Да, если пересказ подробный', 'Только для договоров на русском языке'], 0);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- claude-5: Планирование и решение рабочих задач
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'claude-5', false where exists (select 1 from public.lessons where id = 'claude-5')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Что помогает получить реалистичный план?', array['Не сообщать сроки', 'Попросить «сделай идеальный план»', 'Указать только название задачи', 'Описать дедлайн, ресурсы и ограничения'], 3),
      (v_quiz, 2, 'Зачем просить ассистента перечислить допущения?', array['Чтобы план стал длиннее', 'Чтобы понять, что в плане проверить в первую очередь', 'Это ни на что не влияет', 'Чтобы ИИ больше никогда не ошибался'], 1),
      (v_quiz, 3, 'Кто принимает итоговое решение по плану?', array['ИИ-ассистент', 'Решение принимается автоматически', 'Человек, который отвечает за задачу', 'Тот, кто написал самый длинный запрос'], 2);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- claude-6: Итоговая практика: решение собственной задачи
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'claude-6', false where exists (select 1 from public.lessons where id = 'claude-6')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Какая задача лучше подходит для итоговой практики?', array['Как можно более расплывчатая', 'Небольшая, с понятным результатом и без чувствительных данных', 'Содержащая пароли для проверки', 'Любая, лишь бы длинная'], 1),
      (v_quiz, 2, 'Что входит в полный цикл работы с ИИ?', array['Только первый запрос', 'Копирование ответа без чтения', 'Повтор одного и того же запроса', 'Запрос, уточнения и проверка результата'], 3),
      (v_quiz, 3, 'Зачем сохранять удачный запрос?', array['Чтобы использовать его как шаблон для похожих задач', 'Это обязательно для оплаты курса', 'Чтобы ИИ запомнил его навсегда', 'Незачем'], 0);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- chatgpt-1: Знакомство с ChatGPT: возможности и ограничения
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'chatgpt-1', false where exists (select 1 from public.lessons where id = 'chatgpt-1')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Почему ChatGPT может ошибаться?', array['Он специально даёт неверные ответы', 'Он составляет вероятный ответ и не гарантирует точность', 'Он ошибается только в длинных текстах', 'Он никогда не ошибается'], 1),
      (v_quiz, 2, 'Что ассистент учитывает в рамках одного чата?', array['Предыдущие сообщения диалога', 'Только последнее слово', 'Ваши переписки в других приложениях', 'Ничего'], 0),
      (v_quiz, 3, 'Как поступить с ответом ИИ о здоровье или финансах?', array['Принять как окончательный', 'Переслать знакомым', 'Спросить ещё раз и выбрать понравившийся вариант', 'Проверить и обсудить со специалистом'], 3);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- chatgpt-2: Как составить запрос и уточнить ответ
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'chatgpt-2', false where exists (select 1 from public.lessons where id = 'chatgpt-2')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Что помогает получить ответ в нужном стиле?', array['Как можно больше лишних деталей', 'Запрос из одного слова', 'Пример текста, который вам нравится', 'Просьба ответить «как угодно»'], 2),
      (v_quiz, 2, 'Как удобнее уточнять ответ?', array['Менять сразу всё', 'Менять по одному параметру за раз', 'Не уточнять никогда', 'Копировать ответ в новый чат без изменений'], 1),
      (v_quiz, 3, 'Когда разумно начать новый чат?', array['Когда диалог ушёл не туда и задачу проще сформулировать заново', 'После каждого сообщения', 'Никогда', 'Только раз в день'], 0);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- chatgpt-3: Тексты, идеи и создание контента
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'chatgpt-3', false where exists (select 1 from public.lessons where id = 'chatgpt-3')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Как получить больше полезных идей?', array['Попросить одну идеальную идею', 'Не указывать тему', 'Ограничиться словом «идеи»', 'Попросить много разнообразных вариантов и выбрать лучшие'], 3),
      (v_quiz, 2, 'Что указать при адаптации текста под площадку?', array['Аудиторию, площадку и объём', 'Только цвет оформления', 'Ничего: ИИ угадает сам', 'Количество смайликов'], 0),
      (v_quiz, 3, 'Что важно сделать перед публикацией текста, созданного с ИИ?', array['Опубликовать сразу, не перечитывая', 'Проверить факты и соблюсти правила площадки', 'Удалить все абзацы, кроме первого', 'Ничего'], 1);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- chatgpt-4: Помощь в обучении и объяснение сложных тем
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'chatgpt-4', false where exists (select 1 from public.lessons where id = 'chatgpt-4')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Какой приём помогает лучше усвоить тему?', array['Скопировать готовый ответ', 'Читать только заголовки', 'Попросить ИИ проверить вас вопросами', 'Не задавать уточняющих вопросов'], 2),
      (v_quiz, 2, 'С чем стоит сверять объяснения ИИ?', array['С другим ответом в том же чате', 'С учебником, конспектом или надёжным источником', 'Ни с чем', 'С количеством слов в ответе'], 1),
      (v_quiz, 3, 'Как корректно использовать ИИ в учёбе?', array['Для понимания темы — с учётом правил учебного заведения', 'Сдавать сгенерированный текст как свой', 'Не читать ответы, а сразу их пересылать', 'Использовать только для списывания на тестах'], 0);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- chatgpt-5: Планирование и повседневные задачи
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'chatgpt-5', false where exists (select 1 from public.lessons where id = 'chatgpt-5')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Что сделает план полезнее?', array['Отсутствие деталей', 'Просьба «сделай как-нибудь»', 'Описание ограничений: время, бюджет, предпочтения', 'Только название задачи'], 2),
      (v_quiz, 2, 'Что нужно проверять в плане поездки, составленном ИИ?', array['Только орфографию', 'Ничего', 'Только длину ответа', 'Расписание, часы работы и правила — на официальных сайтах'], 3),
      (v_quiz, 3, 'Какая задача подходит для этого урока?', array['Чек-лист сборов в поездку', 'Отправка пароля в чат', 'Перевод денег по совету ИИ без проверки', 'Публикация чужих личных данных'], 0);
    update public.quizzes set published = true where id = v_quiz;
  end if;

  -- chatgpt-6: Итоговая практика: решение собственной задачи
  v_quiz := null;
  insert into public.quizzes (lesson_id, published)
  select 'chatgpt-6', false where exists (select 1 from public.lessons where id = 'chatgpt-6')
  on conflict (lesson_id) do nothing
  returning id into v_quiz;
  if v_quiz is not null then
    insert into public.quiz_questions (quiz_id, position, text, options, correct_index) values
      (v_quiz, 1, 'Что сделать до начала работы над итоговой задачей?', array['Придумать как можно более длинный запрос', 'Определить критерий успешного результата', 'Отказаться от проверки', 'Ничего'], 1),
      (v_quiz, 2, 'Зачем просить ассистента оценить свой же результат?', array['Чтобы ответ стал длиннее', 'Это запрещено', 'Чтобы найти слабые места и улучшить ответ', 'Чтобы закрыть чат'], 2),
      (v_quiz, 3, 'Чем завершается работа над задачей?', array['Копированием первого ответа', 'Удалением чата без чтения', 'Повтором запроса без изменений', 'Проверкой фактов и личной доработкой'], 3);
    update public.quizzes set published = true where id = v_quiz;
  end if;
end;
$$;
