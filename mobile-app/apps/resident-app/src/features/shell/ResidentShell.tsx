import React, { useEffect, useRef } from "react";
import { BackHandler, Platform, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { TabBar } from "./TabBar";
import { ToastStack } from "../../components/ToastStack";
import { HomeScreen } from "../home/HomeScreen";
import { DuesScreen } from "../dues/DuesScreen";
import { BillDetailScreen } from "../dues/BillDetailScreen";
import { NoticesScreen } from "../notices/NoticesScreen";
import { NoticeDetailScreen } from "../notices/NoticeDetailScreen";
import { VisitorsScreen } from "../visitors/VisitorsScreen";
import { InviteScreen } from "../invite/InviteScreen";
import { PassDoneScreen } from "../invite/PassDoneScreen";
import { HelpdeskScreen } from "../helpdesk/HelpdeskScreen";
import { NewTicketScreen } from "../helpdesk/NewTicketScreen";
import { TicketDetailScreen } from "../helpdesk/TicketDetailScreen";
import { ProfileScreen } from "../profile/ProfileScreen";
import { PersonalDetailsScreen } from "../profile/PersonalDetailsScreen";
import { HouseholdScreen } from "../profile/HouseholdScreen";
import { VehiclesScreen } from "../profile/VehiclesScreen";
import { NotificationsScreen } from "../profile/NotificationsScreen";
import { NotifsFeedScreen } from "../profile/NotifsFeedScreen";
import { LanguageScreen } from "../profile/LanguageScreen";
import { DeliveriesScreen } from "../profile/DeliveriesScreen";
import { DailyHelpScreen } from "../profile/DailyHelpScreen";
import { AmenitiesScreen } from "../profile/AmenitiesScreen";
import { BookScreen } from "../profile/BookScreen";
import { StatementScreen } from "../profile/StatementScreen";
import { TenantsScreen } from "../profile/TenantsScreen";
import { EmergencyScreen } from "../profile/EmergencyScreen";
import { BuildingStatusScreen } from "../profile/BuildingStatusScreen";
import { PollsScreen } from "../profile/PollsScreen";
import { PollDetailScreen } from "../profile/PollDetailScreen";
import { PaymentSheets } from "../payment/PaymentSheets";
import { usePushRouting } from "../../push/bridge";

const TAB_SCREENS = new Set(["home", "dues", "notices", "visitors", "profile", "helpdesk"]);

/**
 * Everything the resident sees once past the splash: the current screen, the tab
 * bar, and any open payment sheet. It also owns push routing — a tapped
 * notification switches the screen here like any other navigation — and
 * Android's back button.
 */
export function ResidentShell() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  usePushRouting();
  useHardwareBack();

  // Home's header is accent-green with white ink, so the status icons read light there
  // regardless of the app's own light/dark theme; every other screen follows the theme.
  const statusStyle = state.screen === "home" ? "light" : state.dark ? "light" : "dark";

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar style={statusStyle} />
      <View style={{ flex: 1 }}>
        {state.screen === "home" ? <HomeScreen /> : null}
        {state.screen === "dues" ? <DuesScreen /> : null}
        {state.screen === "bill" ? <BillDetailScreen /> : null}
        {state.screen === "notices" ? <NoticesScreen /> : null}
        {state.screen === "notice" ? <NoticeDetailScreen /> : null}
        {state.screen === "visitors" ? <VisitorsScreen /> : null}
        {state.screen === "invite" ? <InviteScreen /> : null}
        {state.screen === "passDone" ? <PassDoneScreen /> : null}
        {state.screen === "helpdesk" ? <HelpdeskScreen /> : null}
        {state.screen === "newTicket" ? <NewTicketScreen /> : null}
        {state.screen === "ticket" ? <TicketDetailScreen /> : null}
        {state.screen === "profile" ? <ProfileScreen /> : null}
        {state.screen === "personal" ? <PersonalDetailsScreen /> : null}
        {state.screen === "household" ? <HouseholdScreen /> : null}
        {state.screen === "vehicles" ? <VehiclesScreen /> : null}
        {state.screen === "notifPrefs" ? <NotificationsScreen /> : null}
        {state.screen === "notifs" ? <NotifsFeedScreen /> : null}
        {state.screen === "language" ? <LanguageScreen /> : null}
        {state.screen === "deliveries" ? <DeliveriesScreen /> : null}
        {state.screen === "dailyHelp" ? <DailyHelpScreen /> : null}
        {state.screen === "amenities" ? <AmenitiesScreen /> : null}
        {state.screen === "book" ? <BookScreen /> : null}
        {state.screen === "statement" ? <StatementScreen /> : null}
        {state.screen === "tenants" ? <TenantsScreen /> : null}
        {state.screen === "sos" ? <EmergencyScreen /> : null}
        {state.screen === "utilities" ? <BuildingStatusScreen /> : null}
        {state.screen === "polls" ? <PollsScreen /> : null}
        {state.screen === "poll" ? <PollDetailScreen /> : null}
      </View>

      {TAB_SCREENS.has(state.screen) ? <TabBar screen={state.screen} onTab={(s) => actions.go(s)} /> : null}

      <PaymentSheets />
      <ToastStack toasts={state.toasts} />
    </View>
  );
}

/**
 * Android's back button walks the app's own navigation, since there is one
 * route and expo-router has no history to pop: back through `stack`, then from
 * any other screen to Home, and only from Home out of the app. An open payment
 * sheet is a `Modal`, which takes the press itself (BottomSheet onRequestClose).
 */
function useHardwareBack() {
  const { state, actions } = useResident();
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const s = latest.current;
      if (s.sheet) {
        actions.closeSheet();
        return true;
      }
      if (s.stack.length > 0) {
        actions.back();
        return true;
      }
      if (s.screen !== "home") {
        actions.go("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [actions]);
}
