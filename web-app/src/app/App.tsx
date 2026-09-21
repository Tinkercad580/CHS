import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { ThemeProvider } from "./ThemeProvider";
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

/**
 * Route map. The 13 generic-table screens (members, users, setup, payments,
 * accounting, recovery, gate, vendors, notices, meetings, documents,
 * requests, reports) share GenericPage + RecordPage; dashboard, flows,
 * billing, helpdesk, compliance, staff and amenities are the screens the
 * README calls out as sitting outside the generic template.
 */
export function App() {
  return (
    <ThemeProvider>
      <AdminStoreProvider>
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
              <Route path=":pageKey/record/:rowKey" element={<RecordRoute />} />
              <Route path=":pageKey" element={<GenericRoute />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AdminStoreProvider>
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
