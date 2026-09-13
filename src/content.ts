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
  /** plain lines listed above the section's projects */
  notes?: string[]
}

export type Project = {
  /** which section lists it */
  section: SectionId
  title: string
  year?: number | string
  /** one or two sentences: the page inside the section shows this under the title */
  blurb?: string
  /** the detail panel on the home page (optional, falls back to the blurb) */
  detail?: string
  /** what it is built with, shown on the detail panel */
  stack?: string
  /** a link the detail panel offers */
  link?: { label: string; href: string }
  /** a small mark after the title on the home page: 'verilog' draws a square wave (there is no official Verilog logo) */
  icon?: 'verilog'
}

export const SITE = {
  name: 'aarcube',
  intro: 'Aaron Sun',
  /** the About corner's portrait: an ascii bust for now, a webcam one day */
  portrait: true,
  /** a small notice on the home page (empty string = none); the section named in `noticeLink` is a link into it */
  notice: 'Recently created, still moving in. Check out Creatives for my design portfolio.',
  noticeLink: 'creatives' as SectionId,
}

export const SECTIONS: Section[] = [
  { id: 'about', title: 'About', blurb: 'Undergraduate Computer Engineering student at the University of Michigan.' },
  { id: 'code', title: 'Code', blurb: 'Projects I\u2019ve worked on.' },
  { id: 'hardware', title: 'Hardware', blurb: 'Physical engineering projects.' },
  { id: 'creatives', title: 'Creatives', blurb: 'Art pieces, designs and various other passions.' },
]

export const PROJECTS: Project[] = [
  // about: where Aaron has worked, newest first (titles first)
  { section: 'about', title: 'Jaseci' },
  { section: 'about', title: 'CLAWS' },
  { section: 'about', title: 'Algoverse' },
  { section: 'about', title: 'Thinkneuro' },
  { section: 'about', title: 'ELISA Labs' },
  { section: 'about', title: 'InspiritAI' },
  { section: 'about', title: 'Shiga-Michigan Program' },
  // code, in Aaron's order (titles first; years, blurbs and links to come)
  { section: 'code', title: 'Conduit' },
  { section: 'code', title: 'Tokenizer in C' },
  { section: 'code', title: 'GhostWatch' },
  { section: 'code', title: 'Clerse' },
  { section: 'code', title: 'ConceptPilot' },
  { section: 'code', title: 'Cache Simulator' },
  { section: 'code', title: 'Linker' },
  { section: 'code', title: 'Database from Scratch' },
  { section: 'code', title: 'Zombie Shooter' },
  { section: 'code', title: 'Text Editor' },
  { section: 'code', title: 'Scioly+' },
  { section: 'code', title: 'Euchre' },
  { section: 'code', title: 'Gradient Descent Visualizer' },
  { section: 'hardware', title: 'Electric Vehicle' },
  { section: 'hardware', title: 'Traffic Light Controller', icon: 'verilog' },
  { section: 'hardware', title: 'Sequential Calculator', icon: 'verilog' },
  { section: 'hardware', title: 'Robot Tour' },
  { section: 'hardware', title: 'Air Trajectory' },
  { section: 'hardware', title: 'Surprise' },
  { section: 'creatives', title: 'Art' },
  { section: 'creatives', title: 'Web Design' },
  { section: 'creatives', title: 'Polestar89' },
]

/** the projects of one section, in the order written above */
export const projectsOf = (id: SectionId) => PROJECTS.filter((p) => p.section === id)
