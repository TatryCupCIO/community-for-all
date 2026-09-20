/* =========================================================
   COMMUNITY FOR ALL - TEMPORARY DIAGNOSTIC
   ========================================================= */

window.addEventListener("load", function () {

  const report = [];

  function check(id) {
    const el = document.getElementById(id);

    if (!el) {
      report.push("❌ CHÝBA: #" + id);
      return;
    }

    const s = getComputedStyle(el);

    report.push(
      "✅ #" + id +
      " | display=" + s.display +
      " | visibility=" + s.visibility +
      " | pointer-events=" + s.pointerEvents +
      " | classes=" + el.className
    );
  }

  report.push("=== COMMUNITY FOR ALL DIAGNOSTIC ===");

  [
    "homePage",
    "eventsBtn",
    "bookingsBtn",
    "fatraBtn",
    "faceBtn",
    "aboutBtn",
    "contactBtn",
    "skLangBtn",
    "enLangBtn"
  ].forEach(check);

  report.push("");
  report.push("=== GLOBAL FUNCTIONS ===");

  [
    "showEventDetail",
    "showCartPage",
    "showBookings",
    "setLanguage"
  ].forEach(function(name) {
    report.push(
      (typeof window[name] === "function" ? "✅ " : "❌ ") +
      name +
      " = " +
      typeof window[name]
    );
  });

  report.push("");
  report.push("=== DUPLICATE IDs ===");

  const ids = {};
  document.querySelectorAll("[id]").forEach(function(el) {
    ids[el.id] = (ids[el.id] || 0) + 1;
  });

  const duplicates = Object.entries(ids)
    .filter(function(entry) {
      return entry[1] > 1;
    });

  if (duplicates.length === 0) {
    report.push("✅ Žiadne duplicitné ID");
  } else {
    duplicates.forEach(function(entry) {
      report.push("❌ #" + entry[0] + " je " + entry[1] + "x");
    });
  }

  const output = report.join("\n");

  console.log(output);

  const box = document.createElement("textarea");

  box.id = "cfaDiagnostic";
  box.value = output;
  box.readOnly = true;

  box.style.cssText = `
    position:fixed;
    left:10px;
    right:10px;
    bottom:10px;
    width:calc(100% - 20px);
    height:260px;
    z-index:999999;
    background:#111;
    color:#fff;
    border:2px solid #ff7900;
    border-radius:10px;
    padding:10px;
    font-size:11px;
    font-family:monospace;
  `;

  document.body.appendChild(box);

});
