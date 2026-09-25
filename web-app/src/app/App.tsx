import { Fragment, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { ApiProvider } from "@chs/api-client/react";
import { apiClient, queryClient, realtime, session } from "../api/client";
import { ThemeProvider } from "./ThemeProvider";
import { SessionGate } from "./SessionGate";
import { AdminStoreProvider } from "../store/AdminStore";
import { AdminLayout } from "../layouts/AdminLayout";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { FlowsPage } from "../features/flows/FlowsPage";
import { BillingPage } from "../features/billing/BillingPage";
import { HelpdeskPage } from "../features/helpdesk/HelpdeskPage";
import { CompliancePage } from "../features/compliance/CompliancePage";
import { StaffPage } from "../features/staff/StaffPage";
import { AmenitiesPage } from "../features/amenities/AmenitiesPage";
import { GenericPage } from "../features/generic/GenericPage";
import { RecordPage } from "../features/record/RecordPage";
import { UsersPage } from "../features/users/UsersPage";
import { UserRecordPage } from "../features/users/UserRecordPage";
import { MembersPage } from "../features/members/MembersPage";
import { UnitRecordPage } from "../features/members/UnitRecordPage";
import { RunPage } from "../features/billing/RunPage";
import { BillsPage } from "../features/billing/BillsPage";
import { BillRecordPage } from "../features/billing/BillRecordPage";
import { ChargeHeadsPage } from "../features/billing/ChargeHeadsPage";
import { LedgerPage } from "../features/billing/LedgerPage";
import { PaymentsPage } from "../features/payments/PaymentsPage";
import { PaymentRecordPage } from "../features/payments/PaymentRecordPage";
import { NoticesPage } from "../features/notices/NoticesPage";
import { NoticeRecordPage } from "../features/notices/NoticeRecordPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { ApprovalsPage } from "../features/members/ApprovalsPage";
import { SetupPage } from "../features/setup/SetupPage";
import { AuditLogPage } from "../features/audit/AuditLogPage";
import { NotFoundPage } from "../features/generic/NotFoundPage";

/**
 * Route map. Everything sits behind the session gate: nothing inside the
 * shell renders without a signed-in admin.
 *
 * Most screens read the API and have their own routes: dashboard, Members &
 * units (with the approvals queue), Users & access, Society setup, Billing,
 * Payments, Notices, Reports and the audit log. The screens with no API yet
 * are of two kinds: bespoke fixtures (flows, helpdesk, compliance, staff,
 * amenities) and the generic table pages in MOCK_PAGES, which share
 * GenericPage + RecordPage and are listed last. Any other address is the
 * Not found page.
 */
export function App() {
  return (
    <ThemeProvider>
      <ApiProvider client={apiClient} session={session} realtime={realtime} queryClient={queryClient}>
        <AdminStoreProvider>
          <SessionGate>
            <BrowserRouter>
              <Routes>
                <Route element={<AdminLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="flows" element={<FlowsPage />} />
                  <Route path="billing" element={<BillingPage />} />
                  <Route path="billing/runs/:runId" element={<Keyed param="runId" render={(id) => <RunPage runId={id} />} />} />
                  <Route path="billing/bills" element={<BillsPage />} />
                  <Route path="billing/bills/:billId" element={<Keyed param="billId" render={(id) => <BillRecordPage billId={id} />} />} />
                  <Route path="billing/heads" element={<ChargeHeadsPage />} />
                  <Route path="billing/ledger/:unitId" element={<Keyed param="unitId" render={(id) => <LedgerPage unitId={id} />} />} />
                  <Route path="payments" element={<PaymentsPage />} />
                  <Route path="payments/record/:paymentId" element={<Keyed param="paymentId" render={(id) => <PaymentRecordPage paymentId={id} />} />} />
                  <Route path="notices" element={<NoticesPage />} />
                  <Route path="notices/record/:noticeId" element={<Keyed param="noticeId" render={(id) => <NoticeRecordPage noticeId={id} />} />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="reports/:slug" element={<Keyed param="slug" render={(slug) => <ReportsPage slug={slug} />} />} />
                  <Route path="helpdesk" element={<HelpdeskPage />} />
                  <Route path="compliance" element={<CompliancePage />} />
                  <Route path="staff" element={<StaffPage />} />
                  <Route path="amenities" element={<AmenitiesPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="users/record/:userId" element={<UserRecordRoute />} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="members/approvals" element={<ApprovalsPage />} />
                  <Route path="members/record/:unitId" element={<UnitRecordRoute />} />
                  <Route path="setup" element={<SetupPage />} />
                  <Route path="setup/:tab" element={<Keyed param="tab" render={(tab) => <SetupPage tab={tab} />} />} />
                  <Route path="audit" element={<AuditLogPage />} />
                  <Route path=":pageKey/record/:rowKey" element={<RecordRoute />} />
                  <Route path=":pageKey" element={<GenericRoute />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SessionGate>
        </AdminStoreProvider>
      </ApiProvider>
    </ThemeProvider>
  );
}

/**
 * The generic table screens still on fixtures (mock/pages.ts). The fixtures
 * also carry entries for screens that now read the API; those are not
 * reachable through the generic routes, so an old address shows Not found
 * rather than stale sample rows.
 */
const MOCK_PAGES = new Set(["accounting", "recovery", "gate", "vendors", "meetings", "documents", "requests"]);

/** Keyed by pageKey so navigating between screens remounts the generic page
 * and resets its search/filter/sort/page state (README, "Changing screens
 * resets search, chip, sort and page"). */
function GenericRoute() {
  const { pageKey = "" } = useParams();
  if (!MOCK_PAGES.has(pageKey)) return <NotFoundPage />;
  return <GenericPage key={pageKey} />;
}

/** Keyed by pageKey+rowKey so navigating between records resets any open
 * edit form or quick modal. */
function RecordRoute() {
  const { pageKey = "", rowKey } = useParams();
  if (!MOCK_PAGES.has(pageKey)) return <NotFoundPage />;
  return <RecordPage key={`${pageKey}/${rowKey}`} />;
}

/** Keyed by id so moving between records resets open modals and one-time secrets. */
function UserRecordRoute() {
  const { userId = "" } = useParams();
  return <UserRecordPage key={userId} userId={userId} />;
}

function UnitRecordRoute() {
  const { unitId = "" } = useParams();
  return <UnitRecordPage key={unitId} unitId={unitId} />;
}

/** A record route keyed by its id, so moving from one record to the next resets its modals and forms. */
function Keyed({ param, render }: { param: string; render: (id: string) => ReactNode }) {
  const id = useParams()[param] ?? "";
  return <Fragment key={id}>{render(id)}</Fragment>;
}
