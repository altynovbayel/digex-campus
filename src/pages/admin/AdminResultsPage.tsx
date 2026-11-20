import { PageHeader } from '../../components/PageHeader';
import { ResultsTable } from '../../components/ResultsTable';
import { DEMO_MODE } from '../../config';
import { demoResults } from '../../demo/people';
import { ResultsManager } from './ResultsManager';

export function AdminResultsPage() {
  return (
    <>
      <PageHeader title="Результаты" subtitle="Результаты тестов учеников. Баллы считает база при отправке." />
      {DEMO_MODE ? (
        <section className="card" aria-label="Результаты тестов">
          <ResultsTable rows={demoResults} caption="Результаты тестов учеников" showStudent emptyText="Результатов пока нет." />
        </section>
      ) : (
        <ResultsManager />
      )}
    </>
  );
}
