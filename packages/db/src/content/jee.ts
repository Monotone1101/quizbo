/**
 * JEE Main / Advanced study library: the full syllabus (units → topics) with free resources, plus
 * the official exam links. Every URL was fetched and its page checked for the expected phrase
 * (`check`) — re-run with `npm run resources:check -w @quizbo/db`.
 *
 * Topics that already exist in the question bank keep their questions; this file only adds topics
 * and links. Topics without battle questions still appear in the planner and the library.
 */
import type { SeedResource, SeedSubject, SeedTopic } from "../../prisma/seed-data";

export interface ExamResource {
  title: string;
  description: string;
  url: string;
  source: string;
  /** Phrase expected in the page; `false` when the site can't be reached from build machines. */
  check: string | false;
}

export const EXAM_RESOURCES: ExamResource[] = [
  {
    title: "JEE Main — official site",
    description: "Information bulletin, syllabus, exam dates, admit cards and results from NTA.",
    url: "https://jeemain.nta.nic.in/",
    source: "jeemain.nta.nic.in",
    check: "Joint Entrance Examination",
  },
  {
    title: "National Testing Agency",
    description: "The body that conducts JEE Main — public notices and announcements.",
    url: "https://nta.ac.in/",
    source: "nta.ac.in",
    check: "National Testing Agency",
  },
  {
    title: "JEE Advanced — official site",
    description: "Eligibility, syllabus, schedule and results for the IIT entrance exam.",
    url: "https://jeeadv.ac.in/",
    source: "jeeadv.ac.in",
    check: "JEE (Advanced)",
  },
  {
    title: "JEE Advanced archive — past papers and answer keys",
    description: "Previous years' question papers with official answer keys: the best practice set there is.",
    url: "https://jeeadv.ac.in/archive.html",
    source: "jeeadv.ac.in",
    check: "question paper",
  },
  {
    title: "JoSAA — IIT/NIT seat allocation",
    description: "Counselling, choice filling, and opening and closing ranks after the results.",
    url: "https://josaa.nic.in/",
    source: "josaa.nic.in",
    // Intermittently unreachable from outside India; skipped by the automated check.
    check: false,
  },
  {
    // ncert.nic.in blocks many non-Indian networks, so the automated check can't reach it.
    title: "NCERT textbooks — free chapter-wise PDFs",
    description: "Class 11 and 12 Physics, Chemistry and Maths. JEE Main questions are built on these.",
    url: "https://ncert.nic.in/textbook.php",
    source: "ncert.nic.in",
    check: false,
  },
  {
    title: "HyperPhysics — concept maps for all of physics",
    description: "Linked one-page explanations with formulas; quick to look something up mid-revision.",
    url: "http://hyperphysics.phy-astr.gsu.edu/hbase/hframe.html",
    source: "hyperphysics · gsu.edu",
    check: "HyperPhysics",
  },
];

type Book =
  | "university-physics-volume-1"
  | "university-physics-volume-2"
  | "university-physics-volume-3"
  | "chemistry-2e"
  | "organic-chemistry"
  | "precalculus-2e"
  | "college-algebra-2e"
  | "contemporary-mathematics"
  | "calculus-volume-1"
  | "calculus-volume-2"
  | "calculus-volume-3"
  | "introductory-statistics-2e";

const BOOK: Record<Book, string> = {
  "university-physics-volume-1": "University Physics Vol. 1",
  "university-physics-volume-2": "University Physics Vol. 2",
  "university-physics-volume-3": "University Physics Vol. 3",
  "chemistry-2e": "Chemistry 2e",
  "organic-chemistry": "Organic Chemistry",
  "precalculus-2e": "Precalculus 2e",
  "college-algebra-2e": "College Algebra 2e",
  "contemporary-mathematics": "Contemporary Mathematics",
  "calculus-volume-1": "Calculus Vol. 1",
  "calculus-volume-2": "Calculus Vol. 2",
  "calculus-volume-3": "Calculus Vol. 3",
  "introductory-statistics-2e": "Introductory Statistics 2e",
};

/** An OpenStax chapter or section. `where` is "ch. 3" or "§ 9.6". */
function os(book: Book, page: string, name: string, where: string, check: string = name): SeedResource {
  return { title: `${name} — ${BOOK[book]}, ${where}`, url: `https://openstax.org/books/${book}/pages/${page}`, source: "openstax.org", check };
}

function hp(path: string, title: string, check: string): SeedResource {
  return { title, url: `http://hyperphysics.phy-astr.gsu.edu/hbase/${path}`, source: "hyperphysics · gsu.edu", check };
}

