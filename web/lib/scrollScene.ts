// Scroll-linked decorative layers. Pure DOM transforms in one rAF-throttled listener (no React renders).
//  [data-parallax="0.12"]  moves the element at a fraction of the scroll distance relative to its [data-scene] host
//  [data-fade]             opacity follows how close the host is to the viewport centre (times data-opacity)
// With reduced motion nothing is attached: layers stay static (CSS gives them their resting opacity).

export function initScrollScene(): () => void {
  if (typeof window === "undefined") return () => {};
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = window.matchMedia("(max-width: 767px)");
  if (reduce.matches) {
    document.documentElement.classList.add("motion-off");
    return () => document.documentElement.classList.remove("motion-off");
  }
  let raf = 0;
  const frame = () => {
    raf = 0;
    const vh = window.innerHeight;
    document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
      const host = (el.closest("[data-scene]") as HTMLElement | null) ?? el;
      const r = host.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;  // far away: skip work
      const mid = r.top + r.height / 2 - vh / 2;       // 0 when the host is centred in the viewport
      const speed = parseFloat(el.dataset.parallax ?? "0") * (mobile.matches ? 0.5 : 1);
      el.style.transform = `translate3d(0, ${(-mid * speed).toFixed(1)}px, 0)`;
      if (el.dataset.fade !== undefined) {
        const base = parseFloat(el.dataset.opacity ?? "1");
        const v = 1 - Math.min(1, Math.abs(mid) / (vh * 0.85 + r.height * 0.25));
        el.style.opacity = String(Math.max(0, Math.min(1, v * 1.25)) * base);
      }
    });
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(frame); };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  frame();
  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    if (raf) cancelAnimationFrame(raf);
  };
}

/** Call after sections mount or change height so new layers get positioned. */
export function refreshScene() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("scroll"));
}
