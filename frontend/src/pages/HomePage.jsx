import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { propertiesService } from '../services/properties.service';
import PropertyCard from '../components/property/PropertyCard';
import { FadeIn, SlideUp, Stagger, Hover } from '../components/motion';

// =============================================================================
// HomePage — 99acres-style landing
//   1. Hero + search
//   2. Featured carousel (latest launches)
//   3. Category tiles (Plot, Home, Apartment, Farm Land, Commercial, Rent, PG)
//   4. Recommended by category
//   5. Price-range stats by area
//   6. Ready-to-move projects
//   7. Upcoming & pre-launch (carousel)
//   8. Price trends city-wise
//   9. Commercial property spotlight
// =============================================================================

const CATEGORIES = [
  { slug: 'plot',       label: 'Plot',            icon: '🧭', color: 'from-emerald-500 to-teal-500',   filter: { propertyType: 'plot' } },
  { slug: 'home',       label: 'Home',            icon: '🏡', color: 'from-blue-500 to-indigo-500',    filter: { propertyType: 'house' } },
  { slug: 'apartment',  label: 'Apartment',       icon: '🏢', color: 'from-violet-500 to-purple-500',  filter: { propertyType: 'apartment' } },
  { slug: 'farmland',   label: 'Farm Land',       icon: '🌾', color: 'from-lime-500 to-green-600',     filter: { propertyType: 'plot' } },
  { slug: 'commercial', label: 'Commercial',      icon: '🏬', color: 'from-amber-500 to-orange-500',   filter: { propertyType: 'commercial' } },
  { slug: 'rent',       label: 'Rent',            icon: '🔑', color: 'from-pink-500 to-rose-500',      filter: { listingType: 'rent' } },
  { slug: 'pg',         label: 'PG',              icon: '🛏️', color: 'from-sky-500 to-cyan-500',       filter: { propertyType: 'pg' } },
];

// Demo trend data (wire up to analytics API in prod).
const PRICE_TRENDS = [
  { city: 'Bangalore', yoy: 8.4,  avgPsf: 7800,  direction: 'up' },
  { city: 'Mumbai',    yoy: 6.1,  avgPsf: 24500, direction: 'up' },
  { city: 'Hyderabad', yoy: 11.2, avgPsf: 6400,  direction: 'up' },
  { city: 'Pune',      yoy: 5.9,  avgPsf: 8100,  direction: 'up' },
  { city: 'Chennai',   yoy: 4.2,  avgPsf: 7200,  direction: 'up' },
  { city: 'Delhi NCR', yoy: -1.2, avgPsf: 9300,  direction: 'down' },
];

