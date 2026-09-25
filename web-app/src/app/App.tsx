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

/**
 * Route map. The 13 generic-table screens (members, users, setup, payments,
 * accounting, recovery, gate, vendors, notices, meetings, documents,
 * requests, reports) share GenericPage + RecordPage; dashboard, flows,
 * billing, helpdesk, compliance, staff and amenities are the screens the
 * README calls out as sitting outside the generic template.
 *
 * Users & access and Members & units read the API, so they have their own
 * routes ahead of the generic ones; they render with the same table and
 * record components, so they look no different. Everything sits behind the
 * session gate: nothing inside the shell renders without a signed-in admin.
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
                  <Route path="helpdesk" element={<HelpdeskPage />} />
                  <Route path="compliance" element={<CompliancePage />} />
                  <Route path="staff" element={<StaffPage />} />
                  <Route path="amenities" element={<AmenitiesPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="users/record/:userId" element={<UserRecordRoute />} />
                  <Route path="members" element={<MembersPage />} />
                  <Route path="members/record/:unitId" element={<UnitRecordRoute />} />
                  <Route path=":pageKey/record/:rowKey" element={<RecordRoute />} />
                  <Route path=":pageKey" element={<GenericRoute />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SessionGate>
        </AdminStoreProvider>
      </ApiProvider>
    </ThemeProvider>
  );
}

/** Keyed by pageKey so navigating between screens remounts the generic page
 * and resets its search/filter/sort/page state (README, "Changing screens
 * resets search, chip, sort and page"). */
function GenericRoute() {
  const { pageKey } = useParams();
  return <GenericPage key={pageKey} />;
}

/** Keyed by pageKey+rowKey so navigating between records resets any open
 * edit form or quick modal. */
function RecordRoute() {
  const { pageKey, rowKey } = useParams();
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