const topic = (name: string, unit: string, resources: SeedResource[]): SeedTopic => ({ name, unit, resources, questions: [] });

const UP1 = "university-physics-volume-1" as const;
const UP2 = "university-physics-volume-2" as const;
const UP3 = "university-physics-volume-3" as const;
const C2E = "chemistry-2e" as const;
const ORG = "organic-chemistry" as const;
const PC = "precalculus-2e" as const;

export interface CurriculumAddition {
  slug: string;
  name: string;
  level: string;
  /** Syllabus order of topic names (existing and new). Empty keeps the order listed. */
  order: string[];
  topics: SeedTopic[];
}

export const JEE_ADDITIONS: CurriculumAddition[] = [
  {
    slug: "physics-12",
    name: "Physics",
    level: "Class 11–12",
    order: [
      "Units and measurements",
      "Kinematics",
      "Laws of motion",
      "Work, energy and power",
      "Rotational motion",
      "Gravitation",
      "Properties of solids and liquids",
      "Thermodynamics",
      "Kinetic theory of gases",
      "Oscillations and waves",
      "Coulomb's law",
      "Electric potential and capacitance",
      "Ohm's law and resistance",
      "Magnetic effects of current and magnetism",
      "Electromagnetic induction and alternating current",
      "Electromagnetic waves",
      "Reflection at plane surfaces",
      "Refraction at plane surfaces",
      "Total internal reflection",
      "Refraction at curved surfaces",
      "Lens formula",
      "Wave optics — interference",
      "Dual nature of matter and radiation",
      "Atoms and nuclei",
      "Semiconductor electronics",
    ],
    topics: [
      topic("Units and measurements", "Mechanics", [os(UP1, "1-introduction", "Units and Measurement", "ch. 1")]),
      topic("Kinematics", "Mechanics", [
        os(UP1, "3-introduction", "Motion Along a Straight Line", "ch. 3"),
        os(UP1, "4-introduction", "Motion in Two and Three Dimensions", "ch. 4"),
      ]),
      topic("Laws of motion", "Mechanics", [
        os(UP1, "5-introduction", "Newton's Laws of Motion", "ch. 5", "Newton"),
        os(UP1, "6-introduction", "Applications of Newton's Laws", "ch. 6", "Applications of Newton"),
      ]),
      topic("Work, energy and power", "Mechanics", [
        os(UP1, "7-introduction", "Work and Kinetic Energy", "ch. 7"),
        os(UP1, "8-introduction", "Potential Energy and Conservation of Energy", "ch. 8"),
        os(UP1, "9-introduction", "Linear Momentum and Collisions", "ch. 9"),
      ]),
      topic("Rotational motion", "Mechanics", [
        os(UP1, "10-introduction", "Fixed-Axis Rotation", "ch. 10"),
        os(UP1, "11-introduction", "Angular Momentum", "ch. 11"),
      ]),
      topic("Gravitation", "Mechanics", [os(UP1, "13-introduction", "Gravitation", "ch. 13")]),
      topic("Properties of solids and liquids", "Properties of matter", [
        os(UP1, "12-introduction", "Static Equilibrium and Elasticity", "ch. 12"),
        os(UP1, "14-introduction", "Fluid Mechanics", "ch. 14"),
      ]),
      topic("Thermodynamics", "Heat and thermodynamics", [
        os(UP2, "1-introduction", "Temperature and Heat", "ch. 1"),
        os(UP2, "3-introduction", "The First Law of Thermodynamics", "ch. 3"),
        os(UP2, "4-introduction", "The Second Law of Thermodynamics", "ch. 4"),
        hp("heacon.html", "Heat and thermodynamics concept map — HyperPhysics", "HyperPhysics"),
      ]),
      topic("Kinetic theory of gases", "Heat and thermodynamics", [
        os(UP2, "2-introduction", "The Kinetic Theory of Gases", "ch. 2"),
      ]),
      topic("Oscillations and waves", "Oscillations and waves", [
        os(UP1, "15-introduction", "Oscillations", "ch. 15"),
        os(UP1, "16-introduction", "Waves", "ch. 16"),
        os(UP1, "17-introduction", "Sound", "ch. 17"),
        hp("Sound/soucon.html", "Sound and hearing concept map — HyperPhysics", "HyperPhysics"),
      ]),
      topic("Coulomb's law", "Electrostatics", [
        os(UP2, "5-introduction", "Electric Charges and Fields", "ch. 5"),
        os(UP2, "6-introduction", "Gauss's Law", "ch. 6", "Gauss"),
        hp("emcon.html", "Electricity and magnetism concept map — HyperPhysics", "HyperPhysics"),
      ]),
      topic("Electric potential and capacitance", "Electrostatics", [
        os(UP2, "7-introduction", "Electric Potential", "ch. 7"),
        os(UP2, "8-introduction", "Capacitance", "ch. 8"),
      ]),
      topic("Ohm's law and resistance", "Current electricity", [
        os(UP2, "9-introduction", "Current and Resistance", "ch. 9"),
        os(UP2, "10-introduction", "Direct-Current Circuits", "ch. 10"),
      ]),
      topic("Magnetic effects of current and magnetism", "Magnetism", [
        os(UP2, "11-introduction", "Magnetic Forces and Fields", "ch. 11"),
        os(UP2, "12-introduction", "Sources of Magnetic Fields", "ch. 12"),
      ]),
      topic("Electromagnetic induction and alternating current", "Magnetism", [
        os(UP2, "13-introduction", "Electromagnetic Induction", "ch. 13"),
        os(UP2, "14-introduction", "Inductance", "ch. 14"),
        os(UP2, "15-introduction", "Alternating-Current Circuits", "ch. 15"),
      ]),
      topic("Electromagnetic waves", "Electromagnetic waves", [
        os(UP2, "16-introduction", "Electromagnetic Waves", "ch. 16"),
      ]),
      topic("Reflection at plane surfaces", "Optics", [
        hp("ligcon.html", "Light and vision concept map — HyperPhysics", "HyperPhysics"),
      ]),
      topic("Lens formula", "Optics", [os(UP3, "2-introduction", "Geometric Optics and Image Formation", "ch. 2")]),
      topic("Wave optics — interference", "Optics", [
        os(UP3, "3-introduction", "Interference", "ch. 3"),
        os(UP3, "4-introduction", "Diffraction", "ch. 4"),
      ]),
      topic("Dual nature of matter and radiation", "Modern physics", [
        os(UP3, "6-introduction", "Photons and Matter Waves", "ch. 6"),
        hp("quacon.html", "Quantum physics concept map — HyperPhysics", "HyperPhysics"),
      ]),
      topic("Atoms and nuclei", "Modern physics", [
        os(UP3, "8-introduction", "Atomic Structure", "ch. 8"),
        os(UP3, "10-introduction", "Nuclear Physics", "ch. 10"),
        hp("nuccon.html", "Nuclear physics concept map — HyperPhysics", "HyperPhysics"),
      ]),
      topic("Semiconductor electronics", "Modern physics", [
        os(UP3, "9-6-semiconductors-and-doping", "Semiconductors and Doping", "§ 9.6"),
        hp("Solids/semcn.html", "Semiconductor concepts — HyperPhysics", "Semiconductor"),
      ]),
    ],
  },
  {
    slug: "chemistry-12",
    name: "Chemistry",
    level: "Class 11–12",
    order: [],
    topics: [
      topic("Some basic concepts of chemistry", "Physical chemistry", [
        os(C2E, "1-introduction", "Essential Ideas", "ch. 1"),
        os(C2E, "3-introduction", "Composition of Substances and Solutions", "ch. 3"),
        os(C2E, "4-introduction", "Stoichiometry of Chemical Reactions", "ch. 4"),
      ]),
      topic("Atomic structure", "Physical chemistry", [
        os(C2E, "6-introduction", "Electronic Structure and Periodic Properties of Elements", "ch. 6", "Electronic Structure"),
      ]),
      topic("Chemical bonding and molecular structure", "Physical chemistry", [
        os(C2E, "7-introduction", "Chemical Bonding and Molecular Geometry", "ch. 7"),
        os(C2E, "8-introduction", "Advanced Theories of Covalent Bonding", "ch. 8"),
      ]),
      topic("Chemical thermodynamics", "Physical chemistry", [
        os(C2E, "5-introduction", "Thermochemistry", "ch. 5"),
        os(C2E, "16-introduction", "Thermodynamics", "ch. 16"),
      ]),
      topic("Solutions", "Physical chemistry", [os(C2E, "11-introduction", "Solutions and Colloids", "ch. 11")]),
      topic("Equilibrium", "Physical chemistry", [
        os(C2E, "13-introduction", "Fundamental Equilibrium Concepts", "ch. 13"),
        os(C2E, "14-introduction", "Acid-Base Equilibria", "ch. 14"),
        os(C2E, "15-introduction", "Equilibria of Other Reaction Classes", "ch. 15"),
      ]),
      topic("Redox reactions and electrochemistry", "Physical chemistry", [os(C2E, "17-introduction", "Electrochemistry", "ch. 17")]),
      topic("Chemical kinetics", "Physical chemistry", [os(C2E, "12-introduction", "Kinetics", "ch. 12")]),
      topic("Classification of elements and periodicity", "Inorganic chemistry", [
        os(C2E, "6-5-periodic-variations-in-element-properties", "Periodic Variations in Element Properties", "§ 6.5"),
      ]),
      topic("p-block elements", "Inorganic chemistry", [
        os(C2E, "18-introduction", "Representative Metals, Metalloids, and Nonmetals", "ch. 18", "Representative Metals"),
      ]),
      topic("d- and f-block elements", "Inorganic chemistry", [
        os(C2E, "19-introduction", "Transition Metals and Coordination Chemistry", "ch. 19"),
      ]),
      topic("Coordination compounds", "Inorganic chemistry", [
        os(C2E, "19-2-coordination-chemistry-of-transition-metals", "Coordination Chemistry of Transition Metals", "§ 19.2"),
      ]),
      topic("Basic principles of organic chemistry", "Organic chemistry", [
        os(ORG, "1-why-this-chapter", "Structure and Bonding", "ch. 1"),
        os(C2E, "20-introduction", "Organic Chemistry", "ch. 20"),
      ]),
      topic("Purification and characterisation of organic compounds", "Organic chemistry", [
        os(ORG, "12-why-this-chapter", "Mass Spectrometry and Infrared Spectroscopy", "ch. 12", "Mass Spectrometry"),
      ]),
      topic("Hydrocarbons", "Organic chemistry", [
        os(ORG, "3-why-this-chapter", "Alkanes", "ch. 3"),
        os(ORG, "7-why-this-chapter", "Alkenes", "ch. 7"),
        os(ORG, "9-why-this-chapter", "Alkynes", "ch. 9"),
        os(ORG, "15-why-this-chapter", "Benzene and Aromaticity", "ch. 15", "Aromaticity"),
      ]),
      topic("Organic compounds containing halogens", "Organic chemistry", [os(ORG, "10-why-this-chapter", "Organohalides", "ch. 10")]),
      topic("Organic compounds containing oxygen", "Organic chemistry", [
        os(ORG, "17-why-this-chapter", "Alcohols and Phenols", "ch. 17"),
        os(ORG, "19-why-this-chapter", "Aldehydes and Ketones", "ch. 19"),
        os(ORG, "20-why-this-chapter", "Carboxylic Acids and Nitriles", "ch. 20", "Carboxylic Acids"),
      ]),
      topic("Organic compounds containing nitrogen", "Organic chemistry", [
        os(ORG, "24-why-this-chapter", "Amines and Heterocycles", "ch. 24", "Amines"),
      ]),
      topic("Biomolecules", "Organic chemistry", [
        os(ORG, "25-why-this-chapter", "Carbohydrates", "ch. 25"),
        os(ORG, "26-why-this-chapter", "Amino Acids, Peptides, and Proteins", "ch. 26", "Amino Acids"),
      ]),
    ],
  },
  {
    slug: "maths-12",
    name: "Maths",
    level: "Class 11–12",
    order: [
      "Sets, relations and functions",
      "Complex numbers",
      "Quadratics",
      "Inequalities",
      "Matrices and determinants",
      "Permutations and combinations",
      "Binomial theorem",
      "Sequences and series",
      "Limits, continuity and differentiability",
      "Derivatives",
      "Integrals",
      "Differential equations",
      "Straight lines and circles",
      "Conic sections",
      "Vector algebra",
      "Three-dimensional geometry",
      "Statistics",
      "Probability",
      "Trigonometry",
    ],
    topics: [
      topic("Sets, relations and functions", "Algebra", [
        os("contemporary-mathematics", "1-introduction", "Sets", "ch. 1"),
        os(PC, "1-introduction-to-functions", "Functions", "ch. 1"),
      ]),
      topic("Complex numbers", "Algebra", [os("college-algebra-2e", "2-4-complex-numbers", "Complex Numbers", "§ 2.4")]),
      topic("Matrices and determinants", "Algebra", [
        os(PC, "9-5-matrices-and-matrix-operations", "Matrices and Matrix Operations", "§ 9.5"),
        os(PC, "9-8-solving-systems-with-cramers-rule", "Solving Systems with Cramer's Rule", "§ 9.8", "Cramer"),
      ]),
      topic("Permutations and combinations", "Algebra", [os(PC, "11-5-counting-principles", "Counting Principles", "§ 11.5")]),
      topic("Binomial theorem", "Algebra", [os(PC, "11-6-binomial-theorem", "Binomial Theorem", "§ 11.6")]),
      topic("Sequences and series", "Algebra", [
        os(PC, "11-1-sequences-and-their-notations", "Sequences and Their Notations", "§ 11.1"),
        os(PC, "11-2-arithmetic-sequences", "Arithmetic Sequences", "§ 11.2"),
        os(PC, "11-3-geometric-sequences", "Geometric Sequences", "§ 11.3"),
      ]),
      topic("Limits, continuity and differentiability", "Calculus", [os("calculus-volume-1", "2-introduction", "Limits", "ch. 2")]),
      topic("Derivatives", "Calculus", [os("calculus-volume-1", "3-introduction", "Derivatives", "ch. 3")]),
      topic("Integrals", "Calculus", [os("calculus-volume-1", "5-introduction", "Integration", "ch. 5")]),
      topic("Differential equations", "Calculus", [
        os("calculus-volume-2", "4-introduction", "Introduction to Differential Equations", "ch. 4", "Differential Equations"),
      ]),
      topic("Straight lines and circles", "Coordinate geometry", [
        os(PC, "2-2-graphs-of-linear-functions", "Graphs of Linear Functions", "§ 2.2"),
        os(PC, "2-introduction-to-linear-functions", "Linear Functions", "ch. 2"),
      ]),
      topic("Conic sections", "Coordinate geometry", [
        os(PC, "10-introduction-to-analytic-geometry", "Analytic Geometry", "ch. 10"),
        os(PC, "10-1-the-ellipse", "The Ellipse", "§ 10.1", "Ellipse"),
        os(PC, "10-3-the-parabola", "The Parabola", "§ 10.3", "Parabola"),
      ]),
      topic("Vector algebra", "Vectors and 3D geometry", [
        os(PC, "8-8-vectors", "Vectors", "§ 8.8"),
        os("calculus-volume-3", "2-introduction", "Vectors in Space", "ch. 2"),
      ]),
      topic("Three-dimensional geometry", "Vectors and 3D geometry", [
        os("calculus-volume-3", "2-5-equations-of-lines-and-planes-in-space", "Equations of Lines and Planes in Space", "§ 2.5"),
      ]),
      topic("Statistics", "Statistics and probability", [
        os("introductory-statistics-2e", "2-introduction", "Descriptive Statistics", "ch. 2"),
      ]),
      topic("Probability", "Statistics and probability", [
        os("introductory-statistics-2e", "3-introduction", "Probability Topics", "ch. 3"),
        os(PC, "11-7-probability", "Probability", "§ 11.7"),
      ]),
      topic("Trigonometry", "Trigonometry", [
        os(PC, "5-introduction-to-trigonometric-functions", "Trigonometric Functions", "ch. 5"),
        os(PC, "7-introduction-to-trigonometric-identities-and-equations", "Trigonometric Identities and Equations", "ch. 7", "Trigonometric Identities"),
      ]),
    ],
  },
];