const AREA_STATS = [
  { area: 'Koramangala, Bangalore', range: '₹18K – ₹65K/mo', median: '₹32K' },
  { area: 'Bandra, Mumbai',         range: '₹45K – ₹1.8L/mo', median: '₹85K' },
  { area: 'Gachibowli, Hyderabad',  range: '₹15K – ₹45K/mo', median: '₹26K' },
  { area: 'Baner, Pune',            range: '₹16K – ₹50K/mo', median: '₹28K' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [latest, setLatest] = useState([]);
  const [readyToMove, setReadyToMove] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [commercial, setCommercial] = useState([]);
  const [recommended, setRecommended] = useState({}); // keyed by category

  useEffect(() => {
    // Fetch the main property feeds in parallel.
    propertiesService.search({ limit: 10 }).then((r) => setLatest(r.data || []));
    propertiesService
      .search({ limit: 8, possessionStatus: 'ready_to_move' })
      .then((r) => setReadyToMove(r.data || []));
    propertiesService
      .search({ limit: 8, possessionStatus: 'upcoming' })
      .then((r) => setUpcoming(r.data || []));
    propertiesService
      .search({ limit: 6, propertyType: 'commercial' })
      .then((r) => setCommercial(r.data || []));

    // Recommended by category (parallel).
    Promise.all(
      CATEGORIES.slice(0, 4).map((c) =>
        propertiesService.search({ limit: 4, ...c.filter })
          .then((r) => [c.slug, r.data || []])
      )
    ).then((entries) => setRecommended(Object.fromEntries(entries)));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set('city', query);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="bg-gray-50">
      {/* ──────────────────────── HERO ──────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />
        <motion.div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.3), transparent 45%)",
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative max-w-6xl mx-auto px-4 py-20 text-white">
          <SlideUp whileInView={false} className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Find your next home, <span className="text-amber-300">effortlessly.</span>
            </h1>
            <p className="mt-3 text-blue-100 text-lg">
              Explore apartments, villas, plots, and commercial spaces — verified listings across India.
            </p>
          </SlideUp>

          <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 bg-white rounded-2xl shadow-2xl shadow-black/20 p-2 flex flex-col md:flex-row gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by city, locality, or project"
              className="flex-1 bg-transparent px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none"
            />
            <Hover preset="lift">
              <button
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-6 py-3 rounded-xl text-sm shadow-md shadow-blue-500/30"
              >
                Search
              </button>
            </Hover>
          </motion.form>
        </div>
      </section>

      {/* ──────────────────────── 1. FEATURED CAROUSEL ──────────────────────── */}
      {/* <Section title="Latest launches" subtitle="Newly-added high-rises, villas, plots, farm lands and more">
        <Carousel items={latest} renderItem={(p) => (
          <div className="min-w-[280px] max-w-[280px]">
            <PropertyCard property={p} />
          </div>
        )} />
      </Section> */}

      {/* ──────────────────────── 2. CATEGORIES ──────────────────────── */}
      <Section title="Explore by category" subtitle="Jump to exactly what you&rsquo;re looking for">
        <Stagger className="grid grid-cols-3 md:grid-cols-7 gap-3" stagger={0.06}>
          {CATEGORIES.map((c) => (
            <Stagger.Item key={c.slug}>
              <Hover preset="card">
                <Link
                  to={`/search?${new URLSearchParams(c.filter).toString()}`}
                  className={`relative block rounded-2xl p-4 bg-gradient-to-br ${c.color} text-white shadow-md overflow-hidden`}
                >
                  <div className="text-3xl">{c.icon}</div>
                  <div className="mt-3 font-semibold text-sm">{c.label}</div>
                </Link>
              </Hover>
            </Stagger.Item>
          ))}
        </Stagger>
      </Section>

      {/* ──────────────────────── 3. RECOMMENDED BY CATEGORY ──────────────────────── */}
      {Object.keys(recommended).length > 0 && (
        <Section title="Recommended for you" subtitle="Hand-picked across top categories">
          <div className="space-y-10">
            {CATEGORIES.slice(0, 4).map((c) => {
              const items = recommended[c.slug] || [];
              if (!items.length) return null;
              return (
                <FadeIn key={c.slug} whileInView>
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">{c.icon} {c.label}</h3>
                    <Link to={`/search?${new URLSearchParams(c.filter).toString()}`}
                      className="text-xs font-medium text-blue-600 hover:underline">
                      See all →
                    </Link>
                  </div>
                  <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.06}>
                    {items.map((p) => (
                      <Stagger.Item key={p.id}><PropertyCard property={p} /></Stagger.Item>
                    ))}
                  </Stagger>
                </FadeIn>
              );
            })}
          </div>
        </Section>
      )}

      {/* ──────────────────────── 4. PRICE RANGE STATS ──────────────────────── */}
      <Section title="Price range · area wise" subtitle="Median rent & typical range across India&rsquo;s most-searched neighbourhoods">
        <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.08}>
          {AREA_STATS.map((s) => (
            <Stagger.Item key={s.area}>
              <Hover preset="card">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="text-xs uppercase tracking-wider text-blue-600 font-semibold">Area</div>
                  <div className="mt-1 font-semibold text-gray-900">{s.area}</div>
                  <div className="mt-4 text-2xl font-bold text-gray-900">{s.median}</div>
                  <div className="text-xs text-gray-500">median · range {s.range}</div>
                </div>
              </Hover>
            </Stagger.Item>
          ))}
        </Stagger>
      </Section>

      {/* ──────────────────────── 5. READY-TO-MOVE ──────────────────────── */}
      <Section title="Ready-to-move projects" subtitle="Move in right away — possession ready today">
        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.06}>
          {(readyToMove.length ? readyToMove : latest).slice(0, 8).map((p) => (
            <Stagger.Item key={p.id}><PropertyCard property={p} /></Stagger.Item>
          ))}
        </Stagger>
      </Section>

      {/* ──────────────────────── 6. UPCOMING & PRE-LAUNCH ──────────────────────── */}
      <Section title="Upcoming & pre-launch" subtitle="Reserve early and lock in launch pricing">
        <Carousel
          items={(upcoming.length ? upcoming : latest).slice(0, 8)}
          renderItem={(p) => (
            <div className="min-w-[280px] max-w-[280px]">
              <div className="relative">
                <span className="absolute top-2 right-2 z-10 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                  Pre-launch
                </span>
                <PropertyCard property={p} />
              </div>
            </div>
          )}
        />
      </Section>

      {/* ──────────────────────── 7. PRICE TRENDS ──────────────────────── */}
      <Section title="Price trends · city wise" subtitle="Year-over-year movement in residential rates">
        <Stagger className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" stagger={0.05}>
          {PRICE_TRENDS.map((t) => (
            <Stagger.Item key={t.city}>
              <Hover preset="card">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">{t.city}</div>
                  <div className="mt-1 font-bold text-gray-900">₹{t.avgPsf.toLocaleString()}/sqft</div>
                  <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${
                    t.direction === 'up' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    <span>{t.direction === 'up' ? '▲' : '▼'}</span>
                    <span>{Math.abs(t.yoy).toFixed(1)}% YoY</span>
                  </div>
                </div>
              </Hover>
            </Stagger.Item>
          ))}
        </Stagger>
      </Section>

      {/* ──────────────────────── 8. COMMERCIAL SPOTLIGHT ──────────────────────── */}
      {commercial.length > 0 && (
        <Section title="Commercial property" subtitle="Offices, retail, and investment-grade assets">
          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" stagger={0.08}>
            {commercial.map((p) => (
              <Stagger.Item key={p.id}><PropertyCard property={p} /></Stagger.Item>
            ))}
          </Stagger>
        </Section>
      )}

      {/* Post-your-property CTA */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <FadeIn whileInView className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-10 text-white text-center overflow-hidden relative">
          <SlideUp whileInView>
            <h2 className="text-3xl font-bold">Have a property to sell or rent?</h2>
            <p className="mt-2 text-blue-100 max-w-xl mx-auto">
              List on FindDen and reach thousands of buyers. Post a single property, bundle up to 10,
              or go Pro for unlimited reach.
            </p>
            <div className="mt-6">
              <Hover preset="lift">
                <Link
                  to="/post-property"
                  className="inline-block bg-white text-blue-700 font-semibold px-6 py-3 rounded-xl text-sm shadow-md shadow-black/20"
                >
                  + Post your property
                </Link>
              </Hover>
            </div>
          </SlideUp>
        </FadeIn>
      </section>
    </div>
  );
}

// ─────────────────────────────── helpers ──────────────────────────────────────

function Section({ title, subtitle, children }) {
  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <SlideUp whileInView className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </SlideUp>
      {children}
    </section>
  );
}

