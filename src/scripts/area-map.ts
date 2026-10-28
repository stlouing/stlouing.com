import type { Map as MapLibreMap } from 'maplibre-gl'
import { createBasemapMap, watchThemeChanges } from './basemap'
import {
  boundaryFor,
  neighborhoodFeatures,
  officialPartsFor,
  type BoundaryFeature,
} from './boundaries'
import {
  applyColoredAreas,
  applyDashedPieces,
  applyOutlinedArea,
  coloredAreasFor,
  featureBounds,
  readMapColor,
  type ColoredArea,
} from './boundary-layers'
import { observeMapElements, readPayload, type MountedMap } from './map-shared'
import type { AreaMapArea } from '../lib/area-maps'

const REGIONS_PREFIX = 'area-regions'
const DISTRICT_PREFIX = 'area-district'
const PIECES_PREFIX = 'area-pieces'
const DISTRICT_FRAME_ZOOM_OUT = 1.25
const AREA_FRAME_ZOOM_OUT = 0.25
const CITY_FRAME_PADDING = 16
const CITY_FRAME_BOUNDS: [[number, number], [number, number]] = [
  [-90.375, 38.537],
  [-90.145, 38.662],
]

interface AreaShape {
  name: string
  token: string
  boundary: BoundaryFeature
}

interface AreaPieces {
  token: string
  pieces: BoundaryFeature[]
  labeled: boolean
}

interface AreaGeometry {
  regions: ColoredArea[]
  districts: AreaShape[]
  grouped: AreaPieces[]
  framed: BoundaryFeature[]
  cityView: boolean
  labelPlacement: 'line' | 'point'
}

async function geometryFor(areas: AreaMapArea[]): Promise<AreaGeometry> {
  const geometry: AreaGeometry = {
    regions: [],
    districts: [],
    grouped: [],
    framed: [],
    cityView: false,
    labelPlacement: 'point',
  }

  for (const area of areas) {
    if (area.kind === 'city') {
      const regionByNumber = new Map((area.regions ?? []).map((region) => [region.number, region]))
      for (const feature of await neighborhoodFeatures()) {
        const region = regionByNumber.get(Number(feature.properties?.NHD_NUM))
        if (region) {
          geometry.regions.push({ name: region.name ?? '', token: region.token, boundary: feature })
        }
      }
      for (const region of area.regions ?? []) {
        if (region.slug) {
          geometry.grouped.push({
            token: region.token,
            pieces: await officialPartsFor(region.slug),
            labeled: false,
          })
        }
      }
      for (const district of area.districts ?? []) {
        geometry.districts.push({
          name: district.name,
          token: area.token,
          boundary: district.boundary,
        })
      }
      geometry.cityView = true
      continue
    }

    if (area.kind === 'district') {
      geometry.labelPlacement = 'line'
      geometry.regions.push(...(await coloredAreasFor(area.parts ?? [])))
      if (area.district) {
        geometry.districts.push({ name: area.name, token: area.token, boundary: area.district })
        geometry.framed.push(area.district)
      }
      continue
    }

    const boundary = await boundaryFor(area.slug)
    if (!boundary) {
      continue
    }
    geometry.regions.push({
      name: area.kind === 'grouped' ? '' : area.name,
      token: area.token,
      boundary,
    })
    geometry.framed.push(boundary)
    if (area.kind === 'grouped') {
      geometry.grouped.push({
        token: area.token,
        pieces: await officialPartsFor(area.slug),
        labeled: true,
      })
    }
  }

  return geometry
}

function drawAreas(map: MapLibreMap, geometry: AreaGeometry): void {
  if (geometry.regions.length > 0) {
    applyColoredAreas(map, REGIONS_PREFIX, geometry.regions, {
      labelPlacement: geometry.labelPlacement,
    })
  }

  geometry.districts.forEach(({ name, token, boundary }, index) => {
    applyOutlinedArea(map, `${DISTRICT_PREFIX}-${index}`, boundary, readMapColor(token), name)
  })

  geometry.grouped.forEach(({ token, pieces, labeled }, index) => {
    if (pieces.length > 0) {
      applyDashedPieces(map, `${PIECES_PREFIX}-${index}`, pieces, readMapColor(token), { labeled })
    }
  })
}

function areaPageLink(area: AreaMapArea): HTMLAnchorElement {
  const link = document.createElement('a')
  link.className = 'area-map-link'
  link.href =
    area.kind === 'city'
      ? `${import.meta.env.BASE_URL}neighborhoods/`
      : `${import.meta.env.BASE_URL}neighborhoods/${area.slug}/`
  link.setAttribute('aria-label', area.name)

  return link
}

function mountAreaMap(element: HTMLElement, areas: AreaMapArea[]): MountedMap {
  const map = createBasemapMap(element, {
    interactive: false,
    attributionControl: { compact: true },
  })
  const geometryPromise = geometryFor(areas)

  map.on('load', async () => {
    const geometry = await geometryPromise
    drawAreas(map, geometry)

    if (geometry.cityView) {
      const camera = map.cameraForBounds(CITY_FRAME_BOUNDS, { padding: CITY_FRAME_PADDING })
      if (camera) {
        map.jumpTo({ center: camera.center, zoom: camera.zoom })
      }

      return
    }

    const bounds = featureBounds(geometry.framed)
    if (bounds) {
      const zoomOut = geometry.districts.length > 0 ? DISTRICT_FRAME_ZOOM_OUT : AREA_FRAME_ZOOM_OUT
      const camera = map.cameraForBounds(bounds, { padding: 32 })
      if (camera) {
        map.jumpTo({ center: camera.center, zoom: (camera.zoom ?? 13) - zoomOut })
      }
    }
  })

  const disposeTheme = watchThemeChanges(map, () => {
    void geometryPromise.then((geometry) => drawAreas(map, geometry))
  })

  return { map, disposeTheme }
}

export function initAreaMaps(): void {
  const elements = document.querySelectorAll<HTMLElement>('[data-area-map]')
  if (elements.length === 0) {
    return
  }

  const areaBySlug = new Map(
    readPayload<AreaMapArea[]>('script[data-area-maps]', []).map((area) => [area.slug, area]),
  )
  const areasByElement = new Map<HTMLElement, AreaMapArea[]>()

  for (const element of elements) {
    const areas = (element.dataset.areaMap ?? '').split(/\s+/).flatMap((slug) => {
      const area = areaBySlug.get(slug)

      return area ? [area] : []
    })
    if (areas.length > 0) {
      areasByElement.set(element, areas)
      element.append(areaPageLink(areas[0]))
    }
  }

  observeMapElements(areasByElement.keys(), (element) => {
    const areas = areasByElement.get(element)

    return areas ? mountAreaMap(element, areas) : undefined
  })
}
