// photo.longwalkhome.net
// Minimal client behavior. Keyboard navigation on photo detail pages.

(function () {
  "use strict";

  const photoPage = document.querySelector("[data-photo-page]");
  if (!photoPage) return;

  const prevHref = photoPage.dataset.prev || "";
  const nextHref = photoPage.dataset.next || "";
  const collectionHref = photoPage.dataset.collection || "/";

  document.addEventListener("keydown", function (e) {
    // Ignore when the user is typing in a field
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

    if (e.key === "ArrowLeft" && prevHref) {
      e.preventDefault();
      window.location.href = prevHref;
    } else if (e.key === "ArrowRight" && nextHref) {
      e.preventDefault();
      window.location.href = nextHref;
    } else if (e.key === "Escape") {
      e.preventDefault();
      window.location.href = collectionHref;
    }
  });
})();
