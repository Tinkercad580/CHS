import React from "react";
import { View } from "react-native";
import type { Tenancy } from "@chs/contract";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { landlordUnits, shortDate, useResidentAccount } from "../../api/identity";
import { formatPaise } from "../../api/billing";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { LoadError } from "../../components/LoadError";
import { Skeleton } from "../../components/Skeleton";
import { iconPaths } from "../../components/iconPaths";
import { RevealItem } from "../../components/RevealItem";

/** Tenancies on flats the resident owns and has let out — the active agreement and the ones that ended (myHome → activeTenancy, pastTenancies). */
export function TenantsScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const { me, home } = useResidentAccount();

  let body: React.ReactNode;
  if (home.status === "loading") {
    body = (
      <>
        <View style={{ height: 19.5, width: "70%", marginBottom: 16 }}>
          <Skeleton height={14} radius={7} />
        </View>
        <View style={{ gap: 11 }}>
          <Skeleton height={236} radius={16} />
          <Skeleton height={176} radius={16} />
        </View>
      </>
    );
  } else if (home.status === "error") {
    body = <LoadError title="Couldn't load your tenancies" message={home.message} onRetry={home.retry} />;
  } else {
    const units = landlordUnits(me, home.data);
    const agreements = units.flatMap((u) => [...(u.activeTenancy ? [u.activeTenancy] : []), ...u.pastTenancies].map((tenancy) => ({ tenancy, unitLabel: u.unit.label })));
    const live = units.filter((u) => u.activeTenancy).map((u) => u.unit.label);
    body =
      agreements.length === 0 ? (
        <EmptyState iconPath={iconPaths.tenants} title={t("noTenanciesTitle")} body={t("noTenanciesBody")} />
      ) : (
        <>
          <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
            {live.length === 1 ? t("oneAgreementLive", { unit: live[0] }) : live.length === 0 ? "None of your flats is let out right now." : `You let out ${live.join(" and ")}.`}
          </AppText>
          <View style={{ gap: 11, marginBottom: 18 }}>
            {agreements.map(({ tenancy, unitLabel }) => (
              <RevealItem key={tenancy.id} tier="listRow">
                <AgreementCard tenancy={tenancy} unitLabel={unitLabel} renewed={state.renewed} onRenew={actions.startRenewal} />
              </RevealItem>
            ))}
          </View>
          <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong, borderRadius: 15, backgroundColor: colors.surface, padding: 18, alignItems: "center" }}>
            <AppText variant="cardTitle" style={{ fontSize: 13.5, marginBottom: 5, textAlign: "center" }}>
              {t("registeringNewTenant")}
            </AppText>
            <AppText variant="bodySmall" color={colors.inkSoft} style={{ textAlign: "center" }}>
              {t("registeringNewTenantBody")}
            </AppText>
          </View>
        </>
      );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("myTenantsTitle")} onBack={actions.back} />
      <ScreenScroll>{body}</ScreenScroll>
    </View>
  );
}

function AgreementCard({ tenancy, unitLabel, renewed, onRenew }: { tenancy: Tenancy; unitLabel: string; renewed: boolean; onRenew: () => void }) {
  const { colors } = useTheme();
  const { t } = useT();
  const active = tenancy.active;
  const rent = tenancy.monthlyRentPaise !== null ? `${formatPaise(tenancy.monthlyRentPaise)} a month` : "Rent not recorded";
  return (
    <View style={{ borderWidth: 1, borderColor: active ? colors.accent200 : colors.border, borderLeftWidth: 3, borderLeftColor: active ? colors.ok : colors.borderStrong, borderRadius: 16, backgroundColor: colors.surface, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="cardTitle" style={{ fontSize: 15, marginBottom: 3 }}>
            {tenancy.tenant.name}
          </AppText>
          <AppText variant="bodySmall" color={colors.inkSoft}>
            {unitLabel} · {rent}
          </AppText>
        </View>
        <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: active ? colors.okWash : colors.subtle }}>
          <AppText variant="cardTitle" color={active ? colors.okInk : colors.inkSoft} style={{ fontSize: 11 }}>
            {active ? t("activeStatus") : t("endedStatus")}
          </AppText>
        </View>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 12, gap: 7 }}>
        <DetailRow label={t("agreementFrom")} value={shortDate(tenancy.startDate)} />
        {active ? <DetailRow label={t("expiresLabel")} value={shortDate(tenancy.endDate)} highlight /> : <DetailRow label="Ended" value={shortDate(tenancy.endedOn ?? tenancy.endDate)} />}
        {/* The API records the police intimation reference, not a verified/unverified flag — show what is on file. */}
        <DetailRow label="Police intimation" value={tenancy.policeIntimationRef ?? "Not filed"} good={tenancy.policeIntimationRef !== null} />
        {tenancy.depositPaise !== null ? <DetailRow label="Deposit" value={formatPaise(tenancy.depositPaise)} /> : null}
        <DetailRow label="Society bills paid by" value={tenancy.billPayer === "TENANT" ? "Tenant" : "Owner"} />
      </View>
      {active ? (
        <Button label={renewed ? "Renewal noted on this phone" : t("startRenewal")} kind="secondary" onPress={onRenew} height={44} fontSize={13.5} weight={600} style={{ marginTop: 13 }} />
      ) : null}
    </View>
  );
}

function DetailRow({ label, value, highlight, good }: { label: string; value: string; highlight?: boolean; good?: boolean }) {
  const { colors } = useTheme();
  const fg = good === false ? colors.badInk : good ? colors.okInk : highlight ? colors.warnInk : colors.ink;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <AppText variant="bodySmall" color={colors.inkSoft}>
        {label}
      </AppText>
      <AppText variant="cardTitle" color={fg} style={{ fontSize: 12.5, flexShrink: 1, textAlign: "right" }} forceLatin>
        {value}
      </AppText>
    </View>
  );
}
