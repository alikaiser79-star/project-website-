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

export const FAQ = [
  {
    id: "f1",
    q: "Is the first class really free?",
    a: "Yes. Every new family or adult swimmer gets one complimentary trial class — no payment info needed up front. Book it from your member portal after creating a free account.",
  },
  {
    id: "f2",
    q: "My daughter has never swum before. Is that okay?",
    a: "Absolutely. Our Tiny Swans and Splash & Smile classes are designed for first-timers. Coaches start in the shallow end and only progress when she feels ready — no pressure, ever.",
  },
  {
    id: "f3",
    q: "What does she need to wear or bring?",
    a: "A one-piece swimsuit, goggles and a towel. For water-ballet tiers we provide nose clips and group-specific accessories at no extra cost during her first month.",
  },
  {
    id: "f4",
    q: "How big are the classes?",
    a: "Group classes are capped at six girls per coach. Adult classes cap at eight per coach. We never compromise on the 1:6 ratio, and there is always a dedicated lifeguard on deck.",
  },
  {
    id: "f5",
    q: "Can adults really do water ballet without dance experience?",
    a: "Yes — about 70% of our Adult Water Ballet members started with zero dance background. We coach the fundamentals from week one and ease into choreography over the season.",
  },
  {
    id: "f6",
    q: "What is your cancellation policy?",
    a: "Cancel any class up to 4 hours in advance from your member portal — no penalty, the session credit goes back to your balance. Memberships can be paused or cancelled any time with no fees.",
  },
  {
    id: "f7",
    q: "Do you accommodate accessibility needs?",
    a: "Yes. We have pool lifts, sensory-friendly session slots and coaches trained in adaptive swim instruction. Tell us about your needs at signup or in the booking notes and we'll plan together.",
  },
  {
    id: "f8",
    q: "Are showcases mandatory?",
    a: "Never. Showcases are a beautiful tradition, but every girl and adult chooses for herself. Coaches help her decide what feels right — and there is no pressure either way.",
  },
];

// Weekly schedule grid — used by Schedule.jsx
export const SCHEDULE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const SCHEDULE_TRACKS = [
  {
    id: "tiny",
    name: "Tiny Swans",
    audience: "Ages 6–8",
    color: "blossom",
    slots: { Mon: "16:00", Wed: "16:00", Sat: "10:00" },
  },
  {
    id: "junior",
    name: "Junior Mermaids",
    audience: "Ages 9–11",
    color: "coral",
    slots: { Tue: "17:00", Thu: "17:00", Sat: "11:30" },
  },
  {
    id: "rising",
    name: "Rising Stars",
    audience: "Ages 12–14",
    color: "lavender",
    slots: { Mon: "18:00", Wed: "18:00", Fri: "17:30" },
  },
  {
    id: "elite",
    name: "Elite Corps",
    audience: "Ages 15–16",
    color: "sparkle",
    slots: { Tue: "19:00", Thu: "19:00", Fri: "19:00", Sun: "09:00" },
  },
  {
    id: "ballet-adult",
    name: "Adult Water Ballet",
    audience: "Adults",
    color: "blossom",
    slots: { Wed: "20:00", Sun: "11:00" },
  },
  {
    id: "aqua-fit",
    name: "Aqua Fitness",
    audience: "Adults",
    color: "aqua",
    slots: { Mon: "07:00", Tue: "07:00", Thu: "07:00", Sat: "08:30" },
  },
  {
    id: "mom-me",
    name: "Mom & Me Swim",
    audience: "Ages 2–5 + parent",
    color: "sparkle",
    slots: { Sat: "09:30", Sun: "10:00" },
  },
  {
    id: "adult-swim",
    name: "Adult Swim Lessons",
    audience: "Adults",
    color: "coral",
    slots: { Tue: "20:00", Thu: "20:00" },
  },
];

export const SHOWCASES = [
  {
    id: "s1",
    date: "2026-07-19",
    time: "6:00 PM",
    title: "Summer Sparkle Showcase",
    subtitle: "Tiny Swans & Junior Mermaids",
    desc: "Our youngest swimmers' first big night under the lights — with parent seating, photo wall and a sparkle-themed afterparty.",
    accent: "from-blossom/40 to-lavender/30",
    badge: "Family Event",
  },
  {
    id: "s2",
    date: "2026-08-23",
    time: "7:30 PM",
    title: "Rising Stars Showcase",
    subtitle: "Pre-competitive team",
    desc: "An evening of choreographed routines, group lifts and original music — a celebration of months of careful work.",
    accent: "from-coral/40 to-blossom/30",
    badge: "Showcase",
  },
  {
    id: "s3",
    date: "2026-09-14",
    time: "All weekend",
    title: "Regional Invitational",
    subtitle: "Elite Corps competes",
    desc: "Our top tier travels for the annual regional invitational. Families are invited to come cheer — bus + accommodation block available.",
    accent: "from-aqua/40 to-lavender/30",
    badge: "Competition",
  },
  {
    id: "s4",
    date: "2026-10-26",
    time: "10:00 AM",
    title: "Adult Showcase & Brunch",
    subtitle: "Adult Water Ballet",
    desc: "A relaxed Sunday-morning showcase by our adult ballet members — followed by mimosas, pastries and lots of celebration.",
    accent: "from-lavender/40 to-sparkle/30",
    badge: "Adults",
  },
];

