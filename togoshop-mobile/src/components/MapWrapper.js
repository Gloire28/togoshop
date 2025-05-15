import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import PropTypes from "prop-types";

let MapView, Marker;

const isWeb =
  typeof window !== "undefined" && typeof window.document !== "undefined";

if (isWeb) {
  MapView = ({ children, style, testID, initialRegion, onPress }) => {
    // Logique Leaflet
  };
  Marker = () => null;
} else {
  // Logique react-native-maps
}
