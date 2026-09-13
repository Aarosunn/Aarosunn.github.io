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
  /** a link shown on the project's page inside the section (the tiles are canvas, so it is a real anchor over them) */
  link?: { label: string; href: string }
  /** a small mark after the title on the home page: 'verilog' draws a square wave (there is no official Verilog logo) */
  icon?: 'verilog'
  /** pictures for the page inside the section, paths under public/ (one fills the page's right side; up to six make a grid).
   *  A project with pictures counts as finished: its title on the home page flies straight to its page */
  images?: string[]
}

export const SITE = {
  name: 'aarcube',
  intro: 'Aaron Sun',
  /** the About corner's portrait: an ascii bust for now, a webcam one day */
  portrait: true,
  /** a small notice on the home page (empty string = none); every name in `noticeLinks` that appears in it becomes a link:
   *  a section flies into it, a project flies to its page */
  notice: 'Recently created, still moving in. Check out Creatives for my design portfolio, and Electric Vehicle and Robot Tour under Hardware.',
  noticeLinks: { Creatives: { section: 'creatives' }, 'Electric Vehicle': { section: 'hardware', project: 'Electric Vehicle' }, 'Robot Tour': { section: 'hardware', project: 'Robot Tour' } } as Record<string, { section: SectionId; project?: string }>,
  /** what an unfinished project says when clicked on the home page (the finished ones are listed under it as links) */
  unfinished: 'This page is not written up yet. The finished ones so far:',
  /** the two marks either side of the deck, in the cube's material */
  github: 'https://github.com/Aarosunn',
  linkedin: 'https://linkedin.com/in/aasunn',
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
  { section: 'hardware', title: 'Electric Vehicle', images: ['/media/electric-vehicle.jpg'] },
  { section: 'hardware', title: 'Robot Tour', images: ['/media/robot-tour.jpg'] },
  { section: 'hardware', title: 'Traffic Light Controller', icon: 'verilog' },
  { section: 'hardware', title: 'Sequential Calculator', icon: 'verilog' },
  { section: 'creatives', title: 'Art', images: ['/media/portrait.jpg', '/media/scholastic1.jpg', '/media/oil.jpg', '/media/sculpture.jpg', '/media/sail.jpg', '/media/sketch.jpg'] },
  { section: 'creatives', title: 'Web Design', blurb: 'The Tau Epsilon Kappa site and its rush page.', link: { label: 'tauepsilonkappa.com/rush/FA27', href: 'https://tauepsilonkappa.com/rush/FA27/' }, images: ['/media/tek-rush.jpg'] },
  { section: 'creatives', title: 'Polestar89', images: ['/media/polestar3.jpg', '/media/polestar1.jpg', '/media/polestar2.jpg', '/media/polestar4.jpg'] },
]

/** the projects of one section, in the order written above */
export const projectsOf = (id: SectionId) => PROJECTS.filter((p) => p.section === id)
/** finished = has pictures or a link to show */
export const isDone = (p: Project) => !!p.images?.length || !!p.link
