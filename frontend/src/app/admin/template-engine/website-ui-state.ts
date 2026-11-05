// The Website (Brands) stage page remembers which view was open in localStorage
// (see WebsiteStage: key `te-website-ui:<projectId>`). The CMS sidebar entries use this to
// open the right view: "Brands" = the brand cards, "Layouts" = the layout settings, "Pages" = the Web app pages grid.
export function openWebsiteView(projectId: string, view: 'brands' | 'layouts' | 'pages') {
  try {
    window.localStorage.setItem(
      `te-website-ui:${projectId}`,
      JSON.stringify(
        view === 'pages'
          ? { openBrand: 'webapp', webAppStep: 'assemble' }
          : view === 'layouts'
            ? { openBrand: 'webapp', webAppStep: 'layouts' }
            : { openBrand: null, webAppStep: 'typography' }
      )
    )
  } catch {
    // storage unavailable — the page just opens on whatever view it last had
  }
}