// Adult programs — for moms, women, and grown-ups who want
// to swim, move and find their own water-ballet grace.
export const ADULTS = [
  {
    id: "a1",
    title: "Adult Water Ballet",
    tagline: "Grace, music, community",
    description:
      "Elegant artistry meets serious conditioning. Open to women of all ages and abilities — no prior experience needed. Discover poise, music and the joy of moving together.",
    duration: "75 min",
    sessions: "2 sessions / week",
    learn: [
      "Sculling, figures & musicality",
      "Core, breath and posture work",
      "Optional seasonal showcase",
      "A supportive community of women",
    ],
    color: "from-blossom/40 via-lavender/30 to-coral/30",
    icon: "Music",
  },
  {
    id: "a2",
    title: "Aqua Fitness",
    tagline: "Low impact, big results",
    description:
      "Joint-friendly conditioning set to music. A full-body workout that feels more like dancing than training — perfect for busy parents and anyone returning to fitness.",
    duration: "45 min",
    sessions: "3–4 sessions / week",
    learn: [
      "Cardio + strength in the water",
      "Resistance training with foam tools",
      "Recovery & flexibility work",
      "Drop-in friendly schedule",
    ],
    color: "from-aqua/40 via-lavender/30 to-blossom/30",
    icon: "Heart",
  },
  {
    id: "a3",
    title: "Mom & Me Swim",
    tagline: "Bond in the water",
    description:
      "A gentle weekend session for parents and little ones (ages 2–5). Songs, splashes and first floats — guided by a coach so you can simply enjoy the moment.",
    duration: "30 min",
    sessions: "Weekend mornings",
    learn: [
      "Safe water-introduction games",
      "Parent-led floats and supports",
      "Songs, bubbles and laughter",
      "Coffee + chat in the family lounge",
    ],
    color: "from-sparkle/40 via-blossom/20 to-aqua/20",
    icon: "Sparkle",
  },
  {
    id: "a4",
    title: "Adult Swim Lessons",
    tagline: "It is never too late",
    description:
      "Small-group lessons (max 4) for adults learning to swim or refining strokes. Calm, judgement-free coaching with the same warmth we bring to our girls.",
    duration: "60 min",
    sessions: "1–2 sessions / week",
    learn: [
      "Comfort & breath in deep water",
      "Freestyle, back & breaststroke",
      "Open-water confidence (optional)",
      "Private lessons available",
    ],
    color: "from-coral/40 via-sparkle/20 to-lavender/30",
    icon: "Drop",
  },
];

export const SAFER = [
  { letter: "S", word: "Supervision", desc: "A lifeguard plus a 1:6 coach ratio every minute girls are in the water — no exceptions." },
  { letter: "A", word: "Awareness", desc: "Continuous head counts and gentle audible signals so every swimmer is always seen." },
  { letter: "F", word: "Fitness", desc: "Annual swim-readiness checks for every coach, lifeguard and team member." },
  { letter: "E", word: "Equipment", desc: "Inspected rescue gear, AED and oxygen present at every pool deck, every session." },
  { letter: "R", word: "Response", desc: "Quarterly emergency drills with documented response times we share with parents." },
];

// Annual = 10 × monthly (two months free)
export const TIERS = [
  {
    id: "basic",
    name: "Sparkle",
    price: 89,
    annualPrice: 890,
    period: "/month",
    blurb: "A gentle start with everything she needs to fall in love with the water.",
    features: ["8 group lessons / month", "Online level finder", "Locker access", "Family swim weekends"],
    cta: "Start Sparkling",
  },
  {
    id: "pro",
    name: "Shimmer",
    price: 149,
    annualPrice: 1490,
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
    annualPrice: 2490,
    period: "/month",
    blurb: "Unlimited training, personal coaching and a dedicated head coach.",
    features: ["Unlimited lessons", "4 private sessions / month", "Dedicated head coach", "Performance lab access", "Open-water clinics"],
    cta: "Go Starlight",
  },
];

