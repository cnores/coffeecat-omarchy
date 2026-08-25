# CoffeeCat Places for Omarchy

An [Omarchy](https://omarchy.org) shell plugin for browsing [CoffeeCat](https://coffeecat.app) —
laptop-friendly cafés, coworking spaces, and libraries. Summon it with a keybinding,
pick a city, filter places, and hit Enter to open the full listing in your browser.

Pick a city (type to filter), then browse its places. Tab cycles the venue-type
filter (All / Cafés / Coworking / Libraries / Restaurants). The overlay uses your
Omarchy theme's menu colors, like the built-in emoji picker and clipboard manager.

## Requirements

Current Omarchy with the Quickshell-based desktop (`omarchy-shell`). Network access
to coffeecat.app; data is fetched with `curl` on demand and cities are cached for
an hour per shell session.

## Install

```bash
omarchy plugin add https://github.com/cnores/coffeecat-omarchy --enable
```

Then add the **CoffeeCat** widget (a coffee-cup button) to your bar through
Omarchy's bar settings — left-click opens the overlay, right-click opens
coffeecat.app. Or bind a key in `~/.config/hypr/bindings.lua` (pick any free
combo):

```lua
o.bind("SUPER + CTRL + C", "CoffeeCat places", "omarchy-shell shell toggle coffeecat.places")
```

To jump straight into a city, pass a payload:

```lua
o.bind("SUPER + CTRL + B", "CoffeeCat Bangkok", "omarchy-shell shell toggle coffeecat.places '{\"city_slug\":\"bangkok\"}'")
```

<details>
<summary>Manual install</summary>

```bash
git clone https://github.com/cnores/coffeecat-omarchy ~/.config/omarchy/plugins/coffeecat.places
omarchy plugin enable coffeecat.places
```

</details>

## Keys

| Key | Action |
|-----|--------|
| type | filter the list |
| `↑` `↓` `PgUp` `PgDn` `Home` `End` | move |
| `Enter` | open city / view place details |
| `Shift+Enter` | skip details, open place on coffeecat.app |
| `Tab` / `Shift+Tab` | cycle venue-type filter (places screen) |
| `Esc` | clear filter → back → close |
| `F5` | refetch |

In the place details view: `Enter` opens the page on coffeecat.app, `M` opens
the Google Maps link, `W` copies the wifi password (via `wl-copy`), and
`Esc`/`Backspace` goes back to the list.

## Development

Check the repo out at `~/.config/omarchy/plugins/coffeecat.places` — saves hot-reload
into the running shell. Validate the manifest with `omarchy plugin validate .`.

The data layer (`Model.js`) is plain JavaScript shared between the QML overlay and
Node; run its tests with:

```bash
node test.js
```

Place links come from the API's `web_path` field. Against an older server that
doesn't send it, everything works except opening a place in the browser.

## License

[MIT](LICENSE)
