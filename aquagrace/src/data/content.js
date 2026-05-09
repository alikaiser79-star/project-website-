export const STATS = [
  { value: "500+", label: "Students Trained" },
  { value: "10+", label: "Certified Coaches" },
  { value: "5★", label: "Safety Rating" },
  { value: "12", label: "Years Established" },
];

export const PROGRAMS = [
  {
    id: "p1",
    icon: "Drop",
    title: "Kids Swim Lessons",
    desc: "Group and private lessons that build confidence in the water from day one.",
    age: "Ages 4–12",
    accent: "from-aqua/30 to-ocean/30",
  },
  {
    id: "p2",
    icon: "Trophy",
    title: "Swim Clinics & Team Prep",
    desc: "Stroke refinement, race strategy and pace work for competitive swimmers.",
    age: "Ages 10+",
    accent: "from-gold/30 to-aqua/30",
  },
  {
    id: "p3",
    icon: "Heart",
    title: "Family & Fun Events",
    desc: "Themed pool nights, parent-child swims and seasonal celebrations.",
    age: "All ages",
    accent: "from-ocean/30 to-navy-soft/40",
  },
  {
    id: "p4",
    icon: "Sparkle",
    title: "Level Finder",
    desc: "Take a quick assessment to find the program tier that fits your swimmer.",
    age: "90 sec quiz",
    accent: "from-aqua-light/20 to-aqua/30",
  },
];

export const BALLET = [
  { id: "b1", level: "Level I", title: "Beginner Synchrony", desc: "Floats, sculls and basic figures with a graceful musical foundation.", duration: "8 weeks" },
  { id: "b2", level: "Level II", title: "Intermediate Figures", desc: "Vertical positions, spirals and team timing for an emerging routine.", duration: "10 weeks" },
  { id: "b3", level: "Level III", title: "Advanced Choreography", desc: "Full performance choreography, lifts and competition-grade discipline.", duration: "12 weeks" },
  { id: "b4", level: "Adult", title: "Adult Water Ballet", desc: "Elegant artistry and core conditioning for women of all ages.", duration: "Ongoing" },
];

export const SAFER = [
  { letter: "S", word: "Supervision", desc: "Lifeguard plus 1:6 instructor ratio in every session, no exceptions." },
  { letter: "A", word: "Awareness", desc: "Continuous head counts and surface scans with audible signals." },
  { letter: "F", word: "Fitness", desc: "Annual swim-readiness assessment for every coach and lifeguard." },
  { letter: "E", word: "Equipment", desc: "Inspected rescue gear, AED and oxygen present at every pool deck." },
  { letter: "R", word: "Response", desc: "Quarterly emergency drills with documented response times." },
];

export const TIERS = [
  {
    id: "basic",
    name: "Basic",
    price: 89,
    period: "/month",
    blurb: "Learn the fundamentals at your own pace.",
    features: ["8 group lessons / month", "Online level finder", "Locker access", "Family swim weekends"],
    cta: "Start Basic",
  },
  {
    id: "pro",
    name: "Pro",
    price: 149,
    period: "/month",
    blurb: "Our most loved tier — flexible coaching all month.",
    features: ["16 group lessons / month", "1 private session / month", "Priority booking", "Stroke video review", "Guest pass x1"],
    cta: "Choose Pro",
    featured: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: 249,
    period: "/month",
    blurb: "Unlimited training with personal performance coaching.",
    features: ["Unlimited lessons", "4 private sessions / month", "Dedicated head coach", "Performance lab access", "Open-water clinics"],
    cta: "Go Elite",
  },
];

export const COACHES = [
  { name: "Marina Voss", role: "Head Coach", spec: "Olympic Distance Freestyle", initials: "MV" },
  { name: "Daniel Park", role: "Performance Coach", spec: "Sprint & Race Strategy", initials: "DP" },
  { name: "Lena Aliyeva", role: "Lead Choreographer", spec: "Artistic Swimming", initials: "LA" },
  { name: "Omar Rashid", role: "Junior Program Lead", spec: "Kids Lessons & Safety", initials: "OR" },
  { name: "Sofia Marin", role: "Stroke Specialist", spec: "Butterfly & IM", initials: "SM" },
  { name: "James Whitlock", role: "Aquatic Director", spec: "Operations & Safety", initials: "JW" },
];

export const CAREERS = [
  { id: "c1", title: "Senior Swim Coach", type: "Full-time", location: "On-site", desc: "Lead intermediate and advanced groups; design seasonal training plans." },
  { id: "c2", title: "Water Ballet Choreographer", type: "Part-time", location: "On-site", desc: "Choreograph Level II and III routines; collaborate with our music director." },
  { id: "c3", title: "Lifeguard / Junior Coach", type: "Part-time", location: "On-site", desc: "Maintain pool safety and assist beginner-class instructors." },
  { id: "c4", title: "Front Desk & Member Concierge", type: "Full-time", location: "On-site", desc: "Welcome members, manage bookings and steward the AquaGrace experience." },
];
