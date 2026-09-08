#!/usr/bin/env bash
# Rebuilds public/stl.pmtiles: extracts the St. Louis metro from a Protomaps
# daily planet build, then strips it to the layers the site's MapLibre style
# actually renders. Docs live in the private workspace (docs/protomaps-basemap.md).
#
# Usage: scripts/build-basemap.sh 20260901
#   (pick a date from https://build.protomaps.com)
#
# Prereqs: pmtiles (brew install pmtiles) and tile-join (brew install tippecanoe).
set -euo pipefail

build_date="${1:?Usage: scripts/build-basemap.sh YYYYMMDD (see https://build.protomaps.com)}"

for tool in pmtiles tile-join; do
  if ! command -v "${tool}" >/dev/null; then
    echo "Missing ${tool} — install with: brew install pmtiles tippecanoe" >&2
    exit 1
  fi
done

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
extract_path="$(mktemp -d)/stl-extract.pmtiles"

# The metro bounding box (west,south,east,north): roughly Wentzville to Festus
# to the Illinois inner suburbs to Alton. maxzoom 14 overzooms cleanly past z14.
pmtiles extract "https://build.protomaps.com/${build_date}.pmtiles" "${extract_path}" \
  --bbox=-90.95,38.18,-89.85,38.95 \
  --maxzoom=14

# Layer allowlist: an earlier cut dropped buildings/pois entirely and filtered
# landuse to green kinds; buildings + pois + full landuse are now kept so the
# basemap reads at neighborhood zoom. landcover stays out (a low-zoom wash,
# not worth the bytes at city scale). No -j filter.
tile-join -f -pk \
  -l earth -l water -l roads -l boundaries -l places -l landuse -l buildings -l pois \
  -o "${repo_root}/public/stl.pmtiles" "${extract_path}"

rm -f "${extract_path}"
echo "Built public/stl.pmtiles:"
du -h "${repo_root}/public/stl.pmtiles"
echo "Production reads PUBLIC_PMTILES_URL — upload the new file to the Supabase bucket yourself."
