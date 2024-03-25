<template>
  <div class="w-lvw h-lvh">
    <l-map
      ref="mapRef"
      :zoom="mapLayer.zoom"
      :center="mapLayer.center"
      :max-bounds="mapLayer.maxBounds"
    >
      <!-- OpenStreetMap Layer -->
      <l-tile-layer
        :url="tileLayer.url"
        :min-zoom="tileLayer.minZoom"
        :max-zoom="tileLayer.maxZoom"
        :attribution="tileLayer.attribution"
        layer-type="base"
        name="OpenStreetMap"
      ></l-tile-layer>
    </l-map>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import "leaflet/dist/leaflet.css";
import { LMap, LTileLayer } from "@vue-leaflet/vue-leaflet";

// Define reactive data properties
const mapRef = ref(null);

// Define OpenStreetMap layer configuration
const mapLayer = ref({
  zoom: 7,
  center: [52.056716, 19.628512],
  maxBounds: [
    [54.536051, 13.511244],
    [48.755507, 24.401895],
  ],
});
const tileLayer = ref({
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  minZoom: 7,
  maxZoom: 22,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Data from <a target="_blank" href="https://meshtastic.org/docs/software/integrations/mqtt/">Meshtastic</a>',
});
</script>

<style scoped>
/* You can add component-specific styles here */
</style>
