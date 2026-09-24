import React from "react";
import { View } from "react-native";
import type { Language } from "@sahaj/shared";
import { useResident } from "../../state/ResidentProvider";
import { useTheme } from "../../hooks/useTheme";
import { useT } from "../../hooks/useT";
import { ScreenScroll } from "../../components/ScreenScroll";
import { ScreenHeader } from "../../components/ScreenHeader";
import { AppText } from "../../components/AppText";
import { RadioRow } from "../../components/FilterPill";
import { RevealItem } from "../../components/RevealItem";

const LANGUAGES: { key: Language; label: string; native: string }[] = [
  { key: "en", label: "English", native: "Default across the app" },
  { key: "mr", label: "Marathi", native: "मराठी" },
  { key: "hi", label: "Hindi", native: "हिंदी" },
];

export function LanguageScreen() {
  const { state, actions } = useResident();
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenHeader title={t("languageTitle")} onBack={actions.back} />
      <ScreenScroll>
        <AppText variant="bodySmall" color={colors.inkSoft} style={{ marginBottom: 16 }}>
          {t("languageIntro")}
        </AppText>
        <View style={{ gap: 9 }}>
          {LANGUAGES.map((lang, i) => (
            <RevealItem key={lang.key} tier="prefRow">
              <RadioRow label={lang.label} detail={lang.native} active={state.language === lang.key} onPress={() => actions.setLanguage(lang.key)} />
            </RevealItem>
          ))}
        </View>
      </ScreenScroll>
    </View>
  );
}
