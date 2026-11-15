/* Inline SVG icons named like the Material Symbols the design uses, so the app needs no icon font and works
   offline. Simple shapes drawn for this app. ICONS.svg(name, fill) returns an aria-hidden <svg> with class "ic". */
(function () {
  const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const P = {
    check_circle: (f) => f
      ? '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
      : `<circle cx="12" cy="12" r="9.5" ${S}/><path d="M7.5 12.5l3 3 6-6.5" ${S}/>`,
    arrow_upward: () => `<path d="M12 20V5M5.5 11.5L12 5l6.5 6.5" ${S} stroke-width="2.4"/>`,
    arrow_downward: () => `<path d="M12 4v15M5.5 12.5L12 19l6.5-6.5" ${S} stroke-width="2.4"/>`,
    report: () => '<path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8z" fill="currentColor"/><path d="M12 7v6.5M12 16.5v.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
    warning: () => '<path d="M12 2.5l10.5 18.5h-21z" fill="currentColor"/><path d="M12 9.5v5M12 17.5v.5" stroke="#fddc69" stroke-width="2.4" stroke-linecap="round"/>',
    warning_red: () => '<path d="M12 2.5l10.5 18.5h-21z" fill="currentColor"/><path d="M12 9.5v5M12 17.5v.5" stroke="#b60109" stroke-width="2.4" stroke-linecap="round"/>',
    info: (f) => f
      ? '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 11v6M12 7.3v.4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'
      : `<circle cx="12" cy="12" r="9.5" ${S}/><path d="M12 11v6M12 7.3v.4" ${S} stroke-width="2.4"/>`,
    hourglass_top: () => `<path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 9 5 9 9s-9 4-9 9M16.5 3c0 5-9 5-9 9s9 4 9 9" ${S}/>`,
    link: () => `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" ${S}/>`,
    pending: () => `<circle cx="12" cy="12" r="9.5" ${S}/><circle cx="7.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="16.5" cy="12" r="1.3" fill="currentColor"/>`,
    task_alt: () => `<path d="M21 11.1V12a9 9 0 1 1-5.3-8.2" ${S}/><path d="M8 11.5l3.5 3.5L21 5" ${S}/>`,
    schedule: () => `<circle cx="12" cy="12" r="9.5" ${S}/><path d="M12 6.5V12l3.8 2.3" ${S}/>`,
    favorite: (f) => `<path d="M12 20.5s-8.5-5.2-8.5-11A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.9c0 5.8-8.5 11-8.5 11z" ${f ? 'fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"' : S}/>`,
    notifications: (f) => `<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 1.5h-15z" ${f ? 'fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"' : S}/><path d="M10 21h4" ${S}/>`,
    group: (f) => `<circle cx="9" cy="8" r="3.5" ${f ? 'fill="currentColor"' : S}/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z" ${f ? 'fill="currentColor"' : S}/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.3c2.2.7 3.5 2.8 3.5 5.7" ${S}/>`,
    medical: (f) => `<rect x="3" y="7" width="18" height="13" rx="2" ${f ? 'fill="currentColor" stroke="currentColor" stroke-width="2"' : S}/><path d="M9 7V4.5h6V7" ${S}/><path d="M12 10.5v6M9 13.5h6" fill="none" stroke="${f ? "#fff" : "currentColor"}" stroke-width="2" stroke-linecap="round"/>`,
    emergency: (f) => `<path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8z" ${f ? 'fill="currentColor"' : S}/><path d="M12 7v6.5M12 16.5v.6" stroke="${f ? "#fff" : "currentColor"}" stroke-width="2.4" stroke-linecap="round"/>`,
    emergency_bar: () => '<path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8z" fill="#fff"/><path d="M12 7v6.5M12 16.5v.6" stroke="#b60109" stroke-width="2.6" stroke-linecap="round"/>',
    public: () => `<circle cx="12" cy="12" r="9.5" ${S}/><path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19" ${S}/>`,
    signal_cellular_alt: () => '<rect x="4" y="15" width="3.2" height="6" rx="1" fill="currentColor"/><rect x="10.4" y="10" width="3.2" height="11" rx="1" fill="currentColor"/><rect x="16.8" y="4" width="3.2" height="17" rx="1" fill="currentColor"/>',
    signal_delay: () => '<rect x="4" y="15" width="3.2" height="6" rx="1" fill="currentColor"/><rect x="10.4" y="10" width="3.2" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="16.8" y="4" width="3.2" height="17" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    radiation: () => '<circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 12L7.2 3.7A9.6 9.6 0 0 0 2.4 12zM12 12l9.6 0a9.6 9.6 0 0 0-4.8-8.3zM12 12l-4.8 8.3a9.6 9.6 0 0 0 9.6 0z" fill="currentColor"/>',
    close: () => `<path d="M6 6l12 12M18 6L6 18" ${S} stroke-width="2.4"/>`,
    chevron_right: () => `<path d="M9 5l7 7-7 7" ${S} stroke-width="2.4"/>`,
    tune: () => `<path d="M4 7h10M18 7h2M4 17h4M12 17h8" ${S}/><circle cx="16" cy="7" r="2" ${S}/><circle cx="10" cy="17" r="2" ${S}/>`,
    check: () => `<path d="M5 12.5l4.5 4.5L19 7.5" ${S} stroke-width="2.6"/>`,
    person: (f) => `<circle cx="12" cy="8" r="4" ${f ? 'fill="currentColor"' : S}/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" ${f ? 'fill="currentColor"' : S}/>`,
    shield: () => `<path d="M12 2.5l8 3v6c0 5-3.4 8.8-8 10-4.6-1.2-8-5-8-10v-6z" ${S}/>`,
  };
  function svg(name, fill) {
    const f = P[name] || P.info;
    return `<svg class="ic" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${f(!!fill)}</svg>`;
  }
  window.ICONS = { svg, has: (n) => n in P };
})();
