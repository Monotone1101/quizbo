/**
 * Seed curriculum and question bank.
 *
 * These questions were written by hand during development and every answer key was worked through,
 * but they have NOT yet had an educator's spot-check. Before launch, have a teacher review them (or
 * re-run them through the validation pass: `npm run questions:pipeline -- validate --source seed`).
 * Only rows with `validated = true` are ever served in a battle.
 */
export type Level = "EASY" | "MEDIUM" | "HARD";

export interface SeedQuestion {
  text: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  rationale: string;
  difficulty: Level;
}

export interface SeedResource {
  title: string;
  url: string;
  source: string;
  /** Phrase the page must contain for `resources:check` (default: title before " — "); false skips it. */
  check?: string | false;
}

export interface SeedTopic {
  name: string;
  unit: string;
  questions: SeedQuestion[];
  resources: SeedResource[];
}

export interface SeedSubject {
  slug: string;
  name: string;
  level: string;
  topics: SeedTopic[];
}

const q = (
  difficulty: Level,
  text: string,
  options: [string, string, string, string],
  correct: 0 | 1 | 2 | 3,
  rationale: string,
): SeedQuestion => ({ text, options, correct, rationale, difficulty });

export const CURRICULUM: SeedSubject[] = [
  {
    slug: "physics-12",
    name: "Physics",
    level: "Class 12",
    topics: [
      {
        name: "Reflection at plane surfaces",
        unit: "Optics",
        resources: [
          {
            title: "Images formed by plane mirrors",
            url: "https://openstax.org/books/university-physics-volume-3/pages/2-1-images-formed-by-plane-mirrors",
            source: "openstax.org",
          },
          { title: "Reflection and the ray model of light", url: "https://www.physicsclassroom.com/class/refln", source: "physicsclassroom.com" },
        ],
        questions: [
          q("EASY", "A ray strikes a plane mirror with an angle of incidence of 35°. What is the angle between the incident ray and the reflected ray?", ["35°", "55°", "70°", "110°"], 2, "Angle of reflection equals angle of incidence, so the rays are 35° + 35° = 70° apart."),
          q("MEDIUM", "You walk towards a plane mirror at 1.5 m/s. How fast does your image approach you?", ["0.75 m/s", "1.5 m/s", "3 m/s", "6 m/s"], 2, "The image moves towards the mirror at 1.5 m/s from the other side, so the gap closes at 1.5 + 1.5 = 3 m/s."),
          q("MEDIUM", "What is the minimum length of a vertical plane mirror in which a person 1.8 m tall can see their full height?", ["0.45 m", "0.9 m", "1.2 m", "1.8 m"], 1, "Rays from head and feet reflect at points halfway to the eyes, so a mirror half the person's height (0.9 m) is enough."),
          q("MEDIUM", "A plane mirror is rotated by 10° while the incident ray stays fixed. Through what angle does the reflected ray turn?", ["5°", "10°", "20°", "40°"], 2, "Rotating the mirror by θ changes both incidence and reflection angles by θ, so the reflected ray turns by 2θ = 20°."),
          q("MEDIUM", "Two plane mirrors are inclined at 60° to each other. How many images of an object placed between them are formed?", ["4", "5", "6", "7"], 1, "360°/60° = 6 is even, so the number of images is 6 − 1 = 5."),
          q("EASY", "Which description fits the image formed by a plane mirror?", ["Real, inverted and the same size", "Virtual, erect, the same size and laterally inverted", "Virtual, erect and magnified", "Real, erect and diminished"], 1, "A plane mirror forms a virtual, upright image of the same size, with left and right swapped."),
        ],
      },
      {
        name: "Refraction at plane surfaces",
        unit: "Optics",
        resources: [
          { title: "Refraction and Snell's law", url: "https://openstax.org/books/university-physics-volume-3/pages/1-3-refraction", source: "openstax.org" },
          { title: "Refraction and the ray model of light", url: "https://www.physicsclassroom.com/class/refrn", source: "physicsclassroom.com" },
        ],
        questions: [
          q("EASY", "Light passes from air into glass of refractive index 1.5. Its speed in the glass is closest to:", ["4.5 × 10⁸ m/s", "3.0 × 10⁸ m/s", "2.0 × 10⁸ m/s", "1.5 × 10⁸ m/s"], 2, "v = c/n = (3.0 × 10⁸)/1.5 = 2.0 × 10⁸ m/s."),
          q("EASY", "A ray travels from water (n = 1.33) into air. Compared with the angle of incidence, the angle of refraction is:", ["Smaller", "Equal", "Larger", "Always 90°"], 2, "Going into a less optically dense medium, the ray bends away from the normal, so the refraction angle is larger."),
          q("MEDIUM", "A coin lies at the bottom of a beaker filled with water (n = 4/3) to a depth of 12 cm. Viewed from directly above, how deep does it appear?", ["16 cm", "12 cm", "9 cm", "8 cm"], 2, "Apparent depth = real depth / n = 12 ÷ (4/3) = 9 cm."),
          q("EASY", "Which property of light does NOT change when it passes from air into glass?", ["Speed", "Wavelength", "Frequency", "Direction of an oblique ray"], 2, "Frequency is set by the source; speed and wavelength both drop in glass."),
          q("MEDIUM", "Light goes from medium A (n = 1.2) into medium B (n = 1.6) with an angle of incidence of 30°. What is sin r?", ["0.375", "0.500", "0.667", "0.800"], 0, "Snell's law: 1.2 × sin 30° = 1.6 × sin r, so sin r = 0.6/1.6 = 0.375."),
          q("EASY", "A ray passes obliquely through a rectangular glass slab. The emergent ray is:", ["Parallel to the incident ray but shifted sideways", "Perpendicular to the incident ray", "Brought to a focus", "Totally internally reflected"], 0, "Refraction at the two parallel faces cancels in direction, leaving only a lateral shift."),
        ],
      },
      {
        name: "Total internal reflection",
        unit: "Optics",
        resources: [
          { title: "Total internal reflection", url: "https://openstax.org/books/university-physics-volume-3/pages/1-4-total-internal-reflection", source: "openstax.org" },
        ],
        questions: [
          q("EASY", "Total internal reflection can occur when light travels:", ["From air into water", "From glass into air", "From air into glass", "From vacuum into diamond"], 1, "It needs light heading from a denser medium into a less dense one, such as glass into air."),
          q("EASY", "The critical angle at a glass–air boundary is 42°. A ray inside the glass meets the boundary at 50°. What happens?", ["It refracts into the air, bending away from the normal", "It is totally internally reflected back into the glass", "It travels along the boundary", "It splits into reflected and refracted rays of equal intensity"], 1, "The angle of incidence exceeds the critical angle, so no refracted ray exists and all light reflects."),
          q("MEDIUM", "What is the critical angle, in air, for a material of refractive index √2?", ["30°", "45°", "60°", "90°"], 1, "sin C = 1/n = 1/√2, so C = 45°."),
          q("HARD", "A ray travels inside glass (n = 1.5) towards a boundary with water (n = 1.33). The critical angle is closest to:", ["42°", "49°", "62°", "90°"], 2, "sin C = n_water / n_glass = 1.33/1.5 ≈ 0.887, so C ≈ 62°."),
          q("EASY", "Optical fibres carry light over long distances mainly by:", ["Refraction at the outer plastic coating", "Total internal reflection at the core–cladding boundary", "Diffraction around the bends", "Absorption and re-emission"], 1, "The core has a higher refractive index than the cladding, so rays hitting the boundary beyond the critical angle stay trapped."),
          q("MEDIUM", "Diamond (n ≈ 2.42) sparkles more than glass (n ≈ 1.5) mainly because its critical angle is:", ["Larger, so less light escapes", "Smaller, so more light is totally internally reflected", "The same as glass", "Exactly 90°"], 1, "A higher n gives a smaller critical angle (about 24°), so light reflects many times inside before leaving."),
        ],
      },
      {
        name: "Refraction at curved surfaces",
        unit: "Optics",
        resources: [
          { title: "Images formed by refraction", url: "https://openstax.org/books/university-physics-volume-3/pages/2-3-images-formed-by-refraction", source: "openstax.org" },
        ],
        questions: [
          q("EASY", "For refraction at a single spherical surface, which relation is correct in the Cartesian sign convention?", ["n₂/v − n₁/u = (n₂ − n₁)/R", "n₁/v + n₂/u = (n₁ + n₂)/R", "1/v − 1/u = 1/f", "n₂/u − n₁/v = (n₁ − n₂)/R"], 0, "With distances measured from the pole and light travelling from medium n₁ into n₂: n₂/v − n₁/u = (n₂ − n₁)/R."),
          q("EASY", "In the Cartesian sign convention, a concave surface facing the incoming light has a radius of curvature that is:", ["Positive", "Negative", "Zero", "Infinite"], 1, "Its centre of curvature lies on the side the light comes from, against the direction of incident light, so R is negative."),
          q("EASY", "In the Cartesian sign convention, why is the distance u of a real object negative?", ["It lies on the side the light comes from, against the direction of the incident light", "All distances in optics are negative", "Because the surface is always concave", "Because light slows down in glass"], 0, "Distances measured against the direction of incident light are negative, and a real object sits on the incoming side."),
          q("HARD", "An object in air is 60 cm in front of a convex glass surface (n = 1.5) of radius 20 cm. Where is the image?", ["+180 cm, inside the glass", "+60 cm, inside the glass", "−90 cm, in front of the surface", "+36 cm, inside the glass"], 0, "1.5/v − 1/(−60) = 0.5/20 gives 1.5/v = 1/120, so v = +180 cm."),
          q("HARD", "An object in air is 30 cm from a concave glass surface (n = 1.5) of radius 30 cm, facing the light. Where is the image?", ["−30 cm, virtual, on the object's side", "+30 cm, real, inside the glass", "−60 cm, virtual, on the object's side", "+90 cm, real, inside the glass"], 0, "With u = −30 and R = −30: 1.5/v + 1/30 = 0.5/(−30), so 1.5/v = −1/20 and v = −30 cm."),
          q("HARD", "Parallel rays in air strike a convex glass surface (n = 1.5) of radius R. Considering this one surface only, how far inside the glass do they converge?", ["R", "1.5R", "2R", "3R"], 3, "With u = ∞: 1.5/v = 0.5/R, so v = 3R."),
        ],
      },
      {
        name: "Lens formula",
        unit: "Optics",
        resources: [
          { title: "Thin lenses and the lens equation", url: "https://openstax.org/books/university-physics-volume-3/pages/2-4-thin-lenses", source: "openstax.org" },
        ],
        questions: [
          q("MEDIUM", "An object is 30 cm in front of a convex lens of focal length 20 cm. Where is the image formed?", ["+60 cm, behind the lens", "+12 cm, behind the lens", "−60 cm, in front of the lens", "+50 cm, behind the lens"], 0, "1/v − 1/u = 1/f gives 1/v = 1/20 − 1/30 = 1/60, so v = +60 cm."),
          q("MEDIUM", "A 2 cm tall object 30 cm from a convex lens forms an image 60 cm behind the lens. The image is:", ["4 cm tall and inverted", "4 cm tall and erect", "1 cm tall and inverted", "2 cm tall and erect"], 0, "m = v/u = 60/(−30) = −2, so the image is twice the size (4 cm) and inverted."),
          q("EASY", "A lens has a power of −2.5 D. It is a:", ["Concave lens of focal length 40 cm", "Convex lens of focal length 40 cm", "Concave lens of focal length 25 cm", "Convex lens of focal length 25 cm"], 0, "f = 1/P = 1/(−2.5) m = −0.4 m. Negative power means a diverging (concave) lens."),
          q("MEDIUM", "Thin lenses of focal lengths +20 cm and −30 cm are placed in contact. The focal length of the combination is:", ["+60 cm", "−10 cm", "+12 cm", "−60 cm"], 0, "1/F = 1/20 − 1/30 = 1/60, so F = +60 cm (converging)."),
          q("MEDIUM", "An object is 10 cm from a convex lens of focal length 15 cm. The image is:", ["Virtual, erect and magnified, 30 cm on the object's side", "Real, inverted and 30 cm behind the lens", "Virtual, erect and diminished, 6 cm from the lens", "Formed at infinity"], 0, "1/v = 1/15 − 1/10 = −1/30, so v = −30 cm and m = v/u = 3: a magnified virtual image, as in a magnifying glass."),
          q("HARD", "A biconvex lens with both radii 20 cm is made of glass of refractive index 1.5. Its focal length is:", ["10 cm", "20 cm", "40 cm", "60 cm"], 1, "Lensmaker's equation: 1/f = (1.5 − 1)(1/20 − 1/(−20)) = 0.5 × 2/20 = 1/20, so f = 20 cm."),
        ],
      },
      {
        name: "Wave optics — interference",
        unit: "Optics",
        resources: [
          { title: "Young's double-slit interference", url: "https://openstax.org/books/university-physics-volume-3/pages/3-1-youngs-double-slit-interference", source: "openstax.org" },
        ],
        questions: [
          q("EASY", "In Young's double-slit experiment the fringe width is β = λD/d. If the slit separation d is doubled, the fringe width:", ["Halves", "Doubles", "Stays the same", "Quadruples"], 0, "β is inversely proportional to d."),
          q("MEDIUM", "Light of wavelength 600 nm falls on slits 0.30 mm apart, with the screen 1.5 m away. What is the fringe width?", ["0.3 mm", "3.0 mm", "1.2 mm", "6.0 mm"], 1, "β = λD/d = (600 × 10⁻⁹ × 1.5)/(0.30 × 10⁻³) = 3.0 × 10⁻³ m."),
          q("EASY", "Constructive interference occurs where the path difference between the two waves is:", ["nλ", "(n + ½)λ", "λ/4", "Zero only"], 0, "Whole-wavelength path differences bring crests together; zero is just the n = 0 case."),
          q("EASY", "A sustained interference pattern requires the two light sources to be:", ["Coherent, with a constant phase difference", "Of different frequencies", "Independent and unpolarised", "As bright as possible"], 0, "Only a constant phase relationship keeps bright and dark fringes fixed in place."),
          q("MEDIUM", "The whole double-slit apparatus is immersed in water (n = 4/3). The fringe width becomes:", ["3/4 of its value in air", "4/3 of its value in air", "Unchanged", "Zero"], 0, "The wavelength in water is λ/n, and β ∝ λ, so the fringes shrink by a factor of 3/4."),
          q("MEDIUM", "Two coherent waves of equal amplitude, each alone giving intensity I₀, meet in phase. The resulting intensity is:", ["4I₀", "2I₀", "I₀", "0"], 0, "Amplitudes add to 2A, and intensity ∝ amplitude², so the intensity is 4I₀."),
        ],
      },
      {
        name: "Coulomb's law",
        unit: "Electrostatics",
        resources: [
          { title: "Coulomb's law", url: "https://openstax.org/books/university-physics-volume-2/pages/5-3-coulombs-law", source: "openstax.org" },
        ],
        questions: [
          q("EASY", "The distance between two point charges is halved. The electrostatic force between them becomes:", ["4 times as large", "2 times as large", "Half as large", "A quarter as large"], 0, "F ∝ 1/r², so halving r multiplies F by 4."),
          q("MEDIUM", "Charges of +2 µC and +8 µC are 30 cm apart in vacuum. What is the force between them? (k = 9 × 10⁹ N m²/C²)", ["1.6 N", "0.16 N", "4.8 N", "16 N"], 0, "F = k q₁q₂/r² = 9 × 10⁹ × 2 × 10⁻⁶ × 8 × 10⁻⁶ / 0.09 = 1.6 N."),
          q("MEDIUM", "Charges +q and +4q are a distance d apart. Where on the line between them is the electric field zero?", ["At d/3 from +q", "At d/2 from +q", "At 2d/3 from +q", "Nowhere between them"], 0, "kq/x² = 4kq/(d − x)² gives d − x = 2x, so x = d/3 from the smaller charge."),
          q("EASY", "The SI unit of electric field strength is:", ["N/C", "C/N", "N·m", "J/C²"], 0, "E = F/q, so it is measured in newtons per coulomb (equivalently V/m)."),
          q("EASY", "Two charges are moved from vacuum into a medium of dielectric constant K = 4 at the same separation. The force between them becomes:", ["A quarter as large", "4 times as large", "Unchanged", "16 times as large"], 0, "In a dielectric, F = kq₁q₂/(Kr²), so the force is divided by K."),
          q("EASY", "Which statement about electric field lines is true?", ["They never cross each other", "They form closed loops around charges", "They start on negative charges and end on positive charges", "They cross where the field is strong"], 0, "The field has one direction at each point, so lines cannot cross; they run from positive to negative charges."),
        ],
      },
      {
        name: "Ohm's law and resistance",
        unit: "Current electricity",
        resources: [
          { title: "Ohm's law", url: "https://openstax.org/books/university-physics-volume-2/pages/9-4-ohms-law", source: "openstax.org" },
        ],
        questions: [
          q("EASY", "A 12 V battery drives current through a 4 Ω resistor. The current is:", ["3 A", "48 A", "0.33 A", "16 A"], 0, "I = V/R = 12/4 = 3 A."),
          q("EASY", "Three 6 Ω resistors are connected in parallel. The equivalent resistance is:", ["2 Ω", "18 Ω", "3 Ω", "6 Ω"], 0, "1/R = 3 × (1/6) = 1/2, so R = 2 Ω."),
          q("MEDIUM", "A wire is stretched to twice its length while its volume stays constant. Its resistance becomes:", ["4 times as large", "2 times as large", "Half as large", "Unchanged"], 0, "Length doubles and the cross-section halves, and R = ρL/A, so R rises by a factor of 4."),
          q("MEDIUM", "A cell of emf 2 V and internal resistance 0.5 Ω is connected across a 3.5 Ω resistor. What is the terminal voltage?", ["2.0 V", "1.75 V", "1.5 V", "0.25 V"], 1, "I = 2/(3.5 + 0.5) = 0.5 A, so V = IR = 0.5 × 3.5 = 1.75 V."),
          q("EASY", "What power is dissipated in a 10 Ω resistor carrying 2 A?", ["40 W", "20 W", "5 W", "400 W"], 0, "P = I²R = 4 × 10 = 40 W."),
          q("EASY", "Kirchhoff's junction rule is a consequence of the conservation of:", ["Charge", "Energy", "Momentum", "Mass"], 0, "Charge cannot pile up at a junction, so current in equals current out."),
        ],
      },
    ],
  },
  {
    slug: "maths-12",
    name: "Maths",
    level: "Class 12",
    topics: [
      {
        name: "Inequalities",
        unit: "Algebra",
        resources: [
          {
            title: "Linear inequalities and absolute value inequalities",
            url: "https://openstax.org/books/college-algebra-2e/pages/2-7-linear-inequalities-and-absolute-value-inequalities",
            source: "openstax.org",
          },
        ],
        questions: [
          q("EASY", "Solve −3x > 12.", ["x < −4", "x > −4", "x < 4", "x > 4"], 0, "Dividing both sides by −3 reverses the inequality: x < −4."),
          q("MEDIUM", "Solve |x − 2| < 3.", ["−1 < x < 5", "x < 5", "−5 < x < 1", "x > −1"], 0, "−3 < x − 2 < 3, so −1 < x < 5."),
          q("MEDIUM", "What is the solution set of (x − 1)(x + 3) ≤ 0?", ["−3 ≤ x ≤ 1", "x ≤ −3 or x ≥ 1", "−1 ≤ x ≤ 3", "x ≥ 1"], 0, "The product is non-positive between the roots −3 and 1, endpoints included."),
          q("MEDIUM", "If a < b, which of these must be true?", ["−a > −b", "a² < b²", "1/a > 1/b", "ac < bc for every real c"], 0, "Multiplying by −1 flips the sign. The others fail for negative numbers or for c ≤ 0."),
          q("HARD", "Solve (2x − 1)/(x + 2) > 0.", ["x < −2 or x > 1/2", "−2 < x < 1/2", "x > 1/2 only", "x > −2"], 0, "The critical points are −2 and 1/2; the quotient is positive outside the interval between them."),
          q("MEDIUM", "How many integers satisfy x² < 10?", ["3", "6", "7", "9"], 2, "x can be −3, −2, −1, 0, 1, 2, 3, because 4² = 16 is too big. That is 7 integers."),
        ],
      },
      {
        name: "Quadratics",
        unit: "Algebra",
        resources: [
          { title: "Quadratic equations", url: "https://openstax.org/books/college-algebra-2e/pages/2-5-quadratic-equations", source: "openstax.org" },
        ],
        questions: [
          q("EASY", "The roots of x² − 5x + 6 = 0 are:", ["2 and 3", "−2 and −3", "1 and 6", "−1 and 6"], 0, "x² − 5x + 6 = (x − 2)(x − 3)."),
          q("MEDIUM", "For which positive value of k does x² + kx + 9 = 0 have equal roots?", ["3", "6", "9", "18"], 1, "Equal roots need a zero discriminant: k² − 36 = 0, so k = 6."),
          q("EASY", "If α and β are the roots of 2x² − 7x + 3 = 0, then α + β and αβ are:", ["7/2 and 3/2", "−7/2 and 3/2", "7 and 3", "3/2 and 7/2"], 0, "Sum = −b/a = 7/2 and product = c/a = 3/2."),
          q("MEDIUM", "What does the discriminant tell you about 3x² + 2x + 1 = 0?", ["It is −8, so there are no real roots", "It is 8, so there are two distinct real roots", "It is 0, so the roots are equal", "It is −8, so there are two equal real roots"], 0, "b² − 4ac = 4 − 12 = −8 < 0, so there are no real roots."),
          q("MEDIUM", "The minimum value of x² − 6x + 13 is:", ["3", "4", "13", "−9"], 1, "Completing the square: (x − 3)² + 4, which is smallest (4) at x = 3."),
          q("EASY", "One root of x² − px + 8 = 0 is 2. What are the other root and p?", ["Other root 4, p = 6", "Other root 4, p = −6", "Other root −4, p = −2", "Other root 6, p = 8"], 0, "Product of roots = 8, so the other root is 4; p = sum of roots = 6."),
        ],
      },
      {
        name: "Derivatives",
        unit: "Calculus",
        resources: [
          { title: "Differentiation rules", url: "https://openstax.org/books/calculus-volume-1/pages/3-3-differentiation-rules", source: "openstax.org" },
          {
            title: "Derivatives of exponential and logarithmic functions",
            url: "https://openstax.org/books/calculus-volume-1/pages/3-9-derivatives-of-exponential-and-logarithmic-functions",
            source: "openstax.org",
          },
        ],
        questions: [
          q("EASY", "d/dx (x³) =", ["3x²", "x²", "3x³", "x⁴/4"], 0, "Power rule: d/dx xⁿ = n xⁿ⁻¹."),
          q("MEDIUM", "d/dx (sin x · cos x) =", ["cos 2x", "sin 2x", "−sin 2x", "1"], 0, "Product rule gives cos²x − sin²x, which equals cos 2x."),
          q("EASY", "What is the slope of y = x² − 4x at x = 3?", ["2", "−3", "6", "5"], 0, "dy/dx = 2x − 4, which is 2 at x = 3."),
          q("EASY", "d/dx (e²ˣ) =", ["2e²ˣ", "e²ˣ", "2x·e²ˣ⁻¹", "e²ˣ/2"], 0, "Chain rule: the derivative of the exponent (2) multiplies e²ˣ."),
          q("MEDIUM", "Where does f(x) = x³ − 3x have a local maximum?", ["x = −1", "x = 1", "x = 0", "x = √3"], 0, "f′(x) = 3x² − 3 = 0 at x = ±1, and f″(−1) = −6 < 0, so x = −1 is a maximum."),
          q("MEDIUM", "d/dx ln(x² + 1) =", ["2x/(x² + 1)", "1/(x² + 1)", "2x·ln(x² + 1)", "1/(2x)"], 0, "Chain rule: (1/(x² + 1)) × 2x."),
        ],
      },
      {
        name: "Integrals",
        unit: "Calculus",
        resources: [
          { title: "The definite integral", url: "https://openstax.org/books/calculus-volume-1/pages/5-2-the-definite-integral", source: "openstax.org" },
          { title: "Integration by parts", url: "https://openstax.org/books/calculus-volume-2/pages/3-1-integration-by-parts", source: "openstax.org" },
        ],
        questions: [
          q("EASY", "∫ 2x dx =", ["x² + C", "2x² + C", "x²/2 + C", "2 + C"], 0, "The antiderivative of 2x is x², plus a constant."),
          q("EASY", "∫₀¹ x² dx =", ["1/3", "1/2", "1", "2/3"], 0, "[x³/3] from 0 to 1 = 1/3."),
          q("EASY", "∫ cos x dx =", ["sin x + C", "−sin x + C", "cos x + C", "−cos x + C"], 0, "d/dx sin x = cos x."),
          q("EASY", "For x > 0, ∫ (1/x) dx =", ["ln x + C", "−1/(2x²) + C", "1/x² + C", "eˣ + C"], 0, "d/dx ln x = 1/x."),
          q("MEDIUM", "What is the area under y = 3x² from x = 0 to x = 2?", ["8", "12", "6", "4"], 0, "∫₀² 3x² dx = [x³] from 0 to 2 = 8."),
          q("HARD", "∫ x·eˣ dx =", ["eˣ(x − 1) + C", "x·eˣ + C", "eˣ(x + 1) + C", "x²eˣ/2 + C"], 0, "By parts with u = x and dv = eˣ dx: x·eˣ − ∫eˣ dx = eˣ(x − 1) + C."),
        ],
      },
    ],
  },
];

/** Optional demo opponents for local/preview environments (SEED_DEMO_DATA=true). Flagged isDemo. */
export const DEMO_PLAYERS = [
  { name: "Meera Iyer", email: "meera.demo@quizbo.local", rating: 1462, matchesPlayed: 41 },
  { name: "Ishaan R.", email: "ishaan.demo@quizbo.local", rating: 1398, matchesPlayed: 33 },
  { name: "Dev Patel", email: "dev.demo@quizbo.local", rating: 1331, matchesPlayed: 27 },
  { name: "Sara Khan", email: "sara.demo@quizbo.local", rating: 1240, matchesPlayed: 19 },
  { name: "Kabir Das", email: "kabir.demo@quizbo.local", rating: 1175, matchesPlayed: 12 },
];
