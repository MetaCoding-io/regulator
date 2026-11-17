#!/usr/bin/env bash
# Creates the GitHub release for a tag, or brings an existing one level with the changelog.
#
#   scripts/github-release.sh v0.1.3
#
# The body is the changelog's section for the version (scripts/release-notes.mjs). A release that already exists
# for the tag, a draft included, is edited and published, not duplicated, so the script can be re-run. Needs `gh`
# with a token that may write releases (GH_TOKEN), and the tag to exist on the remote.
set -euo pipefail

tag="${1:?usage: github-release.sh <tag>}"
version="${tag#v}"
notes="$(mktemp)"
trap 'rm -f "$notes"' EXIT
node "$(dirname "$0")/release-notes.mjs" "$version" > "$notes"

if gh release view "$tag" > /dev/null 2>&1; then
  gh release edit "$tag" --title "$version" --notes-file "$notes" --draft=false
  echo "updated the release for $tag"
else
  gh release create "$tag" --title "$version" --notes-file "$notes" --verify-tag
  echo "created the release for $tag"
fi
