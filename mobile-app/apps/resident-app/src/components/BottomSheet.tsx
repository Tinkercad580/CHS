import React from "react";
import { Modal, View, Pressable } from "react-native";
import { useTheme } from "../hooks/useTheme";

/**
 * The rounded bottom sheet used for Pay/QR/App (`sheetUp` in the design). Only
 * the Pay and "choose an app" sheets close on a backdrop tap in the prototype —
 * QR and the success takeover deliberately don't, so `onBackdropPress` is optional.
 */
export function BottomSheet({ visible, onBackdropPress, children, fullScreen }: { visible: boolean; onBackdropPress?: () => void; children: React.ReactNode; fullScreen?: boolean }) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent={!fullScreen} animationType="slide" statusBarTranslucent>
      {fullScreen ? (
        <View style={{ flex: 1, backgroundColor: colors.surface }}>{children}</View>
      ) : (
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(9,14,13,0.55)" }}>
          <Pressable style={{ position: "absolute", inset: 0 }} onPress={onBackdropPress} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderBottomLeftRadius: 0, paddingTop: 10, paddingHorizontal: 22, paddingBottom: 30, maxHeight: "90%" }}>
            <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 16 }} />
            {children}
          </View>
        </View>
      )}
    </Modal>
  );
}
