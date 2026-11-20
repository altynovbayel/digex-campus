import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAdmin, RequireAuth } from './auth/guards';
import { LiveCabinetProvider } from './cabinet/LiveCabinetProvider';
import { DEMO_MODE } from './config';
import { DemoSessionProvider } from './demo/DemoSessionContext';
import { AdminLayout } from './layouts/AdminLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { AdminGroupsPage } from './pages/admin/AdminGroupsPage';
import { AdminResultsPage } from './pages/admin/AdminResultsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminStudentsPage } from './pages/admin/AdminStudentsPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/student/HomePage';
import { LearningPage } from './pages/student/LearningPage';
import { LessonPage } from './pages/student/LessonPage';
import { PaymentPage } from './pages/student/PaymentPage';
import { ProfilePage } from './pages/student/ProfilePage';

/** Кабинет ученика: настоящий пользователь или (только в режиме разработки) демо-ученик. */
function StudentArea() {
  if (DEMO_MODE) {
    return (
      <DemoSessionProvider>
        <StudentLayout />
      </DemoSessionProvider>
    );
  }
  return (
    <RequireAuth>
      <LiveCabinetProvider>
        <StudentLayout />
      </LiveCabinetProvider>
    </RequireAuth>
  );
}

/** Админка: только для роли admin. Данные дополнительно защищены RLS. */
function AdminArea() {
  if (DEMO_MODE) return <AdminLayout />;
  return (
    <RequireAuth>
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    </RequireAuth>
  );
}

function Guest() {
  return (
    <GuestOnly>
      <Outlet />
    </GuestOnly>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Guest />}>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<StudentArea />}>
        <Route index element={<HomePage />} />
        <Route path="learning" element={<LearningPage />} />
        <Route path="learning/:lessonId" element={<LessonPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="payment" element={<PaymentPage />} />
      </Route>

      <Route path="admin" element={<AdminArea />}>
        <Route index element={<Navigate to="groups" replace />} />
        <Route path="groups" element={<AdminGroupsPage />} />
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="results" element={<AdminResultsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
