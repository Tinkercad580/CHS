import React, { useEffect, useRef } from "react";
import { Animated, Pressable, View, ScrollView, StyleSheet } from "react-native";
import { colors, radius } from "../theme";

interface Props {
  children: React.ReactNode;
  onDismissScrim?: () => void;
}

/** The bottom sheet used for the verdict card and the parcel-log form — slides up (`sheetUp`) over a dark scrim. */
export function BottomSheet({ children, onDismissScrim }: Props) {
  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View style={[styles.scrim, { opacity }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismissScrim} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
          {children}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5,16,13,0.72)",
    justifyContent: "flex-end",
    zIndex: 24,
  },
  sheet: {
    width: "100%",
    maxHeight: "92%",
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.sheetTop,
    borderTopRightRadius: radius.sheetTop,
    borderBottomLeftRadius: radius.sheetBottom,
    borderBottomRightRadius: radius.sheetBottom,
    paddingTop: 10,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.line,
    alignSelf: "center",
    marginBottom: 20,
  },
});
