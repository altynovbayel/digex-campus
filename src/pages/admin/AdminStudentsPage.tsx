import { PageHeader } from '../../components/PageHeader';
import { DEMO_MODE } from '../../config';
import { DemoStudentsTable } from '../../demo/DemoStudentsTable';
import { StudentsManager } from './StudentsManager';

export function AdminStudentsPage() {
  return (
    <>
      <PageHeader title="Ученики" subtitle="Подтверждение оплаты и общий доступ к курсу: оба раздела на 14 дней." />
      {DEMO_MODE ? <DemoStudentsTable /> : <StudentsManager />}
    </>
  );
}