/**
 * Merges the JEE additions into the base seed: new subjects and topics are appended, existing
 * topics keep their questions and gain links (deduplicated by URL), and topics follow syllabus order.
 */
export function mergeCurriculum(base: SeedSubject[], additions: CurriculumAddition[] = JEE_ADDITIONS): SeedSubject[] {
  const subjects: SeedSubject[] = base.map((s) => ({
    ...s,
    topics: s.topics.map((t) => ({ ...t, resources: [...t.resources] })),
  }));
  for (const addition of additions) {
    let subject = subjects.find((s) => s.slug === addition.slug);
    if (!subject) {
      subject = { slug: addition.slug, name: addition.name, level: addition.level, topics: [] };
      subjects.push(subject);
    }
    subject.level = addition.level;
    for (const extra of addition.topics) {
      const existing = subject.topics.find((t) => t.name === extra.name);
      if (!existing) {
        subject.topics.push({ ...extra, resources: [...extra.resources] });
        continue;
      }
      for (const resource of extra.resources) {
        if (!existing.resources.some((r) => r.url === resource.url)) existing.resources.push(resource);
      }
    }
    if (addition.order.length) {
      const rank = (name: string) => {
        const index = addition.order.indexOf(name);
        return index === -1 ? addition.order.length : index;
      };
      subject.topics = subject.topics
        .map((t, i) => ({ t, i }))
        .sort((a, b) => rank(a.t.name) - rank(b.t.name) || a.i - b.i)
        .map(({ t }) => t);
    }
  }
  return subjects;
}
