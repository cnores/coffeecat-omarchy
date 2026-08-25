import QtQuick
import qs.Ui

BarWidget {
  id: root
  moduleName: "coffeecat.places"

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: ""
    horizontalMargin: 7.5
    onPressed: function(pressedButton) {
      if (!root.bar) return
      if (pressedButton === Qt.RightButton) root.bar.run("xdg-open https://coffeecat.app")
      else root.bar.run("omarchy-shell shell toggle coffeecat.places")
    }
  }
}
