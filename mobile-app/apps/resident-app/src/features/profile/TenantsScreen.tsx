import React from "react";
import { View } from "react-native";
import { formatInr, FOCUS_UNIT_LET_OUT } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { iconPaths } from "../../components/iconPaths";
import { StaggerItem } from "../../components/StaggerItem";

export function TenantsScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();
  const isLandlord = state.role === "owner_tenant";

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("myTenantsTitle")} onBack={actions.back} />
      <ScreenScroll>
        {!isLandlord ? (
          <EmptyState iconPath={iconPaths.tenants} title={t("noTenanciesTitle")} body={t("noTenanciesBody")} />
        ) : (
          <>
            <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
              {t("oneAgreementLive", { unit: FOCUS_UNIT_LET_OUT })}
            </AppText>
            <View style={{ gap: 11, marginBottom: 18 }}>
              {state.tenantAgreements.map((agreement, i) => {
                const active = new Date(agreement.endDate) > new Date();
                const edge = active ? colors.ok : colors.borderStrong;
                return (
                  <StaggerItem key={agreement.tenantName + i} index={i} tier="listRow">
                    <View style={{ borderWidth: 1, borderColor: active ? colors.accent200 : colors.border, borderLeftWidth: 3, borderLeftColor: edge, borderRadius: 16, backgroundColor: colors.surface, padding: 16 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <AppText variant="cardTitle" style={{ fontSize: 15, marginBottom: 3 }}>
                            {agreement.tenantName}
                          </AppText>
                          <AppText variant="bodySmall" color={colors.inkSoft}>
                            {agreement.unit} · {formatInr(agreement.monthlyRent)} a month
                          </AppText>
                        </View>
                        <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: active ? colors.okWash : colors.subtle }}>
                          <AppText variant="cardTitle" color={active ? colors.okInk : colors.inkSoft} style={{ fontSize: 11 }}>
                            {active ? t("activeStatus") : t("endedStatus")}
                          </AppText>
                        </View>
                      </View>
                      <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 12, gap: 7 }}>
                        <DetailRow label={t("agreementFrom")} value={new Date(agreement.startDate).toLocaleDateString("en-IN")} />
                        <DetailRow label={t("expiresLabel")} value={new Date(agreement.endDate).toLocaleDateString("en-IN")} highlight={active} />
                        <DetailRow label={t("policeVerification")} value={agreement.policeVerified ? "Verified" : "Pending"} good={agreement.policeVerified} />
                        <DetailRow label={t("nonOccupancyChargeLabel")} value={t("perMonthAmount", { amount: agreement.nonOccupancyCharge })} />
                      </View>
                      {active ? (
                        <Button
                          label={state.renewed ? t("renewalSent") : t("startRenewal")}
                          kind="secondary"
                          onPress={actions.startRenewal}
                          height={44}
                          fontSize={13.5}
                          weight={600}
                          style={{ marginTop: 13 }}
                        />
                      ) : null}
                    </View>
                  </StaggerItem>
                );
              })}
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
        )}
      </ScreenScroll>
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
      <AppText variant="cardTitle" color={fg} style={{ fontSize: 12.5 }} forceLatin>
        {value}
      </AppText>
    </View>
  );
}
