(function () {
  if (window.location.hostname === "tauri.localhost") {
    document.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
        return false;
      },
      { capture: true }
    );

    document.addEventListener("keydown", (event) => {
      if (event.key === "F5" || (event.ctrlKey && event.key === "r") || (event.metaKey && event.key === "r")) {
        event.preventDefault();
      }
    });
  }
})();
