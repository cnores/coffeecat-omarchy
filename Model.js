// Data helpers for the CoffeeCat places overlay. Plain JS with no Quickshell
// dependencies so the row-building and filtering logic runs under Node too
// (`node test.js`), mirroring how the built-in Omarchy plugins structure
// their logic.

var BASE_URL = "https://coffeecat.app"

var typeFilters = [
  { key: "", label: "All" },
  { key: "coffee_shop", label: "Cafés" },
  { key: "coworking_space", label: "Coworking" },
  { key: "library", label: "Libraries" },
  { key: "restaurant", label: "Restaurants" }
]

function citiesUrl() {
  return BASE_URL + "/api/v1/cities"
}

function venuesUrl(city) {
  return BASE_URL + "/api/v1/venues/by_city_slug"
    + "?slug=" + encodeURIComponent(String((city && city.citySlug) || ""))
    + "&country_slug=" + encodeURIComponent(String((city && city.countrySlug) || ""))
}

function parseCities(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    var list = data && data.cities
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

function parseVenues(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    return Array.isArray(data) ? data : []
  } catch (e) {
    return []
  }
}

function typeLabel(key) {
  switch (String(key || "")) {
  case "coffee_shop": return "Café"
  case "coworking_space": return "Coworking"
  case "library": return "Library"
  case "restaurant": return "Restaurant"
  default: return "Place"
  }
}

function placeCount(count) {
  var n = Number(count) || 0
  return n === 1 ? "1 place" : n + " places"
}

function clampLimit(limit, fallback) {
  var max = limit === undefined || limit === null ? fallback : Number(limit)
  if (isNaN(max)) max = fallback
  return Math.max(0, max)
}

// Rows are flat objects with an identical role set for both screens so a
// single ListModel/delegate serves cities and venues.
function cityRows(cities, query, limit) {
  var values = Array.isArray(cities) ? cities : []
  var needle = String(query || "").trim().toLowerCase()
  var max = clampLimit(limit, 200)
  var out = []

  for (var i = 0; i < values.length && out.length < max; i++) {
    var c = values[i]
    if (!c || !c.city_slug) continue

    var haystack = (String(c.city || "") + " " + String(c.country || "")).toLowerCase()
    if (needle && haystack.indexOf(needle) < 0) continue

    out.push({
      title: String(c.city || c.city_slug),
      caption: String(c.country || ""),
      meta: placeCount(c.venue_count),
      url: "",
      citySlug: String(c.city_slug),
      countrySlug: String(c.country_slug || "")
    })
  }

  return out
}

function venueCaption(venue) {
  var parts = [typeLabel(venue.venue_type)]
  if (venue.city_area) parts.push(String(venue.city_area))
  return (venue.verified ? "✓ " : "") + parts.join(" · ")
}

function ratingText(venue) {
  if (venue.internet !== undefined && venue.internet !== null)
    return "wifi " + Number(venue.internet).toFixed(1)
  if (venue.coffee !== undefined && venue.coffee !== null)
    return "coffee " + Number(venue.coffee).toFixed(1)
  return ""
}

function venueRows(venues, query, typeKey, limit) {
  var values = Array.isArray(venues) ? venues : []
  var needle = String(query || "").trim().toLowerCase()
  var wantedType = String(typeKey || "")
  var max = clampLimit(limit, 200)
  var out = []

  for (var i = 0; i < values.length && out.length < max; i++) {
    var v = values[i]
    if (!v || !v.name) continue
    if (wantedType && String(v.venue_type || "") !== wantedType) continue

    var haystack = (String(v.name || "") + " " + String(v.city_area || "")
      + " " + typeLabel(v.venue_type)).toLowerCase()
    if (needle && haystack.indexOf(needle) < 0) continue

    out.push({
      title: String(v.name),
      caption: venueCaption(v),
      meta: ratingText(v),
      url: v.web_path ? BASE_URL + String(v.web_path) : "",
      citySlug: "",
      countrySlug: ""
    })
  }

  return out
}

function findCityRow(cities, slug) {
  var rows = cityRows(cities, "", null)
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].citySlug === String(slug || "")) return rows[i]
  }
  return null
}

if (typeof module !== "undefined") {
  module.exports = {
    BASE_URL: BASE_URL,
    typeFilters: typeFilters,
    citiesUrl: citiesUrl,
    venuesUrl: venuesUrl,
    parseCities: parseCities,
    parseVenues: parseVenues,
    typeLabel: typeLabel,
    placeCount: placeCount,
    cityRows: cityRows,
    venueCaption: venueCaption,
    ratingText: ratingText,
    venueRows: venueRows,
    findCityRow: findCityRow
  }
}
