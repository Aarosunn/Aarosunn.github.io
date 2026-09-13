/**
 * Everything the site says lives here. To add a project, append one entry to PROJECTS with the id of the section it
 * belongs to; it shows up in that section's list on the home page (click it for the detail panel) and as a page inside
 * the section (the cube turns from one to the next). Sections are the four corners of the home page.
 */

export type SectionId = 'about' | 'code' | 'hardware' | 'creatives'

export type Section = {
  id: SectionId
  title: string
  /** one line under the title on the home page */
  blurb: string
  /** lines listed instead of projects (About has no projects) */
  notes?: string[]
}

export type Project = {
  /** which section lists it */
  section: SectionId
  title: string
  year: number | string
  /** one or two sentences: the page inside the section shows this under the title */
  blurb: string
  /** the detail panel on the home page (optional, falls back to the blurb) */
  detail?: string
  /** what it is built with, shown on the detail panel */
  stack?: string
  /** a link the detail panel offers */
  link?: { label: string; href: string }
}

export const SITE = {
  name: 'aarcube',
  intro: 'Aaron. Engineer of small machines and large gradients.',
  /** the About corner's portrait: an ascii bust for now, a webcam one day */
  portrait: true,
}

export const SECTIONS: Section[] = [
  { id: 'about', title: 'About', blurb: 'Computer engineering at Michigan. Silicon to screens, one build at a time.', notes: ['currently: this site, a cube that is also a menu', 'reading: signals, shaders, synth design'] },
  { id: 'code', title: 'Code', blurb: 'Tools, systems and experiments that ship.' },
  { id: 'hardware', title: 'Hardware', blurb: 'Boards, firmware and the signals between them.' },
  { id: 'creatives', title: 'Creatives', blurb: 'Edits, motion and sound. The page will one day cut to music.' },
]

export const PROJECTS: Project[] = [
  { section: 'code', title: 'aarcube', year: 2026, blurb: "paper shaders on a Rubik's cube. the cube is the menu, the menu is the cube.", stack: 'react three fiber · paper shaders · gsap', link: { label: 'source', href: 'https://github.com/' } },
  { section: 'code', title: 'small runtime', year: 2025, blurb: 'a language runtime small enough to read in an afternoon.' },
  { section: 'code', title: 'a CLI people use', year: 2025, blurb: 'placeholder: a command line tool that earned its place in a few dotfiles.' },
  { section: 'hardware', title: 'synth voice', year: 2025, blurb: 'a wavetable voice on an FPGA, four oscillators, one very hot chip.' },
  { section: 'hardware', title: 'camera rig', year: 2026, blurb: 'a hand-tracking camera rig that knows which finger is which.' },
  { section: 'hardware', title: 'split keyboard', year: 2024, blurb: 'placeholder: a PCB for a split keyboard, and the firmware to match.' },
  { section: 'creatives', title: 'title sequence', year: 2025, blurb: 'a TouchDesigner title sequence cut to a track nobody has heard yet.' },
  { section: 'creatives', title: 'ascii portrait', year: 2026, blurb: 'a portrait in text that watches back.' },
]

/** the projects of one section, in the order written above */
export const projectsOf = (id: SectionId) => PROJECTS.filter((p) => p.section === id)
