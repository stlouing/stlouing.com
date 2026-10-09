#!/usr/bin/env bash
# Rebuilds the basemap (BASEMAP_FILE in site.config.mjs): extracts the metro
# area from a Protomaps daily planet build, then strips it to the layers the
# site's MapLibre style actually renders. See MAPS.md.
#
# Usage: npm run build:basemap                (yesterday's build)
#        npm run build:basemap -- 20260901    (a specific date from build.protomaps.com)
# To switch cities, use npm run setup -- --city "Edinburgh" instead.
#
# Prereqs: pmtiles (brew install pmtiles) and tile-join (brew install tippecanoe).
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
build_date="${1:-$(date -u -v-1d +%Y%m%d 2>/dev/null || date -u -d yesterday +%Y%m%d)}"
echo "Using Protomaps build ${build_date}"

for tool in pmtiles tile-join; do
  if ! command -v "${tool}" >/dev/null; then
    echo "Missing ${tool} — install with: brew install pmtiles tippecanoe" >&2
    exit 1
  fi
done

config_value() {
  node --input-type=module -e "import * as config from '${repo_root}/site.config.mjs'; console.log([].concat(config.$1).join(','))"
}
basemap_file="$(config_value BASEMAP_FILE)"
basemap_bounds="$(config_value BASEMAP_BOUNDS)"
extract_path="$(mktemp -d)/stl-extract.pmtiles"

# The bounding box (west,south,east,north) comes from BASEMAP_BOUNDS in
# site.config.mjs. maxzoom 14 overzooms cleanly past z14.
pmtiles extract "https://build.protomaps.com/${build_date}.pmtiles" "${extract_path}" \
  --bbox="${basemap_bounds}" \
  --maxzoom=14

# Layer allowlist: an earlier cut dropped buildings/pois entirely and filtered
# landuse to green kinds; buildings + pois + full landuse are now kept so the
# basemap reads at neighborhood zoom. landcover stays out (a low-zoom wash,
# not worth the bytes at city scale). No -j filter.
tile-join -f -pk \
  -l earth -l water -l roads -l boundaries -l places -l landuse -l buildings -l pois \
  -o "${repo_root}/public/${basemap_file}" "${extract_path}"

rm -f "${extract_path}"
echo "Built public/${basemap_file}:"
du -h "${repo_root}/public/${basemap_file}"
echo "Production reads PUBLIC_PMTILES_URL — upload the new file to your storage bucket yourself."
