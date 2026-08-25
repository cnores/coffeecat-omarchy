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
      countrySlug: String(c.country_slug || ""),
      venueIndex: -1
    })
  }

  return out
}

function venueCaption(venue) {
  var parts = [typeLabel(venue.venue_type)]
  if (venue.city_area) parts.push(String(venue.city_area))
  return (venue.verified ? "✓ " : "") + parts.join(" · ")
}

// One block glyph per rating attribute, in ratingLabels order (coffee, wifi,
// quiet, comfort, food, price) — a tiny "personality chart" for the list.
// Unrated attributes render as a mid dot; fully unrated venues get "".
var SPARK_LEVELS = "▁▂▃▄▅▆▇█"

function sparkGlyph(value) {
  var n = Math.max(0, Math.min(5, Number(value)))
  return SPARK_LEVELS.charAt(Math.round(n / 5 * (SPARK_LEVELS.length - 1)))
}

function ratingSparkline(venue) {
  var any = false
  var out = ""
  for (var i = 0; i < ratingLabels.length; i++) {
    var value = venue ? venue[ratingLabels[i][0]] : null
    if (value === undefined || value === null) {
      out += "·"
    } else {
      out += sparkGlyph(value)
      any = true
    }
  }
  return any ? out : ""
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
      meta: ratingSparkline(v),
      url: v.web_path ? BASE_URL + String(v.web_path) : "",
      citySlug: "",
      countrySlug: "",
      venueIndex: i
    })
  }

  return out
}

function coverImageUrl(venue) {
  var src = String((venue && venue.cover_image) || "")
  if (src.indexOf("http") === 0) return src
  if (src.charAt(0) === "/") return BASE_URL + src
  return ""
}

var ratingLabels = [
  ["coffee", "coffee"],
  ["internet", "wifi"],
  ["quietness", "quiet"],
  ["comfortability", "comfort"],
  ["food", "food"],
  ["expensiveness", "price"]
]

// Reviews rate the same things under different keys than venues do.
var reviewRatingLabels = [
  ["coffee", "coffee"],
  ["internet", "wifi"],
  ["noise", "noise"],
  ["comfort", "comfort"],
  ["food", "food"],
  ["price", "price"]
]

function labeledRatings(source, labels) {
  var parts = []
  for (var i = 0; i < labels.length; i++) {
    var value = source ? source[labels[i][0]] : null
    if (value !== undefined && value !== null)
      parts.push(labels[i][1] + " " + Number(value).toFixed(1))
  }
  return parts.join(" · ")
}

function ratingsLine(venue) {
  return labeledRatings(venue, ratingLabels)
}

function venueShowUrl(id) {
  return BASE_URL + "/api/v1/venues/" + encodeURIComponent(String(id))
}

function parseReviews(raw) {
  try {
    var data = JSON.parse(String(raw || ""))
    var list = data && data.reviews
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

function reviewItems(reviews, limit) {
  var values = Array.isArray(reviews) ? reviews : []
  var max = clampLimit(limit, 20)
  var out = []

  for (var i = 0; i < values.length && out.length < max; i++) {
    var r = values[i]
    if (!r) continue

    var text = String(r.description || "").trim()
    if (!text) text = labeledRatings(r, reviewRatingLabels)
    if (!text) continue

    out.push({
      author: String((r.user && r.user.name) || "Anonymous"),
      meta: String(r.created_at || "").slice(0, 10),
      text: text
    })
  }

  return out
}

function venueDetail(venue) {
  var v = venue || {}
  return {
    id: v.id !== undefined && v.id !== null ? String(v.id) : "",
    title: String(v.name || ""),
    subtitle: venueCaption(v),
    description: String(v.description || ""),
    address: String(v.address || ""),
    ratings: ratingsLine(v),
    wifiPassword: String(v.wifi_password || ""),
    coverImage: coverImageUrl(v),
    url: v.web_path ? BASE_URL + String(v.web_path) : "",
    mapsLink: String(v.maps_link || ""),
    website: String(v.website || ""),
    reviewCount: Number(v.review_count) || 0
  }
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
    ratingSparkline: ratingSparkline,
    venueRows: venueRows,
    coverImageUrl: coverImageUrl,
    ratingsLine: ratingsLine,
    venueDetail: venueDetail,
    venueShowUrl: venueShowUrl,
    parseReviews: parseReviews,
    reviewItems: reviewItems,
    findCityRow: findCityRow
  }
}
