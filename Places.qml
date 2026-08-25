import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

Item {
  id: root

  property string omarchyPath: Quickshell.env("OMARCHY_PATH")
  property var shell: null
  property var manifest: null

  property bool opened: false
  property string screen: "cities" // "cities" | "venues"
  property string filterText: ""
  property int selectedIndex: 0
  property bool cursorActive: false

  property var cities: []
  property double citiesFetchedAt: 0
  property var currentCity: null
  property var venues: []
  property int typeIndex: 0
  property bool loading: false
  property string loadError: ""
  property string pendingCitySlug: ""
  property string venuesUrl: ""

  readonly property int citiesCacheMs: 60 * 60 * 1000

  // Shares the [menu] surface tokens — themes that style the menu also
  // style this overlay, same as the built-in emojis/clipboard plugins.
  property color background: Color.menu.background
  property color foreground: Color.menu.text
  property color border: Color.menu.border
  property var borderSpec: Border.surfaceSpec("menu", "border", border, Math.max(1, Style.space(2)))
  property color scrim: Color.menu.scrim
  property color selectedBackground: Color.menu.selectedBackground
  property color selectedText: Color.menu.selectedText
  readonly property int cornerRadius: Style.cornerRadius
  property string fontFamily: Style.font.menuFamily
  property int contentMargin: Style.spacing.panelPadding
  property int headerHeight: Math.max(Style.space(34), Style.font.title + Style.spacing.controlPaddingY * 2)
  property int statusHeight: Math.max(Style.space(20), Style.font.caption + Style.space(6))
  property int contentSpacing: Style.spacing.md
  property int cardWidth: Math.min(Style.space(520), panel.width - Style.gapsOut * 2)
  property int cardHeight: Math.min(Style.space(600), panel.height - Style.gapsOut * 2)
  property int rowHeight: Math.max(Style.space(52), Style.font.body + Style.font.caption + Style.space(24))

  function open(payloadJson) {
    var payload = ({})
    try { payload = JSON.parse(payloadJson || "{}") } catch (e) { payload = ({}) }

    root.opened = true
    root.screen = "cities"
    root.currentCity = null
    root.filterText = ""
    root.selectedIndex = 0
    root.cursorActive = true
    root.loadError = ""
    root.pendingCitySlug = payload.city_slug ? String(payload.city_slug) : ""

    if (root.cities.length === 0 || Date.now() - root.citiesFetchedAt > root.citiesCacheMs) {
      root.fetchCities()
    } else {
      root.resolvePendingCity()
    }

    root.rebuildDisplay()
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() {
    root.opened = false
  }

  function dismiss() {
    root.opened = false
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide((root.manifest && root.manifest.id) || "coffeecat.places")
  }

  function toggle() {
    if (root.opened) root.dismiss()
    else root.open("{}")
  }

  function fetchCities() {
    citiesProc.running = false
    root.loading = true
    root.loadError = ""
    citiesProc.running = true
  }

  function citiesLoaded(raw) {
    root.loading = false
    var list = Model.parseCities(raw)
    if (list.length === 0) {
      root.loadError = String(raw || "").trim()
        ? "No cities available"
        : "Couldn't reach coffeecat.app"
    } else {
      root.cities = list
      root.citiesFetchedAt = Date.now()
      root.resolvePendingCity()
    }
    root.rebuildDisplay()
  }

  function resolvePendingCity() {
    if (!root.pendingCitySlug) return
    var row = Model.findCityRow(root.cities, root.pendingCitySlug)
    root.pendingCitySlug = ""
    if (row) root.openCity(row)
  }

  function openCity(cityRow) {
    root.currentCity = cityRow
    root.screen = "venues"
    root.filterText = ""
    root.selectedIndex = 0
    root.cursorActive = true
    root.typeIndex = 0
    root.venues = []
    root.fetchVenues(cityRow)
    root.rebuildDisplay()
  }

  function fetchVenues(cityRow) {
    venuesProc.running = false
    root.loading = true
    root.loadError = ""
    root.venuesUrl = Model.venuesUrl(cityRow)
    venuesProc.running = true
  }

  function venuesLoaded(raw) {
    // A response can land after the user has already gone back to the city
    // list (or opened a different city, which restarts the process).
    if (root.screen !== "venues") return

    root.loading = false
    var list = Model.parseVenues(raw)
    if (list.length === 0 && !String(raw || "").trim()) {
      root.loadError = "Couldn't reach coffeecat.app"
    } else {
      root.venues = list
    }
    root.rebuildDisplay()
  }

  function backToCities() {
    venuesProc.running = false
    root.screen = "cities"
    root.currentCity = null
    root.venues = []
    root.filterText = ""
    root.selectedIndex = 0
    root.cursorActive = true
    root.loading = false
    root.loadError = ""
    root.rebuildDisplay()
  }

  function refresh() {
    if (root.screen === "venues" && root.currentCity) root.fetchVenues(root.currentCity)
    else root.fetchCities()
    root.rebuildDisplay()
  }

  function cycleType(delta) {
    if (root.screen !== "venues") return
    var count = Model.typeFilters.length
    root.typeIndex = (root.typeIndex + delta + count) % count
    root.selectedIndex = 0
    root.cursorActive = true
    root.rebuildDisplay()
  }

  function rebuildDisplay() {
    var rows = root.screen === "cities"
      ? Model.cityRows(root.cities, root.filterText, 200)
      : Model.venueRows(root.venues, root.filterText, Model.typeFilters[root.typeIndex].key, 200)

    displayModel.clear()
    for (var i = 0; i < rows.length; i++) {
      displayModel.append(rows[i])
    }

    if (displayModel.count === 0) selectedIndex = 0
    else if (selectedIndex >= displayModel.count) selectedIndex = displayModel.count - 1
    else if (selectedIndex < 0) selectedIndex = 0
    cursorActive = displayModel.count > 0

    Qt.callLater(function() {
      if (displayModel.count > 0) resultList.positionViewAtIndex(root.selectedIndex, ListView.Contain)
    })
  }

  function select(delta) {
    if (displayModel.count === 0) return
    if (!cursorActive) {
      cursorActive = true
      selectedIndex = delta < 0 ? displayModel.count - 1 : 0
    } else {
      selectedIndex = (selectedIndex + delta + displayModel.count) % displayModel.count
    }
    resultList.positionViewAtIndex(selectedIndex, ListView.Contain)
  }

  function selectAbsolute(index) {
    if (displayModel.count === 0) return
    root.cursorActive = true
    root.selectedIndex = Math.max(0, Math.min(index, displayModel.count - 1))
    resultList.positionViewAtIndex(root.selectedIndex, ListView.Contain)
  }

  function setFilter(nextFilter) {
    root.filterText = nextFilter
    root.selectedIndex = 0
    root.cursorActive = true
    root.rebuildDisplay()
  }

  function activateIndex(index) {
    if (index < 0 || index >= displayModel.count) return
    var row = displayModel.get(index)
    if (root.screen === "cities") {
      root.openCity({ title: row.title, caption: row.caption, citySlug: row.citySlug, countrySlug: row.countrySlug })
    } else if (row.url) {
      root.dismiss()
      Quickshell.execDetached(["xdg-open", row.url])
    }
  }

  function headerPlaceholder() {
    return root.screen === "cities"
      ? "Search cities…"
      : "Search " + ((root.currentCity && root.currentCity.title) || "places") + "…"
  }

  function statusLeftText() {
    if (root.loading) return "Loading…"
    if (root.loadError) return root.loadError
    if (root.screen === "cities") return displayModel.count + " cities"
    var city = root.currentCity ? root.currentCity.title + ", " + root.currentCity.caption : ""
    return city + " · " + Model.typeFilters[root.typeIndex].label + " · " + displayModel.count
  }

  function statusRightText() {
    return root.screen === "cities" ? "Enter to browse" : "Tab filters · Esc back"
  }

  function emptyText() {
    if (root.loading) return "Loading…"
    if (root.loadError) return root.loadError
    if (root.filterText) return "No matches for “" + root.filterText + "”"
    return root.screen === "cities" ? "No cities yet" : "No places here yet"
  }

  ListModel { id: displayModel }

  Process {
    id: citiesProc
    command: ["curl", "-fsS", "--max-time", "10", Model.citiesUrl()]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.citiesLoaded(text)
    }
  }

  Process {
    id: venuesProc
    command: ["curl", "-fsS", "--max-time", "10", root.venuesUrl]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.venuesLoaded(text)
    }
  }

  PanelWindow {
    id: panel
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "coffeecat-places"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Rectangle {
      anchors.fill: parent
      color: root.scrim
    }

    MouseArea {
      anchors.fill: parent
      onClicked: root.dismiss()
    }

    BorderSurface {
      id: card
      width: root.cardWidth
      height: root.cardHeight
      radius: root.cornerRadius
      anchors.centerIn: parent
      color: root.background
      borderSpec: root.borderSpec
      padding: root.contentMargin

      MouseArea { anchors.fill: parent; onClicked: {} }

      Item {
        id: keyCatcher
        anchors.fill: parent
        focus: true

        Keys.priority: Keys.BeforeItem
        Keys.onPressed: function(event) {
          if (event.key === Qt.Key_Escape) {
            if (root.filterText) root.setFilter("")
            else if (root.screen === "venues") root.backToCities()
            else root.dismiss()
            event.accepted = true
          } else if (Util.editsFilter(event, root.filterText)) {
            root.setFilter(Util.editedFilter(event, root.filterText))
            event.accepted = true
          } else if (event.key === Qt.Key_Tab) {
            root.cycleType(1)
            event.accepted = true
          } else if (event.key === Qt.Key_Backtab) {
            root.cycleType(-1)
            event.accepted = true
          } else if (event.key === Qt.Key_F5) {
            root.refresh()
            event.accepted = true
          } else if (event.key === Qt.Key_Up) {
            root.select(-1)
            event.accepted = true
          } else if (event.key === Qt.Key_Down) {
            root.select(1)
            event.accepted = true
          } else if (event.key === Qt.Key_PageUp) {
            root.select(-8)
            event.accepted = true
          } else if (event.key === Qt.Key_PageDown) {
            root.select(8)
            event.accepted = true
          } else if (event.key === Qt.Key_Home) {
            root.selectAbsolute(0)
            event.accepted = true
          } else if (event.key === Qt.Key_End) {
            root.selectAbsolute(displayModel.count - 1)
            event.accepted = true
          } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            if (root.cursorActive) root.activateIndex(root.selectedIndex)
            else if (displayModel.count > 0) root.cursorActive = true
            event.accepted = true
          } else if (event.text && event.text.length === 1 && event.text.charCodeAt(0) >= 32 && event.text.charCodeAt(0) !== 127) {
            root.setFilter(root.filterText + event.text)
            event.accepted = true
          }
        }
      }

      Column {
        anchors.fill: parent
        anchors.topMargin: card.contentTopInset
        anchors.rightMargin: card.contentRightInset
        anchors.bottomMargin: card.contentBottomInset
        anchors.leftMargin: card.contentLeftInset
        spacing: root.contentSpacing

        Rectangle {
          width: parent.width
          height: root.headerHeight
          radius: root.cornerRadius
          color: "transparent"

          Text {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            text: root.filterText || root.headerPlaceholder()
            color: root.foreground
            opacity: root.filterText ? 1 : 0.58
            font.family: root.fontFamily
            font.pixelSize: Style.font.heading
            elide: Text.ElideRight
          }
        }

        Item {
          width: parent.width
          height: root.statusHeight

          Text {
            anchors.left: parent.left
            anchors.right: statusRight.left
            anchors.rightMargin: Style.space(8)
            anchors.verticalCenter: parent.verticalCenter
            text: root.statusLeftText()
            color: root.loadError && !root.loading ? Color.urgent : root.foreground
            opacity: root.loadError && !root.loading ? 0.9 : 0.62
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            elide: Text.ElideRight
          }

          Text {
            id: statusRight
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            text: root.statusRightText()
            color: root.foreground
            opacity: 0.45
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
          }
        }

        Item {
          width: parent.width
          height: parent.height - root.headerHeight - root.statusHeight - root.contentSpacing * 2

          ListView {
            id: resultList
            anchors.fill: parent
            model: displayModel
            clip: true
            spacing: Style.space(4)
            boundsBehavior: Flickable.StopAtBounds

            delegate: Rectangle {
              id: row
              required property int index
              required property string title
              required property string caption
              required property string meta
              required property string url
              required property string citySlug
              required property string countrySlug

              readonly property bool hasCursor: root.cursorActive && index === root.selectedIndex

              width: ListView.view.width
              height: root.rowHeight
              radius: root.cornerRadius
              color: hasCursor ? root.selectedBackground : "transparent"

              Item {
                anchors.fill: parent
                anchors.leftMargin: Style.space(12)
                anchors.rightMargin: Style.space(12)

                Column {
                  anchors.left: parent.left
                  anchors.right: metaText.left
                  anchors.rightMargin: Style.space(10)
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.space(2)

                  Text {
                    width: parent.width
                    text: row.title
                    color: row.hasCursor ? root.selectedText : root.foreground
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.body
                    elide: Text.ElideRight
                  }

                  Text {
                    width: parent.width
                    text: row.caption
                    visible: row.caption.length > 0
                    color: row.hasCursor ? root.selectedText : root.foreground
                    opacity: 0.62
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.caption
                    elide: Text.ElideRight
                  }
                }

                Text {
                  id: metaText
                  anchors.right: parent.right
                  anchors.verticalCenter: parent.verticalCenter
                  text: row.meta
                  color: row.hasCursor ? root.selectedText : root.foreground
                  opacity: 0.62
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                }
              }

              MouseArea {
                anchors.fill: parent
                hoverEnabled: true
                cursorShape: Qt.PointingHandCursor
                onContainsMouseChanged: if (containsMouse) {
                  root.cursorActive = true
                  root.selectedIndex = row.index
                }
                onClicked: {
                  root.cursorActive = true
                  root.selectedIndex = row.index
                  root.activateIndex(row.index)
                }
              }
            }
          }

          Column {
            anchors.centerIn: parent
            spacing: Style.space(8)
            visible: displayModel.count === 0

            Text {
              text: ""
              color: root.selectedText
              opacity: 0.8
              font.family: root.fontFamily
              font.pixelSize: Style.font.displayLarge
              horizontalAlignment: Text.AlignHCenter
              width: parent.width
            }

            Text {
              text: root.emptyText()
              color: root.foreground
              opacity: 0.7
              font.family: root.fontFamily
              font.pixelSize: Style.font.title
              horizontalAlignment: Text.AlignHCenter
              width: parent.width
            }
          }
        }
      }
    }
  }
}
