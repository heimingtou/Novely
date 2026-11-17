(function () {
  var theme;
  try {
    theme = JSON.parse(localStorage.getItem("novely:v1:theme"));
  } catch (error) {
    theme = null;
  }

  if (theme !== "dark" && theme !== "light") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
})();
