import React, { type RefObject } from "react";
import { View } from "react-native";
import { colors } from "../../theme";
import { useGate } from "../../state/GateProvider";
import { heldParcelsCount } from "../../state/selectors";
import { GuardHeader } from "./GuardHeader";
import { TabBar } from "./TabBar";
import { shiftLine } from "../signin/shiftLine";
import { EntryScreen } from "../entry/EntryScreen";
import { ResultSheet } from "../entry/ResultSheet";
import { WalkinScreen } from "../walkin/WalkinScreen";
import { StaffScreen } from "../staff/StaffScreen";
import { LogScreen } from "../log/LogScreen";
import { ParcelsScreen } from "../parcels/ParcelsScreen";
import { ParcelSheet } from "../parcels/ParcelSheet";
import { MoreScreen } from "../more/MoreScreen";
import { AlertScreen } from "../alert/AlertScreen";
import { PlateLookupScreen } from "../plate/PlateLookupScreen";
import { HandoverScreen } from "../handover/HandoverScreen";
import { NoticesScreen } from "../notices/NoticesScreen";
import { NoticeScreen } from "../notices/NoticeScreen";
import { useNoticeArrivals } from "../notices/useOfficeNotices";
import { useGuard } from "../../api/guard";
import { useSocietyPhone } from "../../api/society";
import { ToastStack } from "../../components/ToastStack";
import { useHardwareBack } from "./useHardwareBack";

/**
 * Everything an on-duty guard sees: the guard header, the current screen, the
 * tab bar, and any open overlay. This whole tree is only ever mounted by
 * SessionGate for a signed-in guard whose handset is unlocked — see
 * ShiftScreen's header comment.
 *
 * The header's door icon locks the handset (back to the duty PIN); ending the
 * shift for real — `onSignOut` — lives at the foot of More and after a handover.
 * `seenNotices` belongs to SignedInHandset (see useNoticeArrivals).
 */
export function GateShell({ onSignOut, signingOut, seenNotices }: { onSignOut: () => void; signingOut: boolean; seenNotices: RefObject<Set<string> | null> }) {
  const { state, actions } = useGate();
  const { me, membership } = useGuard();
  const held = heldParcelsCount(state);
  const office = useNoticeArrivals(seenNotices);
  useHardwareBack(state, actions);
  // Warms the office number the alert screen offers, so it is there the moment it's needed.
  useSocietyPhone();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GuardHeader
        guardName={state.guardName ?? me.name}
        shiftLine={shiftLine(membership.societyName, state.shiftStartedAt)}
        onLock={actions.lock}
        onAlert={() => actions.go("alert", "Opened the alert screen")}
      />

      <View style={{ flex: 1 }}>
        {state.screen === "entry" ? <EntryScreen /> : null}
        {state.screen === "staff" ? <StaffScreen /> : null}
        {state.screen === "log" ? <LogScreen /> : null}
        {state.screen === "parcels" ? <ParcelsScreen /> : null}
        {state.screen === "more" ? <MoreScreen unreadNotices={office.unread} onSignOut={onSignOut} signingOut={signingOut} /> : null}
        {state.screen === "walkin" ? <WalkinScreen /> : null}
        {state.screen === "alert" ? <AlertScreen /> : null}
        {state.screen === "plate" ? <PlateLookupScreen /> : null}
        {state.screen === "handover" ? <HandoverScreen onSignOut={onSignOut} signingOut={signingOut} /> : null}
        {state.screen === "notices" ? <NoticesScreen /> : null}
        {state.screen === "notice" && state.noticeId ? <NoticeScreen noticeId={state.noticeId} /> : null}
      </View>

      <TabBar screen={state.screen} heldCount={held} moreCount={office.unread} onTab={(s) => actions.go(s, `Tapped ${s} tab`)} />

      {state.result ? <ResultSheet /> : null}
      {state.parcelOpen ? <ParcelSheet /> : null}
      <ToastStack toasts={state.toasts} onDismiss={actions.dismissToast} />
    </View>
  );
}
