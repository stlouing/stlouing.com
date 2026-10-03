import 'maplibre-gl/dist/maplibre-gl.css'
import maplibregl from 'maplibre-gl'
import type { MapOptions, StyleSpecification } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { layers, namedFlavor } from '@protomaps/basemaps'

let protocolRegistered = false
function registerPmtilesProtocol(): void {
  if (protocolRegistered) {
    return
  }
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile)
  protocolRegistered = true
}

const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const protomapsAttribution = `<a href="https://protomaps.com">Protomaps</a> ${osmAttribution}`

const localPmtilesUrl = `${import.meta.env.BASE_URL}stl.pmtiles`
const protomapsTilesUrl = import.meta.env.PUBLIC_PMTILES_URL || localPmtilesUrl

const glyphsUrl = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf'
const spriteUrl = (dark: boolean) =>
  `https://protomaps.github.io/basemaps-assets/sprites/v4/${dark ? 'dark' : 'light'}`

function isDarkTheme(): boolean {
  return document.documentElement.dataset.theme === 'dark'
}

export function buildBasemapStyle(dark = isDarkTheme()): StyleSpecification {
  return {
    version: 8,
    glyphs: glyphsUrl,
    sprite: spriteUrl(dark),
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${protomapsTilesUrl}`,
        attribution: protomapsAttribution,
      },
    },
    layers: layers('protomaps', namedFlavor(dark ? 'dark' : 'light'), { lang: 'en' }),
  }
}

export function createBasemapMap(
  container: HTMLElement,
  options: Partial<MapOptions> = {},
): maplibregl.Map {
  registerPmtilesProtocol()

  const map = new maplibregl.Map({
    container,
    style: buildBasemapStyle(),
    center: [-90.2, 38.627],
    zoom: 11,
    dragRotate: false,
    pitchWithRotate: false,
    attributionControl: { compact: false },
    ...options,
  })

  map.touchZoomRotate.disableRotation()

  return map
}

export function watchThemeChanges(
  map: maplibregl.Map,
  onThemeSwapped?: (dark: boolean) => void,
): () => void {
  let dark = isDarkTheme()

  const observer = new MutationObserver(() => {
    const next = isDarkTheme()
    if (next === dark) {
      return
    }

    dark = next
    if (onThemeSwapped) {
      map.once('styledata', () => onThemeSwapped(dark))
    }
    map.setStyle(buildBasemapStyle(next), {
      transformStyle: (previous, nextStyle) => {
        if (!previous) {
          return nextStyle
        }
        const baseSourceIds = new Set(Object.keys(nextStyle.sources))
        const carriedSources = Object.fromEntries(
          Object.entries(previous.sources).filter(([id]) => !baseSourceIds.has(id)),
        )
        const baseLayerIds = new Set(nextStyle.layers.map((layer) => layer.id))
        const carriedLayers = previous.layers.filter((layer) => !baseLayerIds.has(layer.id))

        return {
          ...nextStyle,
          sources: { ...nextStyle.sources, ...carriedSources },
          layers: [...nextStyle.layers, ...carriedLayers],
        }
      },
    })
  })

  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  return () => observer.disconnect()
}