export const TESTIMONIALS = [
  {
    id: "t1",
    voice: "Parent",
    name: "Priya R.",
    role: "Mom of Aria, age 10",
    quote:
      "Aria came home from her first Junior Mermaids class glowing — and she's been counting down to Tuesdays ever since. The coaches are warm, attentive, and clearly love what they do.",
    color: "from-blossom/20 to-lavender/10",
  },
  {
    id: "t2",
    voice: "Swimmer",
    name: "Layla, age 13",
    role: "Rising Stars",
    quote:
      "I used to be scared of putting my head underwater. Now I'm doing lifts and choreography with my best friends on the team. I feel really brave here.",
    color: "from-coral/20 to-blossom/10",
  },
  {
    id: "t3",
    voice: "Parent",
    name: "Marcus &amp; Elena T.",
    role: "Dads of Sofia, age 7",
    quote:
      "What sold us was the safety walk-through on day one — ratios, drills, the AED on deck. Sofia has so much fun she doesn't even notice how thoughtful everything is.",
    color: "from-lavender/20 to-aqua/10",
  },
  {
    id: "t4",
    voice: "Swimmer",
    name: "Yumi, age 15",
    role: "Elite Corps",
    quote:
      "Helping the younger girls in Tiny Swans on Saturdays has changed how I see myself. AquaGrace built me up, and now I get to do that for someone else.",
    color: "from-sparkle/20 to-coral/10",
  },
  {
    id: "t5",
    voice: "Adult",
    name: "Diane M.",
    role: "Adult Water Ballet",
    quote:
      "I joined at 52 having never done any kind of dance. Six months in I performed in our first showcase — terrified and beaming. This place changes you.",
    color: "from-lavender/20 to-blossom/10",
  },
  {
    id: "t6",
    voice: "Adult",
    name: "Hannah K.",
    role: "Adult Swim Lessons",
    quote:
      "I couldn't put my face in the water at 34. The coaches met me exactly where I was, never rushed me, never made me feel small. I swim a full lap now.",
    color: "from-aqua/20 to-lavender/10",
  },
];

export const COACHES = [
  {
    name: "Marina Voss",
    role: "Head Coach",
    spec: "Olympic-distance freestyle",
    initials: "MV",
    years: 14,
    certs: ["NCAA D1 alum", "Red Cross WSI", "AED-certified"],
    bio: "Marina swam D1 at university and competed at the national level for five seasons. She founded AquaGrace's coaching program in 2019 and personally interviews every coach who joins the team.",
    favorite: "A perfectly timed flip turn",
  },
  {
    name: "Daniel Park",
    role: "Performance Coach",
    spec: "Sprint & race strategy",
    initials: "DP",
    years: 9,
    certs: ["ASCA Level 3", "Strength & Conditioning"],
    bio: "Dan coaches the technical side of Elite Corps and Rising Stars — pacing, race plans, video review and dry-land conditioning. Calm, precise, and deeply patient.",
    favorite: "Sub-25s 50-free splits on a Friday",
  },
  {
    name: "Lena Aliyeva",
    role: "Lead Choreographer",
    spec: "Artistic swimming & ballet",
    initials: "LA",
    years: 12,
    certs: ["Former national synchro team", "RAD ballet"],
    bio: "Lena designs every showcase routine from the first count to the last sequin. She trained with the national synchronized swimming team and brings a true dancer's eye to the pool.",
    favorite: "The moment the music drops and 12 hands rise as one",
  },
  {
    name: "Omar Rashid",
    role: "Junior Program Lead",
    spec: "Tiny Swans & Junior Mermaids",
    initials: "OR",
    years: 8,
    certs: ["Adapted swim instructor", "Pediatric first aid"],
    bio: "Omar runs our youngest tiers with warmth, silly songs and endless patience. He's the reason so many of our girls remember their first lesson as the best day of the week.",
    favorite: "First-time blowing-bubbles giggles",
  },
  {
    name: "Sofia Marin",
    role: "Stroke Specialist",
    spec: "Butterfly & IM",
    initials: "SM",
    years: 7,
    certs: ["ASCA Level 2", "USA Swimming"],
    bio: "Sofia coaches stroke clinics across all ages and runs our Adult Swim Lessons program. Her judgement-free style is why adult beginners feel safe enough to try again.",
    favorite: "Helping a grown-up swim a full lap for the first time",
  },
  {
    name: "James Whitlock",
    role: "Aquatic Director",
    spec: "Operations & safety",
    initials: "JW",
    years: 18,
    certs: ["Pool Operator Certified", "EMS background"],
    bio: "James runs our daily operations — staffing, safety drills, equipment audits, and the S.A.F.E.R. covenant. If something is humming smoothly in the building, it's because of him.",
    favorite: "A clean monthly safety audit",
  },
];

export const CAREERS = [
  { id: "c1", title: "Senior Swim Coach", type: "Full-time", location: "On-site", desc: "Lead intermediate and advanced groups; design seasonal training plans for our girls." },
  { id: "c2", title: "Water Ballet Choreographer", type: "Part-time", location: "On-site", desc: "Choreograph Junior Mermaids, Rising Stars & Elite Corps routines with our music director." },
  { id: "c3", title: "Lifeguard / Junior Coach", type: "Part-time", location: "On-site", desc: "Maintain pool safety and assist beginner-class instructors with kindness and care." },
  { id: "c4", title: "Front Desk & Member Concierge", type: "Full-time", location: "On-site", desc: "Welcome families, manage bookings and steward the AquaGrace experience." },
];
