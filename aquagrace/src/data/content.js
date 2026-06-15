export const STATS = [
  { value: "500+", label: "Happy Swimmers" },
  { value: "10+", label: "Caring Coaches" },
  { value: "5★", label: "Safety Rating" },
  { value: "12", label: "Magical Years" },
];

export const PROGRAMS = [
  {
    id: "p1",
    icon: "Drop",
    title: "Splash & Smile Lessons",
    desc: "Confidence in the water, one giggle at a time. Group and private lessons just for girls.",
    age: "Ages 4–12",
    accent: "from-lavender/30 to-blossom/30",
  },
  {
    id: "p2",
    icon: "Trophy",
    title: "Stroke Stars Clinics",
    desc: "Refine technique, race smart, and shine in friendly meets — built for rising swimmers.",
    age: "Ages 10+",
    accent: "from-coral/30 to-sparkle/30",
  },
  {
    id: "p3",
    icon: "Heart",
    title: "Family Pool Parties",
    desc: "Themed swim nights with sparkles, music and parent–daughter splash sessions.",
    age: "All ages",
    accent: "from-blossom/30 to-lavender/30",
  },
  {
    id: "p4",
    icon: "Sparkle",
    title: "Find My Level",
    desc: "A 90-second quiz that helps every girl find the program that feels just right.",
    age: "90 sec quiz",
    accent: "from-sparkle/30 to-blossom/30",
  },
];

// Water Ballet — the heart of AquaGrace, ages 6–16, four tiers.
export const BALLET = [
  {
    id: "b1",
    level: "Tier I",
    title: "Tiny Swans",
    age: "Ages 6–8",
    description: "A gentle, sparkly first step into water ballet. Floats, smiles and starlight choreography in shallow water with one of our coaches always at arm's reach.",
    duration: "45 min",
    sessions: "2 sessions / week",
    learn: [
      "Confident floats, glides & sculling",
      "First arm patterns set to music",
      "Friendship circles & group routines",
      "Mini show-day for family at term end",
    ],
    color: "from-lavender/40 via-blossom/30 to-sparkle/20",
    icon: "Sparkle",
  },
  {
    id: "b2",
    level: "Tier II",
    title: "Junior Mermaids",
    age: "Ages 9–11",
    description: "Where grace truly begins. Girls learn elegant figures, eggbeater stamina and how to count music — and finish each season with a costumed performance.",
    duration: "60 min",
    sessions: "2–3 sessions / week",
    learn: [
      "Vertical positions, ballet legs & spirals",
      "Eggbeater conditioning",
      "Counting & musicality basics",
      "Group choreography + costume night",
    ],
    color: "from-blossom/40 via-coral/30 to-lavender/30",
    icon: "Heart",
  },
  {
    id: "b3",
    level: "Tier III",
    title: "Rising Stars",
    age: "Ages 12–14",
    description: "Pre-competitive artistry with a real team identity. We sharpen technique, introduce lifts and prepare girls for regional showcases — alongside mentorship.",
    duration: "75 min",
    sessions: "3 sessions / week",
    learn: [
      "Advanced figures, lifts & pair work",
      "Showcase choreography & expression",
      "Strength + flexibility conditioning",
      "Showcase performances each season",
    ],
    color: "from-coral/40 via-blossom/30 to-aqua/30",
    icon: "Star",
  },
  {
    id: "b4",
    level: "Tier IV",
    title: "Elite Corps",
    age: "Ages 15–16",
    description: "Our top tier — competition-ready choreography, elite conditioning, and leadership. Elite Corps swimmers mentor younger tiers and represent AquaGrace at events.",
    duration: "90 min",
    sessions: "4 sessions / week",
    learn: [
      "Competition-grade routines",
      "Pair, trio & team specialty work",
      "Leadership roles with younger tiers",
      "Travel meets & showcase tours",
    ],
    color: "from-aqua/40 via-lavender/30 to-coral/30",
    icon: "Trophy",
  },
];

export const SAFER = [
  { letter: "S", word: "Supervision", desc: "A lifeguard plus a 1:6 coach ratio every minute girls are in the water — no exceptions." },
  { letter: "A", word: "Awareness", desc: "Continuous head counts and gentle audible signals so every swimmer is always seen." },
  { letter: "F", word: "Fitness", desc: "Annual swim-readiness checks for every coach, lifeguard and team member." },
  { letter: "E", word: "Equipment", desc: "Inspected rescue gear, AED and oxygen present at every pool deck, every session." },
  { letter: "R", word: "Response", desc: "Quarterly emergency drills with documented response times we share with parents." },
];

export const TIERS = [
  {
    id: "basic",
    name: "Sparkle",
    price: 89,
    period: "/month",
    blurb: "A gentle start with everything she needs to fall in love with the water.",
    features: ["8 group lessons / month", "Online level finder", "Locker access", "Family swim weekends"],
    cta: "Start Sparkling",
  },
  {
    id: "pro",
    name: "Shimmer",
    price: 149,
    period: "/month",
    blurb: "Our most-loved plan — flexible coaching, video reviews and priority booking.",
    features: ["16 group lessons / month", "1 private session / month", "Priority booking", "Stroke video review", "Friend pass × 1"],
    cta: "Choose Shimmer",
    featured: true,
  },
  {
    id: "elite",
    name: "Starlight",
    price: 249,
    period: "/month",
    blurb: "Unlimited training, personal coaching and a dedicated head coach.",
    features: ["Unlimited lessons", "4 private sessions / month", "Dedicated head coach", "Performance lab access", "Open-water clinics"],
    cta: "Go Starlight",
  },
];

export const COACHES = [
  { name: "Marina Voss", role: "Head Coach", spec: "Olympic-distance freestyle", initials: "MV" },
  { name: "Daniel Park", role: "Performance Coach", spec: "Sprint & race strategy", initials: "DP" },
  { name: "Lena Aliyeva", role: "Lead Choreographer", spec: "Artistic swimming & ballet", initials: "LA" },
  { name: "Omar Rashid", role: "Junior Program Lead", spec: "Tiny Swans & Junior Mermaids", initials: "OR" },
  { name: "Sofia Marin", role: "Stroke Specialist", spec: "Butterfly & IM", initials: "SM" },
  { name: "James Whitlock", role: "Aquatic Director", spec: "Operations & safety", initials: "JW" },
];

export const CAREERS = [
  { id: "c1", title: "Senior Swim Coach", type: "Full-time", location: "On-site", desc: "Lead intermediate and advanced groups; design seasonal training plans for our girls." },
  { id: "c2", title: "Water Ballet Choreographer", type: "Part-time", location: "On-site", desc: "Choreograph Junior Mermaids, Rising Stars & Elite Corps routines with our music director." },
  { id: "c3", title: "Lifeguard / Junior Coach", type: "Part-time", location: "On-site", desc: "Maintain pool safety and assist beginner-class instructors with kindness and care." },
  { id: "c4", title: "Front Desk & Member Concierge", type: "Full-time", location: "On-site", desc: "Welcome families, manage bookings and steward the AquaGrace experience." },
];