/**
 * Horizontal carousel with snap scrolling + left/right arrows.
 * Keeps UX consistent across launches / pre-launch sections.
 */
function Carousel({ items = [], renderItem }) {
  const ref = useRef(null);
  const [page, setPage] = useState(0);

  const scroll = (dir) => {
    const el = ref.current;
    if (!el) return;
    const delta = dir === 'left' ? -320 : 320;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const empty = !items.length;
  const list = useMemo(() => items, [items]);

  return (
    <div className="relative">
      {!empty && (
        <>
          <Hover preset="lift" as="button">
            <button
              onClick={() => scroll('left')}
              className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow items-center justify-center hover:bg-gray-50"
              aria-label="Scroll left"
            >
              ‹
            </button>
          </Hover>
          <Hover preset="lift" as="button">
            <button
              onClick={() => scroll('right')}
              className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow items-center justify-center hover:bg-gray-50"
              aria-label="Scroll right"
            >
              ›
            </button>
          </Hover>
        </>
      )}

      <div
        ref={ref}
        onScroll={(e) => setPage(Math.round(e.target.scrollLeft / 300))}
        className="overflow-x-auto scrollbar-none scroll-smooth"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        <AnimatePresence>
          <motion.div
            className="flex gap-4 pb-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            }}
          >
            {list.map((item) => (
              <motion.div
                key={item.id || JSON.stringify(item)}
                style={{ scrollSnapAlign: 'start' }}
                variants={{
                  hidden: { opacity: 0, x: 24 },
                  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
                }}
              >
                {renderItem(item)}
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {empty && (
          <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
            No listings yet.
          </div>
        )}
      </div>

      {/* Dots (decorative) */}
      {!empty && (
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: Math.ceil(list.length / 3) }).map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${page === i ? 'bg-blue-600' : 'bg-gray-300'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
