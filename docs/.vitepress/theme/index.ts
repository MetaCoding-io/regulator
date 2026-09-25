/**
 * The default theme plus one control: a button at the left edge that folds the
 * sidebar away and gives the page its width. The choice is remembered per browser.
 * Nothing else about the default theme changes; the button renders only where a
 * sidebar exists and only at widths where the sidebar is shown.
 */
import DefaultTheme from "vitepress/theme";
import { useSidebar } from "vitepress/theme";
import { defineComponent, h, onMounted, ref } from "vue";
import "./custom.css";

const STORAGE_KEY = "regulator-docs:sidebar-hidden";

const SidebarToggle = defineComponent({
  name: "SidebarToggle",
  setup() {
    const { hasSidebar } = useSidebar();
    const hidden = ref(false);
    function apply(value: boolean): void {
      hidden.value = value;
      document.documentElement.classList.toggle("sidebar-hidden", value);
      try { localStorage.setItem(STORAGE_KEY, value ? "1" : "0"); } catch { /* private window, blocked storage */ }
    }
    onMounted(() => {
      let stored = false;
      try { stored = localStorage.getItem(STORAGE_KEY) === "1"; } catch { /* as above */ }
      apply(stored);
    });
    return () => hasSidebar.value
      ? h("button", {
          type: "button",
          class: ["sidebar-toggle", { "is-hidden": hidden.value }],
          "aria-label": hidden.value ? "Show the sidebar" : "Hide the sidebar",
          title: hidden.value ? "Show the sidebar" : "Hide the sidebar",
          onClick: () => apply(!hidden.value),
        }, hidden.value ? "›" : "‹")
      : null;
  },
});

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { "layout-bottom": () => h(SidebarToggle) }),
};
