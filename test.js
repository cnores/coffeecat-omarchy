// Run with: node test.js
const assert = require("node:assert")
const Model = require("./Model.js")

const cities = [
  { city: "Bangkok", city_slug: "bangkok", country: "Thailand", country_slug: "thailand", venue_count: 12 },
  { city: "Berlin", city_slug: "berlin", country: "Germany", country_slug: "germany", venue_count: 1 },
  { city: "No Slug", country: "Nowhere" }
]

const venues = [
  {
    name: "Coffee Place", venue_type: "coffee_shop", city_area: "Sukhumvit",
    verified: true, internet: 4.5, coffee: 4.0, web_path: "/places/thailand/bangkok/sukhumvit/v-coffee-place"
  },
  {
    name: "Work Hub", venue_type: "coworking_space", city_area: null,
    verified: false, internet: null, coffee: 3.5, web_path: "/places/thailand/bangkok/v-work-hub"
  },
  { name: "Mystery Spot", venue_type: "other", verified: false }
]

// parseCities / parseVenues
assert.deepStrictEqual(Model.parseCities(JSON.stringify({ cities })).length, 3)
assert.deepStrictEqual(Model.parseCities("not json"), [])
assert.deepStrictEqual(Model.parseCities(JSON.stringify({ nope: 1 })), [])
assert.deepStrictEqual(Model.parseVenues(JSON.stringify(venues)).length, 3)
assert.deepStrictEqual(Model.parseVenues(""), [])

// cityRows: filtering, slug requirement, meta
let rows = Model.cityRows(cities, "", null)
assert.strictEqual(rows.length, 2, "entries without city_slug are dropped")
assert.strictEqual(rows[0].title, "Bangkok")
assert.strictEqual(rows[0].meta, "12 places")
assert.strictEqual(rows[1].meta, "1 place")
assert.strictEqual(Model.cityRows(cities, "GERM", null).length, 1, "matches country, case-insensitive")
assert.strictEqual(Model.cityRows(cities, "bang", null)[0].citySlug, "bangkok")
assert.strictEqual(Model.cityRows(cities, "zzz", null).length, 0)
assert.strictEqual(Model.cityRows(cities, "", 1).length, 1, "limit respected")

// Both row kinds expose the identical role set (single ListModel requirement)
const cityRoles = Object.keys(Model.cityRows(cities, "", null)[0]).sort()
const venueRoles = Object.keys(Model.venueRows(venues, "", "", null)[0]).sort()
assert.deepStrictEqual(cityRoles, venueRoles)

// venueRows: type filter, search, url, caption, rating
rows = Model.venueRows(venues, "", "", null)
assert.strictEqual(rows.length, 3)
assert.strictEqual(rows[0].url, Model.BASE_URL + "/places/thailand/bangkok/sukhumvit/v-coffee-place")
assert.strictEqual(rows[2].url, "", "missing web_path yields empty url")
assert.strictEqual(rows[0].caption, "✓ Café · Sukhumvit")
assert.strictEqual(rows[1].caption, "Coworking")
assert.strictEqual(rows[0].meta, "wifi 4.5", "internet rating wins over coffee")
assert.strictEqual(rows[1].meta, "coffee 3.5", "falls back to coffee rating")
assert.strictEqual(rows[2].meta, "")

assert.strictEqual(Model.venueRows(venues, "", "coworking_space", null).length, 1)
assert.strictEqual(Model.venueRows(venues, "sukhumvit", "", null).length, 1, "matches city_area")
assert.strictEqual(Model.venueRows(venues, "café", "", null).length, 1, "matches type label")
assert.strictEqual(Model.venueRows(venues, "work", "coffee_shop", null).length, 0, "type filter and search compose")

// URLs
assert.strictEqual(Model.citiesUrl(), Model.BASE_URL + "/api/v1/cities")
assert.strictEqual(
  Model.venuesUrl({ citySlug: "chiang-mai", countrySlug: "thailand" }),
  Model.BASE_URL + "/api/v1/venues/by_city_slug?slug=chiang-mai&country_slug=thailand"
)
assert.ok(Model.venuesUrl({ citySlug: "a b" }).indexOf("slug=a%20b") > 0, "slugs are URI-encoded")

// findCityRow
assert.strictEqual(Model.findCityRow(cities, "berlin").title, "Berlin")
assert.strictEqual(Model.findCityRow(cities, "nope"), null)

// typeFilters sanity: first entry means "no filter"
assert.strictEqual(Model.typeFilters[0].key, "")
assert.ok(Model.typeFilters.some(f => f.key === "coffee_shop"))
assert.ok(Model.typeFilters.some(f => f.key === "coworking_space"))

console.log("all Model.js tests passed")
